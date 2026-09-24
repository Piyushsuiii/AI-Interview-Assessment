import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { CandidateMagicLinkRequestInput, CandidateMagicLinkVerifyInput } from "@ai-hiring-platform/validation";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { createRawToken, hashToken } from "../common/crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

type RequestContext = { ipAddress?: string; userAgent?: string };
type CandidateIdentity = { id: string; email: string; firstName: string | null; lastName: string | null };

const candidateAccountSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  emailVerifiedAt: true,
  privacyConsentAt: true,
  createdAt: true,
} as const;

@Injectable()
export class CandidateAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async requestMagicLink(input: CandidateMagicLinkRequestInput, context: RequestContext) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { email: input.email },
      orderBy: { createdAt: "desc" },
      select: { firstName: true, lastName: true },
    });
    const existing = await this.prisma.candidateAccount.findUnique({ where: { email: input.email }, select: { id: true } });
    if (candidate || existing) {
      const account = existing ?? await this.prisma.candidateAccount.upsert({
        where: { email: input.email },
        create: { email: input.email, firstName: candidate?.firstName, lastName: candidate?.lastName },
        update: {},
        select: { id: true },
      });
      const token = createRawToken();
      await this.prisma.$transaction([
        this.prisma.candidateMagicLink.updateMany({
          where: { candidateAccountId: account.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        this.prisma.candidateMagicLink.create({
          data: { candidateAccountId: account.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
        }),
      ]);
      const url = `${this.config.get("FRONTEND_URL") ?? "http://localhost:3000"}/candidate/verify?token=${token}`;
      await this.mail.sendCandidateMagicLink(input.email, url);
      await this.audit.record({ action: "candidate.auth_link_requested", ...context, metadata: { candidateAccountId: account.id } });
      return {
        message: "If a candidate account exists for that email, a sign-in link has been sent.",
        ...(this.config.get("NODE_ENV") === "development" && !this.config.get("RESEND_API_KEY") ? { previewUrl: url } : {}),
      };
    }
    return { message: "If a candidate account exists for that email, a sign-in link has been sent." };
  }

  async verifyMagicLink(input: CandidateMagicLinkVerifyInput, context: RequestContext) {
    const tokenHash = hashToken(input.token);
    const link = await this.prisma.candidateMagicLink.findUnique({
      where: { tokenHash },
      include: { candidateAccount: { select: { ...candidateAccountSelect, disabledAt: true } } },
    });
    if (!link || link.usedAt || link.expiresAt <= new Date() || link.candidateAccount.disabledAt) this.invalidLink();
    const now = new Date();
    const account = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.candidateMagicLink.updateMany({
        where: { id: link.id, tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) this.invalidLink();
      await transaction.candidate.updateMany({
        where: { email: link.candidateAccount.email, candidateAccountId: null },
        data: { candidateAccountId: link.candidateAccount.id, claimedAt: now },
      });
      return transaction.candidateAccount.update({
        where: { id: link.candidateAccount.id },
        data: { emailVerifiedAt: link.candidateAccount.emailVerifiedAt ?? now, lastLoginAt: now },
        select: candidateAccountSelect,
      });
    });
    const tokens = await this.createSession(account, context);
    await this.audit.record({ action: "candidate.authenticated", ...context, metadata: { candidateAccountId: account.id } });
    return { account, tokens };
  }

  async refresh(refreshToken: string | undefined, context: RequestContext) {
    if (!refreshToken) this.invalidRefresh();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; email: string; typ: string }>(refreshToken, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        audience: "ai-hiring-candidate",
        issuer: "ai-hiring-api",
      });
      if (payload.typ !== "candidate_refresh") this.invalidRefresh();
      const currentHash = hashToken(refreshToken);
      const session = await this.prisma.candidateSession.findUnique({ where: { id: payload.sid } });
      const account = await this.prisma.candidateAccount.findFirst({
        where: { id: payload.sub, disabledAt: null },
        select: candidateAccountSelect,
      });
      if (!session || !account || session.candidateAccountId !== account.id || session.refreshTokenHash !== currentHash || session.revokedAt || session.expiresAt <= new Date()) {
        this.invalidRefresh();
      }
      const tokens = await this.signTokens(account, session.id);
      const rotated = await this.prisma.candidateSession.updateMany({
        where: { id: session.id, refreshTokenHash: currentHash, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { refreshTokenHash: hashToken(tokens.refreshToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), ...context },
      });
      if (rotated.count !== 1) this.invalidRefresh();
      return { account, tokens };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.invalidRefresh();
    }
  }

  async logout(refreshToken: string | undefined, context: RequestContext) {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(refreshToken, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        audience: "ai-hiring-candidate",
        issuer: "ai-hiring-api",
        ignoreExpiration: true,
      });
      await this.prisma.candidateSession.updateMany({
        where: { id: payload.sid, candidateAccountId: payload.sub, refreshTokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ action: "candidate.logout", ...context, metadata: { candidateAccountId: payload.sub } });
    } catch {
      return;
    }
  }

  me(accountId: string) {
    return this.prisma.candidateAccount.findFirst({ where: { id: accountId, disabledAt: null }, select: candidateAccountSelect });
  }

  private async createSession(account: CandidateIdentity, context: RequestContext) {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(account, sessionId);
    await this.prisma.candidateSession.create({
      data: {
        id: sessionId,
        candidateAccountId: account.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ...context,
      },
    });
    return tokens;
  }

  private async signTokens(account: CandidateIdentity, sessionId: string) {
    const base = { sub: account.id, sid: sessionId, email: account.email };
    const options = { audience: "ai-hiring-candidate", issuer: "ai-hiring-api" };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, typ: "candidate" }, { ...options, secret: this.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: "15m" }),
      this.jwt.signAsync({ ...base, typ: "candidate_refresh" }, { ...options, secret: this.config.getOrThrow("JWT_REFRESH_SECRET"), expiresIn: "7d" }),
    ]);
    return { accessToken, refreshToken };
  }

  private invalidLink(): never {
    throw new UnauthorizedException({ code: "INVALID_MAGIC_LINK", message: "Sign-in link is invalid or expired" });
  }

  private invalidRefresh(): never {
    throw new UnauthorizedException({ code: "INVALID_CANDIDATE_REFRESH", message: "Candidate session is invalid or expired" });
  }
}
