import { NotFoundException } from "@nestjs/common";
import { InterviewsService } from "./interviews.service";

describe("InterviewsService", () => {
  it("paginates and tenant-scopes the review queue", async () => {
    const prisma = { interview: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) }, $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)) };
    const service = new InterviewsService(prisma as never);
    await service.list("org-a", { page: 2, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
    expect(prisma.interview.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }), skip: 10, take: 10 }));
  });

  it("tenant-scopes recruiter interview reads", async () => {
    const prisma = { interview: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new InterviewsService(prisma as never);

    await expect(service.get("org-a", "interview-from-org-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.interview.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "interview-from-org-b", organizationId: "org-a" },
    }));
  });
});
