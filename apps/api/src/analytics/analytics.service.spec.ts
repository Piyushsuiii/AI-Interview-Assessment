import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  it("scopes every aggregation and returns stable empty analytics", async () => {
    const prisma = {
      interview: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      candidate: { groupBy: jest.fn().mockResolvedValue([]) },
      competencyEvaluation: { groupBy: jest.fn().mockResolvedValue([]) },
      assessment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new AnalyticsService(prisma as never).get("org-a", {});
    expect(result.completion).toEqual({ total: 0, completed: 0, rate: 0 });
    expect(prisma.interview.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    expect(prisma.candidate.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    expect(prisma.competencyEvaluation.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { evaluation: expect.objectContaining({ organizationId: "org-a" }) } }));
  });
});
