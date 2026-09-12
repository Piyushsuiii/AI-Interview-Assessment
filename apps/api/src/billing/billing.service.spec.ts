import { BillingService } from "./billing.service";

describe("BillingService", () => {
  it("uses only the server-side Stripe price mapped to a requested plan", async () => {
    const sessionsCreate = jest.fn().mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ name: "Acme" }) },
      subscription: {
        upsert: jest.fn().mockResolvedValue({ organizationId: "org-a", stripeCustomerId: "cus_123", stripeSubscriptionId: null, status: "ACTIVE" }),
      },
    };
    const stripeClient = {
      stripe: { customers: { create: jest.fn() }, checkout: { sessions: { create: sessionsCreate } } },
      priceForPlan: jest.fn().mockReturnValue("price_server_growth"),
    };
    const service = new BillingService(prisma as never, stripeClient as never, { get: jest.fn().mockReturnValue("https://app.test") } as never);

    await service.createCheckout("org-a", "owner@example.com", "GROWTH");

    expect(stripeClient.priceForPlan).toHaveBeenCalledWith("GROWTH");
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: "price_server_growth", quantity: 1 }],
      metadata: { organizationId: "org-a", plan: "GROWTH" },
    }));
  });

  it("does not process an already completed webhook event again", async () => {
    const prisma = { billingWebhookEvent: { findUnique: jest.fn().mockResolvedValue({ status: "PROCESSED" }) } };
    const service = new BillingService(prisma as never, {} as never, {} as never);

    await expect(service.processWebhook({ id: "evt_1", type: "customer.subscription.updated" } as never)).resolves.toEqual({ processed: true, duplicate: true });
  });
});
