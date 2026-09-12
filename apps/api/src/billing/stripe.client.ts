import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BillingPlan } from "@prisma/client";
import Stripe from "stripe";

@Injectable()
export class StripeClient {
  readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>("STRIPE_SECRET_KEY")?.trim();
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  get webhookSecret() {
    return this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim() || null;
  }

  priceForPlan(plan: BillingPlan) {
    return this.config.get<string>(`STRIPE_PRICE_${plan}`)?.trim() || null;
  }

  planForPrice(priceId: string): BillingPlan | null {
    const plans: BillingPlan[] = ["STARTER", "GROWTH", "ENTERPRISE"];
    return plans.find((plan) => this.priceForPlan(plan) === priceId) ?? null;
  }

  get configured() {
    return Boolean(this.stripe && this.webhookSecret);
  }
}
