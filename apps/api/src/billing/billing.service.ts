import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingPlan, Prisma, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { calendarMonth, resolveEntitlements } from "./entitlements";
import { StripeClient } from "./stripe.client";

const BILLING_PLANS: BillingPlan[] = ["STARTER", "GROWTH", "ENTERPRISE"];

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeClient: StripeClient,
    private readonly config: ConfigService,
  ) {}

  async summary(organizationId: string) {
    const subscription = await this.prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId, plan: "STARTER", status: "ACTIVE" },
      update: {},
    });
    const { periodStart, periodEnd } = calendarMonth();
    const [counters, teamMembers, entitlements] = await this.prisma.$transaction(async (tx) => Promise.all([
      tx.usageCounter.findMany({ where: { organizationId, periodStart } }),
      tx.organizationMember.count({ where: { organizationId } }),
      resolveEntitlements(tx, organizationId, subscription.plan),
    ]));
    const quantity = (metric: "INTERVIEWS" | "AI_TOKENS") => Number(counters.find((item) => item.metric === metric)?.quantity ?? 0n);
    const serialize = (key: keyof typeof entitlements) => ({
      enabled: entitlements[key].enabled,
      limit: entitlements[key].limit === null ? null : Number(entitlements[key].limit),
    });

    return {
      configured: this.stripeClient.configured,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canManage: Boolean(subscription.stripeCustomerId),
        canCheckout: !subscription.stripeSubscriptionId || ["CANCELED", "INCOMPLETE_EXPIRED"].includes(subscription.status),
      },
      period: { start: periodStart, end: periodEnd },
      usage: {
        interviews: { used: quantity("INTERVIEWS"), ...serialize("MONTHLY_INTERVIEWS") },
        aiTokens: { used: quantity("AI_TOKENS"), ...serialize("MONTHLY_AI_TOKENS") },
        teamMembers: { used: teamMembers, ...serialize("TEAM_MEMBERS") },
      },
      features: { advancedAnalytics: serialize("ADVANCED_ANALYTICS").enabled },
      plans: BILLING_PLANS.map((plan) => ({
        plan,
        checkoutAvailable: Boolean(this.stripeClient.stripe && this.stripeClient.priceForPlan(plan)),
      })),
    };
  }

  async createCheckout(organizationId: string, userEmail: string, plan: BillingPlan) {
    const stripe = this.requireStripe();
    const price = this.stripeClient.priceForPlan(plan);
    if (!price) this.unavailable(`Stripe price for ${plan} is not configured`);

    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
    if (!organization) throw new BadRequestException({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    let subscription = await this.prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
    if (subscription.stripeSubscriptionId && !["CANCELED", "INCOMPLETE_EXPIRED"].includes(subscription.status)) {
      throw new BadRequestException({ code: "SUBSCRIPTION_ALREADY_EXISTS", message: "Manage the existing subscription in the Stripe customer portal" });
    }
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { name: organization.name, email: userEmail, metadata: { organizationId } },
        { idempotencyKey: `organization-customer-${organizationId}` },
      );
      subscription = await this.prisma.subscription.update({
        where: { organizationId },
        data: { stripeCustomerId: customer.id },
      });
      customerId = subscription.stripeCustomerId;
    }

    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId!,
      line_items: [{ price, quantity: 1 }],
      success_url: `${frontendUrl}/billing?checkout=success`,
      cancel_url: `${frontendUrl}/billing?checkout=cancelled`,
      client_reference_id: organizationId,
      metadata: { organizationId, plan },
      subscription_data: { metadata: { organizationId, plan } },
      allow_promotion_codes: true,
    });
    if (!session.url) this.unavailable("Stripe did not return a checkout URL");
    return { url: session.url };
  }

  async createPortal(organizationId: string) {
    const stripe = this.requireStripe();
    const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription?.stripeCustomerId) {
      throw new BadRequestException({ code: "BILLING_CUSTOMER_MISSING", message: "Start a subscription before opening the billing portal" });
    }
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({ customer: subscription.stripeCustomerId, return_url: `${frontendUrl}/billing` });
    return { url: session.url };
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    const stripe = this.requireStripe();
    const secret = this.stripeClient.webhookSecret;
    if (!secret) this.unavailable("Stripe webhook secret is not configured");
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException({ code: "INVALID_STRIPE_SIGNATURE", message: "Invalid Stripe webhook signature" });
    }
  }

  async processWebhook(event: Stripe.Event) {
    const existing = await this.prisma.billingWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
    if (existing?.status === "PROCESSED") return { processed: true, duplicate: true };
    if (existing?.status === "PROCESSING" && existing.updatedAt > new Date(Date.now() - 5 * 60_000)) {
      return { processed: false, duplicate: true };
    }
    try {
      if (!existing) {
        try {
          await this.prisma.billingWebhookEvent.create({ data: { stripeEventId: event.id, type: event.type } });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { processed: false, duplicate: true };
          }
          throw error;
        }
      } else {
        const claimed = await this.prisma.billingWebhookEvent.updateMany({
          where: {
            id: existing.id,
            OR: [{ status: "FAILED" }, { status: "PROCESSING", updatedAt: { lte: new Date(Date.now() - 5 * 60_000) } }],
          },
          data: { type: event.type, status: "PROCESSING", attempts: { increment: 1 }, error: null },
        });
        if (!claimed.count) return { processed: false, duplicate: true };
      }
      await this.prisma.$transaction(async (tx) => {
        await this.applyWebhookEvent(tx, event);
        await tx.billingWebhookEvent.update({
          where: { stripeEventId: event.id },
          data: { status: "PROCESSED", processedAt: new Date(), error: null },
        });
      });
      return { processed: true, duplicate: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed";
      await this.prisma.billingWebhookEvent.updateMany({
        where: { stripeEventId: event.id },
        data: { status: "FAILED", error: message.slice(0, 10_000) },
      });
      throw error;
    }
  }

  private async applyWebhookEvent(tx: Prisma.TransactionClient, event: Stripe.Event) {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId ?? session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (organizationId && customerId) {
        await tx.subscription.upsert({
          where: { organizationId },
          create: { organizationId, stripeCustomerId: customerId },
          update: { stripeCustomerId: customerId },
        });
      }
      return;
    }
    if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return;

    const stripeSubscription = event.data.object as Stripe.Subscription;
    const customerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;
    const stored = await tx.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    const organizationId = stripeSubscription.metadata.organizationId ?? stored?.organizationId;
    if (!organizationId) return;
    const item = stripeSubscription.items.data[0];
    const priceId = item?.price.id;
    const plan = priceId ? this.stripeClient.planForPrice(priceId) : null;
    if (!plan && event.type !== "customer.subscription.deleted") return;
    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        plan: plan ?? "STARTER",
        status: this.subscriptionStatus(stripeSubscription.status),
        currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        plan: event.type === "customer.subscription.deleted" ? "STARTER" : plan!,
        status: this.subscriptionStatus(stripeSubscription.status),
        currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
        currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
  }

  private subscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    return status.toUpperCase() as SubscriptionStatus;
  }

  private requireStripe() {
    if (!this.stripeClient.stripe) this.unavailable("Stripe is not configured");
    return this.stripeClient.stripe;
  }

  private unavailable(message: string): never {
    throw new ServiceUnavailableException({ code: "STRIPE_NOT_CONFIGURED", message });
  }
}
