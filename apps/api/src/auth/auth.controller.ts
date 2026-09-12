import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
  type VerifyEmailInput,
} from "@ai-hiring-platform/validation";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "../common/cookies";
import { randomBytes } from "crypto";
import { Throttle } from "@nestjs/throttler";

const GOOGLE_STATE_COOKIE = "google_oauth_state";

@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get("google")
  google(@Res() res: Response) {
    const state = randomBytes(32).toString("base64url");
    res.cookie(GOOGLE_STATE_COOKIE, state, this.oauthCookie());
    return res.redirect(this.auth.googleAuthorizationUrl(state));
  }

  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const expectedState = req.cookies?.[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE, this.oauthCookie());
    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(this.auth.frontendAuthError("invalid_oauth_state"));
    }
    try {
      const { tokens } = await this.auth.loginWithGoogle(code, this.context(req));
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.redirect(this.auth.frontendDashboardUrl());
    } catch {
      return res.redirect(this.auth.frontendAuthError("google_auth_failed"));
    }
  }

  @Public()
  @Post("signup")
  async signup(
    @Body(new SchemaPipe(signupSchema)) input: SignupInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, ...result } = await this.auth.signup(input, this.context(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return result;
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new SchemaPipe(loginSchema)) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, ...result } = await this.auth.login(input, this.context(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return result;
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(
    @Body(new SchemaPipe(forgotPasswordSchema)) input: ForgotPasswordInput,
    @Req() req: Request,
  ) {
    return this.auth.forgotPassword(input, this.context(req));
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(
    @Body(new SchemaPipe(resetPasswordSchema)) input: ResetPasswordInput,
    @Req() req: Request,
  ) {
    return this.auth.resetPassword(input, this.context(req));
  }

  @Public()
  @Post("email-verification/request")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestEmailVerification(
    @Body(new SchemaPipe(forgotPasswordSchema)) input: ForgotPasswordInput,
    @Req() req: Request,
  ) {
    return this.auth.requestEmailVerification(input, this.context(req));
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmail(
    @Body(new SchemaPipe(verifyEmailSchema)) input: VerifyEmailInput,
    @Req() req: Request,
  ) {
    return this.auth.verifyEmail(input, this.context(req));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { tokens, ...result } = await this.auth.refresh(
        req.cookies?.[REFRESH_COOKIE],
        this.context(req),
      );
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
      return result;
    } catch (error) {
      clearAuthCookies(res);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      await this.auth.logout(req.cookies?.[REFRESH_COOKIE], this.context(req));
    } finally {
      clearAuthCookies(res);
    }
    return { loggedOut: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private context(req: Request) {
    return { ipAddress: req.ip, userAgent: req.get("user-agent") };
  }

  private oauthCookie() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/v1/auth/google/callback",
      maxAge: 10 * 60 * 1000,
    };
  }
}
