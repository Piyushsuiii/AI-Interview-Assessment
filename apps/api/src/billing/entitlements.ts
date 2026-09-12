import type { BillingPlan, EntitlementKey, Prisma, UsageMetric } from "@prisma/client";

type PlanEntitlements = Record<EntitlementKey, { enabled: boolean; limit: bigint | null }>;

export const PLAN_ENTITLEMENTS: Record<BillingPlan, PlanEntitlements> = {
  STARTER: {
    MONTHLY_INTERVIEWS: { enabled: true, limit: 25n },
    MONTHLY_AI_TOKENS: { enabled: true, limit: 250_000n },
    TEAM_MEMBERS: { enabled: true, limit: 3n },
    ADVANCED_ANALYTICS: { enabled: false, limit: null },
  },
  GROWTH: {
    MONTHLY_INTERVIEWS: { enabled: true, limit: 250n },
    MONTHLY_AI_TOKENS: { enabled: true, limit: 3_000_000n },
    TEAM_MEMBERS: { enabled: true, limit: 15n },
    ADVANCED_ANALYTICS: { enabled: true, limit: null },
  },
  ENTERPRISE: {
    MONTHLY_INTERVIEWS: { enabled: true, limit: null },
    MONTHLY_AI_TOKENS: { enabled: true, limit: null },
    TEAM_MEMBERS: { enabled: true, limit: null },
    ADVANCED_ANALYTICS: { enabled: true, limit: null },
  },
};

export function calendarMonth(date = new Date()) {
  const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}

export async function incrementUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
  metric: UsageMetric,
  quantity: bigint,
  at = new Date(),
) {
  if (quantity <= 0n) return;
  const { periodStart, periodEnd } = calendarMonth(at);
  await tx.usageCounter.upsert({
    where: { organizationId_metric_periodStart: { organizationId, metric, periodStart } },
    create: { organizationId, metric, periodStart, periodEnd, quantity },
    update: { quantity: { increment: quantity }, periodEnd },
  });
}

export async function resolveEntitlements(tx: Prisma.TransactionClient, organizationId: string, plan: BillingPlan) {
  const overrides = await tx.organizationEntitlement.findMany({ where: { organizationId } });
  const resolved = { ...PLAN_ENTITLEMENTS[plan] };
  for (const override of overrides) {
    resolved[override.key] = {
      enabled: override.enabled ?? resolved[override.key].enabled,
      limit: override.limit ?? resolved[override.key].limit,
    };
  }
  return resolved;
}

export async function canConsumeUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
  metric: UsageMetric,
  quantity = 1n,
  at = new Date(),
) {
  const subscription = await tx.subscription.findUnique({ where: { organizationId }, select: { plan: true } });
  const plan = subscription?.plan ?? "STARTER";
  const key: EntitlementKey = metric === "INTERVIEWS" ? "MONTHLY_INTERVIEWS" : "MONTHLY_AI_TOKENS";
  const entitlements = await resolveEntitlements(tx, organizationId, plan);
  const entitlement = entitlements[key];
  if (!entitlement.enabled) return false;
  if (entitlement.limit === null) return true;
  const { periodStart } = calendarMonth(at);
  const counter = await tx.usageCounter.findUnique({
    where: { organizationId_metric_periodStart: { organizationId, metric, periodStart } },
    select: { quantity: true },
  });
  return (counter?.quantity ?? 0n) + quantity <= entitlement.limit;
}
