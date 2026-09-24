import { hashToken } from "../common/crypto";
import { CandidateAuthService } from "./candidate-auth.service";

describe("CandidateAuthService", () => {
  const prisma = {
    candidate: { findFirst: jest.fn() },
    candidateAccount: { findUnique: jest.fn(), upsert: jest.fn() },
    candidateMagicLink: { updateMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const mail = { sendCandidateMagicLink: jest.fn() };
  const audit = { record: jest.fn() };
  const config = {
    get: jest.fn((key: string) => ({ FRONTEND_URL: "http://localhost:3000", NODE_ENV: "development" })[key]),
  };
  const service = new CandidateAuthService(prisma as never, {} as never, config as never, mail as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
    prisma.candidateMagicLink.updateMany.mockResolvedValue({ count: 0 });
    prisma.candidateMagicLink.create.mockResolvedValue({ id: "link-1" });
  });

  it("returns the same response without creating a link for an unknown email", async () => {
    prisma.candidate.findFirst.mockResolvedValue(null);
    prisma.candidateAccount.findUnique.mockResolvedValue(null);

    const result = await service.requestMagicLink({ email: "unknown@example.com" }, {});

    expect(result).toEqual({ message: "If a candidate account exists for that email, a sign-in link has been sent." });
    expect(prisma.candidateAccount.upsert).not.toHaveBeenCalled();
    expect(mail.sendCandidateMagicLink).not.toHaveBeenCalled();
  });

  it("stores only a hash of the one-time token", async () => {
    prisma.candidate.findFirst.mockResolvedValue({ firstName: "Ada", lastName: "Lovelace" });
    prisma.candidateAccount.findUnique.mockResolvedValue(null);
    prisma.candidateAccount.upsert.mockResolvedValue({ id: "account-1" });

    const result = await service.requestMagicLink({ email: "ada@example.com" }, { ipAddress: "127.0.0.1" });
    const url = mail.sendCandidateMagicLink.mock.calls[0][1] as string;
    const rawToken = new URL(url).searchParams.get("token")!;
    const stored = prisma.candidateMagicLink.create.mock.calls[0][0].data.tokenHash;

    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).toBe(hashToken(rawToken));
    expect(stored).not.toBe(rawToken);
    expect(result.previewUrl).toBe(url);
  });
});
