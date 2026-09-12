import { calendarMonth, canConsumeUsage, incrementUsage, PLAN_ENTITLEMENTS } from "./entitlements";

describe("billing entitlements", () => {
  it("defines increasing plan limits without granting Starter advanced analytics", () => {
    expect(PLAN_ENTITLEMENTS.STARTER.ADVANCED_ANALYTICS.enabled).toBe(false);
    expect(PLAN_ENTITLEMENTS.GROWTH.MONTHLY_INTERVIEWS.limit).toBeGreaterThan(PLAN_ENTITLEMENTS.STARTER.MONTHLY_INTERVIEWS.limit!);
    expect(PLAN_ENTITLEMENTS.ENTERPRISE.MONTHLY_INTERVIEWS.limit).toBeNull();
  });

  it("increments a tenant and UTC-month scoped usage counter", async () => {
    const usageCounter = { upsert: jest.fn().mockResolvedValue({}) };
    const at = new Date("2026-09-10T18:30:00.000Z");

    await incrementUsage({ usageCounter } as never, "org-a", "AI_TOKENS", 42n, at);

    const { periodStart, periodEnd } = calendarMonth(at);
    expect(usageCounter.upsert).toHaveBeenCalledWith({
      where: { organizationId_metric_periodStart: { organizationId: "org-a", metric: "AI_TOKENS", periodStart } },
      create: { organizationId: "org-a", metric: "AI_TOKENS", periodStart, periodEnd, quantity: 42n },
      update: { quantity: { increment: 42n }, periodEnd },
    });
  });

  it("denies usage that would exceed the resolved plan limit", async () => {
    const tx = {
      subscription: { findUnique: jest.fn().mockResolvedValue({ plan: "STARTER" }) },
      organizationEntitlement: { findMany: jest.fn().mockResolvedValue([]) },
      usageCounter: { findUnique: jest.fn().mockResolvedValue({ quantity: 25n }) },
    };
    await expect(canConsumeUsage(tx as never, "org-a", "INTERVIEWS")).resolves.toBe(false);
  });
});
