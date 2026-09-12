import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from "@ai-hiring-platform/validation";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { createRawToken, hashPassword, hashToken, verifyPassword } from "../common/crypto";
import { MailService } from "../mail/mail.service";

type RequestContext = { ipAddress?: string; userAgent?: string };
type TokenUser = { id: string; email: string };
type GoogleProfile = { sub: string; email: string; email_verified?: boolean; given_name?: string; family_name?: string; picture?: string };

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async signup(input: SignupInput, context: RequestContext) {
    const passwordHash = await hashPassword(input.password);
    const slug = `${this.slugify(input.organizationName)}-${randomUUID().slice(0, 8)}`;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
          },
          select: userSelect,
        });
        const organization = await tx.organization.create({
          data: {
            name: input.organizationName,
            slug,
            createdById: user.id,
            members: { create: { userId: user.id, role: "OWNER" } },
            subscription: { create: { plan: "STARTER", status: "ACTIVE" } },
          },
          select: { id: true, name: true, slug: true },
        });
        return { user, organization };
      });

      const tokens = await this.createSession(created.user, context);
      await this.audit.record({
        action: "auth.signup",
        userId: created.user.id,
        organizationId: created.organization.id,
        ...context,
      });
      await this.issueEmailVerification(created.user.id, created.user.email, context);
      return { ...created, tokens };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "EMAIL_IN_USE", message: "Email is already in use" });
      }
      throw error;
    }
  }

  async login(input: LoginInput, context: RequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
      select: { ...userSelect, passwordHash: true },
    });
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    const tokens = await this.createSession(safeUser, context);
    await this.audit.record({ action: "auth.login", userId: user.id, ...context });
    return { user: safeUser, tokens };
  }

  async forgotPassword(input: ForgotPasswordInput, context: RequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null, passwordHash: { not: null } },
      select: { id: true, email: true },
    });
    if (user) {
      try {
        const token = createRawToken();
        await this.prisma.$transaction([
          this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          }),
          this.prisma.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
          }),
        ]);
        await this.audit.record({ action: "auth.password_reset_requested", userId: user.id, ...context });
        await this.mail.sendPasswordReset(user.email, token);
      } catch {
        // Keep account existence and delivery failures indistinguishable to callers.
      }
    }
    return { message: "If an account exists for that email, a reset link has been sent." };
  }

  async resetPassword(input: ResetPasswordInput, context: RequestContext) {
    const tokenHash = hashToken(input.token);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!token) this.invalidOneTimeToken("INVALID_RESET_TOKEN", "Reset link is invalid or expired");

    const passwordHash = await hashPassword(input.password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) this.invalidOneTimeToken("INVALID_RESET_TOKEN", "Reset link is invalid or expired");
      const updatedUser = await tx.user.updateMany({
        where: { id: token.userId, deletedAt: null },
        data: { passwordHash },
      });
      if (updatedUser.count !== 1) this.invalidOneTimeToken("INVALID_RESET_TOKEN", "Reset link is invalid or expired");
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });
    });
    await this.audit.record({ action: "auth.password_reset_completed", userId: token.userId, ...context });
    return { passwordReset: true };
  }

  async requestEmailVerification(input: ForgotPasswordInput, context: RequestContext) {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null, emailVerifiedAt: null },
      select: { id: true, email: true },
    });
    if (user) await this.issueEmailVerification(user.id, user.email, context);
    return { message: "If the account needs verification, a new link has been sent." };
  }

  async verifyEmail(input: VerifyEmailInput, context: RequestContext) {
    const tokenHash = hashToken(input.token);
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!token) this.invalidOneTimeToken("INVALID_VERIFICATION_TOKEN", "Verification link is invalid or expired");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) this.invalidOneTimeToken("INVALID_VERIFICATION_TOKEN", "Verification link is invalid or expired");
      const updatedUser = await tx.user.updateMany({
        where: { id: token.userId, deletedAt: null },
        data: { emailVerifiedAt: now },
      });
      if (updatedUser.count !== 1) this.invalidOneTimeToken("INVALID_VERIFICATION_TOKEN", "Verification link is invalid or expired");
      await tx.emailVerificationToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });
    });
    await this.audit.record({ action: "auth.email_verified", userId: token.userId, ...context });
    return { emailVerified: true };
  }

  googleAuthorizationUrl(state: string) {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const callbackUrl = this.config.get<string>("GOOGLE_CALLBACK_URL");
    if (!clientId || !callbackUrl) {
      throw new UnauthorizedException({ code: "GOOGLE_NOT_CONFIGURED", message: "Google authentication is not configured" });
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async loginWithGoogle(code: string, context: RequestContext) {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_CALLBACK_URL");
    if (!clientId || !clientSecret || !redirectUri) this.invalidGoogle();

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !tokenData.access_token) this.invalidGoogle();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified === false) this.invalidGoogle();

    const email = profile.email.toLowerCase().trim();
    const user = await this.prisma.$transaction(async (tx) => {
      const account = await tx.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
        include: { user: true },
      });
      if (account?.user && !account.user.deletedAt) return account.user;

      const existing = await tx.user.findUnique({ where: { email } });
      if (existing?.deletedAt) this.invalidGoogle();
      if (existing) {
        await tx.oAuthAccount.create({ data: { provider: "google", providerAccountId: profile.sub, userId: existing.id } });
        return tx.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), avatarUrl: existing.avatarUrl ?? profile.picture, lastLoginAt: new Date() } });
      }

      const created = await tx.user.create({
        data: {
          email,
          firstName: profile.given_name,
          lastName: profile.family_name,
          avatarUrl: profile.picture,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          accounts: { create: { provider: "google", providerAccountId: profile.sub } },
        },
      });
      const organizationName = profile.given_name ? `${profile.given_name}'s workspace` : "My workspace";
      await tx.organization.create({
        data: { name: organizationName, slug: `${this.slugify(organizationName)}-${randomUUID().slice(0, 8)}`, createdById: created.id, members: { create: { userId: created.id, role: "OWNER" } }, subscription: { create: { plan: "STARTER", status: "ACTIVE" } } },
      });
      return created;
    });
    const tokens = await this.createSession(user, context);
    await this.audit.record({ action: "auth.google_login", userId: user.id, ...context });
    return { tokens };
  }

  frontendDashboardUrl() {
    return `${this.config.get("FRONTEND_URL") ?? "http://localhost:3000"}/dashboard`;
  }

  frontendAuthError(code: string) {
    return `${this.config.get("FRONTEND_URL") ?? "http://localhost:3000"}/login?error=${encodeURIComponent(code)}`;
  }

  async refresh(refreshToken: string | undefined, context: RequestContext) {
    if (!refreshToken) this.invalidRefresh();

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; email: string }>(
        refreshToken,
        { secret: this.config.getOrThrow("JWT_REFRESH_SECRET") },
      );
      const currentHash = hashToken(refreshToken);
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.refreshTokenHash !== currentHash ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        this.invalidRefresh();
      }

      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: userSelect,
      });
      if (!user) this.invalidRefresh();

      const tokens = await this.signTokens(user, session.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const rotated = await this.prisma.session.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: currentHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          refreshTokenHash: hashToken(tokens.refreshToken),
          expiresAt,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
      });
      if (rotated.count !== 1) this.invalidRefresh();
      return { user, tokens };
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
        ignoreExpiration: true,
      });
      await this.prisma.session.updateMany({
        where: {
          id: payload.sid,
          userId: payload.sub,
          refreshTokenHash: hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ action: "auth.logout", userId: payload.sub, ...context });
    } catch {
      // Logout is idempotent and still clears unusable client cookies.
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        ...userSelect,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
          where: { organization: { deletedAt: null } },
        },
      },
    });
    if (!user) throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "User not found" });
    const { memberships, ...safeUser } = user;
    return {
      user: safeUser,
      organizations: memberships.map(({ role, organization }) => ({ ...organization, role })),
    };
  }

  private async createSession(user: TokenUser, context: RequestContext) {
    const sessionId = randomUUID();
    const tokens = await this.signTokens(user, sessionId);
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });
    return tokens;
  }

  private async issueEmailVerification(userId: string, email: string, context: RequestContext) {
    try {
      const token = createRawToken();
      await this.prisma.$transaction([
        this.prisma.emailVerificationToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: new Date() },
        }),
        this.prisma.emailVerificationToken.create({
          data: {
            userId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }),
      ]);
      await this.audit.record({ action: "auth.email_verification_requested", userId, ...context });
      await this.mail.sendEmailVerification(email, token);
    } catch {
      // Signup and neutral resend responses must not disclose provider availability.
    }
  }

  private async signTokens(user: TokenUser, sessionId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: user.id, sid: sessionId, email: user.email, jti: randomUUID() }, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        expiresIn: 15 * 60,
      }),
      this.jwt.signAsync({ sub: user.id, sid: sessionId, email: user.email, jti: randomUUID() }, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: 7 * 24 * 60 * 60,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 38) || "organization";
  }

  private invalidRefresh(): never {
    throw new UnauthorizedException({
      code: "INVALID_REFRESH_TOKEN",
      message: "Refresh token is invalid or expired",
    });
  }

  private invalidGoogle(): never {
    throw new UnauthorizedException({ code: "GOOGLE_AUTH_FAILED", message: "Google authentication failed" });
  }

  private invalidOneTimeToken(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }
}
