import { BadRequestException } from "@nestjs/common";
import { CopilotService } from "./copilot.service";

describe("CopilotService", () => {
  it("rejects narrative references to candidates not retrieved by its tool", () => {
    const service = new CopilotService({} as never, { get: jest.fn() } as never, {} as never);
    expect(() => service.assertGrounded(["candidate-1", "candidate-other"], new Set(["candidate-1"])))
      .toThrow(BadRequestException);
  });

  it("applies the tenant filter to structured candidate tools", async () => {
    const prisma = { candidate: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CopilotService(prisma as never, { get: jest.fn() } as never, {} as never);

    const result = await service.query("org-a", { tool: "list_candidates", filters: { limit: 20 }, includeNarrative: false });

    expect(result).toEqual({ tool: "list_candidates", records: [], narrative: null });
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-a" }),
    }));
  });
});
