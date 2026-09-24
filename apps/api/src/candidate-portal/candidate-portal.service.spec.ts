import { ConflictException, NotFoundException } from "@nestjs/common";
import { hashToken } from "../common/crypto";
import { CandidatePortalService } from "./candidate-portal.service";

describe("CandidatePortalService", () => {
  const prisma = {
    interview: { findFirst: jest.fn(), update: jest.fn() },
    candidateAccount: { findUnique: jest.fn() },
  };
  const service = new CandidatePortalService(prisma as never, {} as never, {} as never);

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
});
