import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { hashToken } from "../common/crypto";
import { CandidatePortalService } from "./candidate-portal.service";

describe("CandidatePortalService", () => {
  const prisma = {
    interview: { findFirst: jest.fn(), update: jest.fn() },
    candidateAccount: { findUnique: jest.fn() },
    candidate: { findFirst: jest.fn(), update: jest.fn() },
  };
  const storage = {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const resumeIntelligence = { classify: jest.fn().mockResolvedValue(null) };
  const service = new CandidatePortalService(prisma as never, storage as never, audit as never, resumeIntelligence as never);

  beforeEach(() => jest.clearAllMocks());

  it("does not issue an interview link without candidate ownership", async () => {
    prisma.interview.findFirst.mockResolvedValue(null);
    await expect(service.createInterviewAccessLink("account-1", "interview-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.interview.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "interview-1", candidate: { candidateAccountId: "account-1" } },
    }));
  });

  it("does not reopen a completed interview", async () => {
    prisma.interview.findFirst.mockResolvedValue({ id: "interview-1", state: "COMPLETED" });
    await expect(service.createInterviewAccessLink("account-1", "interview-1")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.interview.update).not.toHaveBeenCalled();
  });

  it("stores a hash while returning the raw interview token", async () => {
    prisma.interview.findFirst.mockResolvedValue({ id: "interview-1", state: "INVITED" });
    prisma.interview.update.mockResolvedValue({});
    const result = await service.createInterviewAccessLink("account-1", "interview-1");
    const rawToken = result.url.split("/").at(-1)!;
    expect(prisma.interview.update.mock.calls[0][0].data.invitationTokenHash).toBe(hashToken(rawToken));
    expect(prisma.interview.update.mock.calls[0][0].data.invitationTokenHash).not.toBe(rawToken);
  });

  it("uses an explicit export allowlist without employer evaluations or hidden tests", async () => {
    prisma.candidateAccount.findUnique.mockResolvedValue({ id: "account-1" });
    await service.exportData("account-1");
    const interviewSelect = prisma.candidateAccount.findUnique.mock.calls[0][0].select.candidates.select.interviews.select;
    expect(interviewSelect.evaluation).toBeUndefined();
    expect(interviewSelect.integrityEvents).toBeUndefined();
    expect(interviewSelect.codingChallenge).toBeUndefined();
    expect(interviewSelect.codeSubmissions.select).toEqual(expect.objectContaining({ code: true, language: true }));
  });

  it("rejects a non-PDF filename before loading the candidate", async () => {
    const file = { originalname: "resume.txt", mimetype: "application/pdf", size: 9, buffer: Buffer.from("%PDF-test") } as Express.Multer.File;

    await expect(service.uploadResume("account-1", "candidate-1", file)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.candidate.findFirst).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("uploads a private resume and sanitizes its displayed filename", async () => {
    prisma.candidate.findFirst.mockResolvedValue({ id: "candidate-1", organizationId: "org-1", resumeObjectKey: null, resumeFileName: null, resumeUrl: "https://legacy.example/resume.pdf" });
    prisma.candidate.update.mockResolvedValue({});
    const file = { originalname: "../Candidate Resume.pdf", mimetype: "application/pdf", size: 9, buffer: Buffer.from("%PDF-test") } as Express.Multer.File;

    await expect(service.uploadResume("account-1", "candidate-1", file)).resolves.toMatchObject({ fileName: "Candidate Resume.pdf", sizeBytes: 9 });

    expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/^organizations\/org-1\/candidates\/candidate-1\/resumes\/.+\.pdf$/), file.buffer, "application/pdf");
    expect(prisma.candidate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "candidate-1" },
      data: expect.objectContaining({ resumeUrl: null, resumeFileName: "Candidate Resume.pdf" }),
    }));
  });

  it("removes a newly uploaded object when the database update fails", async () => {
    prisma.candidate.findFirst.mockResolvedValue({ id: "candidate-1", organizationId: "org-1", resumeObjectKey: null, resumeFileName: null, resumeUrl: null });
    prisma.candidate.update.mockRejectedValue(new Error("database unavailable"));
    const file = { originalname: "resume.pdf", mimetype: "application/pdf", size: 9, buffer: Buffer.from("%PDF-test") } as Express.Multer.File;

    await expect(service.uploadResume("account-1", "candidate-1", file)).rejects.toThrow("database unavailable");
    const objectKey = storage.putObject.mock.calls[0][0];
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it("clears resume metadata even when old object cleanup fails", async () => {
    prisma.candidate.findFirst.mockResolvedValue({ id: "candidate-1", organizationId: "org-1", resumeObjectKey: "old/resume.pdf", resumeFileName: "resume.pdf", resumeUrl: null });
    prisma.candidate.update.mockResolvedValue({});
    storage.deleteObject.mockRejectedValue(new Error("storage unavailable"));

    await expect(service.deleteResume("account-1", "candidate-1")).resolves.toEqual({ deleted: true });
    expect(prisma.candidate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resumeObjectKey: null, resumeUrl: null, resumeFileName: null }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "candidate.resume_deleted", organizationId: "org-1" }));
  });
});
