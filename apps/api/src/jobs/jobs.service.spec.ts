import { NotFoundException } from "@nestjs/common";
import { JobsService } from "./jobs.service";

describe("JobsService", () => {
  it("checks organization ownership before a nested update", async () => {
    const tx = {
      job: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new JobsService(prisma as never, { record: jest.fn() } as never);

    await expect(
      service.update("org-a", "job-from-org-b", { title: "Changed" }, { userId: "user-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.job.findFirst).toHaveBeenCalledWith({
      where: { id: "job-from-org-b", organizationId: "org-a" },
      select: { id: true },
    });
    expect(tx.job.update).not.toHaveBeenCalled();
  });

  it("replaces skills as a nested write after the tenant check", async () => {
    const tx = {
      job: {
        findFirst: jest.fn().mockResolvedValue({ id: "job-1" }),
        update: jest.fn().mockResolvedValue({ id: "job-1", skills: [] }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const service = new JobsService(prisma as never, audit as never);
    const skills = [{ name: "TypeScript", importance: "CRITICAL" as const }];

    await service.update("org-1", "job-1", { skills }, { userId: "user-1" });

    expect(tx.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { skills: { deleteMany: {}, create: skills } },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "job.updated", organizationId: "org-1" }),
    );
  });
});
