import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  it("tenant-scopes every candidate comparison query", async () => {
    const prisma = { candidate: { findMany: jest.fn().mockResolvedValue([]) }, report: { findMany: jest.fn() } };
    const service = new ReportsService(prisma as never, { get: jest.fn() } as never);

    await expect(service.compare("org-a", {
      candidateIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
      includeNarrative: false,
    })).rejects.toMatchObject({ response: { code: "CANDIDATE_NOT_FOUND" } });
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-a" }),
    }));
  });
});
