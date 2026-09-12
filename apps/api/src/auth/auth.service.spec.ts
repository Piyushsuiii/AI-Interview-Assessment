import { AuthService } from "./auth.service";
import { hashToken } from "../common/crypto";

describe("AuthService", () => {
  it("atomically rotates the stored refresh token hash", async () => {
    const oldToken = "old-refresh-token";
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-1",
          userId: "user-1",
          refreshTokenHash: hashToken(oldToken),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
      },
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "user-1",
        sid: "session-1",
        email: "user@example.com",
      }),
      signAsync: jest
        .fn()
        .mockResolvedValueOnce("new-access-token")
        .mockResolvedValueOnce("new-refresh-token"),
    };
    const config = { getOrThrow: jest.fn((key: string) => key) };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    const result = await service.refresh(oldToken, {});

    expect(result.tokens.refreshToken).toBe("new-refresh-token");
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ refreshTokenHash: hashToken(oldToken) }),
        data: expect.objectContaining({ refreshTokenHash: hashToken("new-refresh-token") }),
      }),
    );
  });

  it("rejects a replayed refresh token before signing replacements", async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-1",
          userId: "user-1",
          refreshTokenHash: hashToken("already-rotated-token"),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: "user-1", sid: "session-1" }),
      signAsync: jest.fn(),
    };
    const service = new AuthService(
      prisma as never,
      jwt as never,
      { getOrThrow: jest.fn(() => "secret") } as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(service.refresh("replayed-token", {})).rejects.toMatchObject({ status: 401 });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("consumes a password reset once and revokes every active session", async () => {
    const tx = {
      passwordResetToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      session: { updateMany: jest.fn() },
    };
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: "reset-1", userId: "user-1" }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const service = new AuthService(prisma as never, {} as never, {} as never, audit as never, {} as never);

    await expect(service.resetPassword({ token: "a".repeat(64), password: "NewPassword1" }, {})).resolves.toEqual({ passwordReset: true });

    expect(tx.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ usedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(tx.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", revokedAt: null },
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.password_reset_completed" }));
  });

  it("rejects a reset token lost to a concurrent consumer", async () => {
    const tx = { passwordResetToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const prisma = {
      passwordResetToken: { findUnique: jest.fn().mockResolvedValue({ id: "reset-1", userId: "user-1" }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.resetPassword({ token: "a".repeat(64), password: "NewPassword1" }, {})).rejects.toMatchObject({ status: 400 });
  });

  it("stores only a password reset hash and keeps the public response neutral", async () => {
    const passwordResetToken = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: "reset-1" }),
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }) },
      passwordResetToken,
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const mail = { sendPasswordReset: jest.fn() };
    const service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
      mail as never,
    );

    const result = await service.forgotPassword({ email: "user@example.com" }, {});

    const rawToken = mail.sendPasswordReset.mock.calls[0][1];
    const storedHash = passwordResetToken.create.mock.calls[0][0].data.tokenHash;
    expect(rawToken).toHaveLength(64);
    expect(storedHash).toBe(hashToken(rawToken));
    expect(storedHash).not.toBe(rawToken);
    expect(result).toEqual({ message: "If an account exists for that email, a reset link has been sent." });
  });
});
