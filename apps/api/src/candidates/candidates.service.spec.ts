import { GoneException, NotFoundException } from "@nestjs/common";
import { hashToken } from "../common/crypto";
import { CandidatesService } from "./candidates.service";

describe("CandidatesService", () => {
  it("does not create a candidate for a job owned by another tenant", async () => {
    const tx = {
      job: { findFirst: jest.fn().mockResolvedValue(null) },
      candidate: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() } as never,
    );

    await expect(
      service.create(
        "org-a",
        { email: "person@example.com", jobId: "00000000-0000-4000-8000-000000000001", status: "INVITED" },
        { userId: "user-1" },
      ),
    ).rejects.toMatchObject({ response: { code: "JOB_NOT_FOUND" } });
    expect(tx.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
    expect(tx.candidate.create).not.toHaveBeenCalled();
  });

  it("stores only a SHA-256 invitation hash", async () => {
    const tx = {
      candidate: {
        findFirst: jest.fn().mockResolvedValue({ id: "candidate-1", email: "person@example.com", jobId: "job-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      assessment: {
        findFirst: jest.fn().mockResolvedValue({ id: "assessment-1", jobId: "job-1", activeVersionId: "version-1" }),
      },
      interview: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: "interview-1", ...data })),
      },
      usageCounter: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      subscription: { findUnique: jest.fn().mockResolvedValue({ plan: "STARTER" }) },
      organizationEntitlement: { findMany: jest.fn().mockResolvedValue([]) },
      organizationMember: { findMany: jest.fn().mockResolvedValue([{ userId: "user-1" }]) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn().mockReturnValue("https://example.test") } as never,
      { afterTextAnswer: jest.fn() } as never,
      { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() } as never,
    );

    const result = await service.invite(
      "org-1",
      "candidate-1",
      { assessmentId: "assessment-1", expiresInHours: 72 },
      { userId: "user-1" },
    );

    const rawToken = result.invitationUrl.split("/").pop() as string;
    const stored = tx.interview.create.mock.calls[0][0].data.invitationTokenHash;
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).toBe(hashToken(rawToken));
    expect(stored).not.toBe(rawToken);
    expect(tx.usageCounter.upsert).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it("rejects expired invitations", async () => {
    const prisma = {
      interview: {
        findUnique: jest.fn().mockResolvedValue({
          id: "interview-1",
          state: "INVITED",
          invitationExpiresAt: new Date(Date.now() - 1_000),
        }),
      },
    };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() } as never,
    );

    await expect(service.getInvitation("a".repeat(64))).rejects.toBeInstanceOf(GoneException);
  });

  it("tenant-scopes candidate reads", async () => {
    const prisma = { candidate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() } as never,
    );

    await expect(service.get("org-a", "candidate-from-org-b")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "candidate-from-org-b", organizationId: "org-a" } }),
    );
  });

  it("tenant-scopes resume uploads before writing to storage", async () => {
    const prisma = { candidate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const storage = { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      storage as never,
    );
    const file = { originalname: "resume.pdf", mimetype: "application/pdf", size: 9, buffer: Buffer.from("%PDF-test") } as Express.Multer.File;

    await expect(service.uploadResume("org-a", "candidate-from-org-b", file, { userId: "user-1" })).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("uploads a validated resume and stores only private metadata", async () => {
    const prisma = {
      candidate: {
        findFirst: jest.fn().mockResolvedValue({ id: "candidate-1", resumeObjectKey: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const audit = { record: jest.fn() };
    const storage = { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn() };
    const service = new CandidatesService(
      prisma as never,
      audit as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      storage as never,
    );
    const file = { originalname: "../Piyush Resume.pdf", mimetype: "application/pdf", size: 9, buffer: Buffer.from("%PDF-test") } as Express.Multer.File;

    const result = await service.uploadResume("org-1", "candidate-1", file, { userId: "user-1" });

    expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/^organizations\/org-1\/candidates\/candidate-1\/resumes\/[a-f0-9-]+\.pdf$/), file.buffer, "application/pdf");
    expect(prisma.candidate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "candidate-1" },
      data: expect.objectContaining({ resumeFileName: "Piyush Resume.pdf", resumeUrl: null }),
    }));
    expect(result).toMatchObject({ fileName: "Piyush Resume.pdf", contentType: "application/pdf", size: 9 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "candidate.resume_uploaded", organizationId: "org-1" }));
  });

  it("returns a short-lived signed URL for a managed resume", async () => {
    const prisma = { candidate: { findFirst: jest.fn().mockResolvedValue({ resumeObjectKey: "private/key.pdf", resumeFileName: "resume.pdf", resumeUrl: null }) } };
    const storage = { putObject: jest.fn(), deleteObject: jest.fn(), getSignedDownloadUrl: jest.fn().mockResolvedValue("https://signed.example/resume") };
    const service = new CandidatesService(
      prisma as never,
      { record: jest.fn() } as never,
      { sendCandidateInvitation: jest.fn() } as never,
      { get: jest.fn() } as never,
      { afterTextAnswer: jest.fn() } as never,
      storage as never,
    );

    await expect(service.getResumeUrl("org-1", "candidate-1")).resolves.toMatchObject({ url: "https://signed.example/resume", managed: true });
    expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith("private/key.pdf", "resume.pdf", 300);
  });
});
