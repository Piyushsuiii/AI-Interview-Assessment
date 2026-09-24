import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  candidateMagicLinkRequestSchema,
  candidateMagicLinkVerifySchema,
  type CandidateMagicLinkRequestInput,
  type CandidateMagicLinkVerifyInput,
} from "@ai-hiring-platform/validation";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CandidateAuthService } from "./candidate-auth.service";
import { CandidateAuthGuard } from "./candidate-auth.guard";
import { clearCandidateCookies, CANDIDATE_REFRESH_COOKIE, setCandidateCookies } from "./candidate-cookies";
import { CurrentCandidate, type CandidateAuthPrincipal } from "./current-candidate.decorator";

@Controller("candidate/auth")
export class CandidateAuthController {
  constructor(private readonly auth: CandidateAuthService) {}

  @Post("magic-link")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestLink(@Body(new SchemaPipe(candidateMagicLinkRequestSchema)) input: CandidateMagicLinkRequestInput, @Req() request: Request) {
    return this.auth.requestMagicLink(input, this.context(request));
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(
    @Body(new SchemaPipe(candidateMagicLinkVerifySchema)) input: CandidateMagicLinkVerifyInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { tokens, ...result } = await this.auth.verifyMagicLink(input, this.context(request));
    setCandidateCookies(response, tokens.accessToken, tokens.refreshToken);
    return result;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const { tokens, ...result } = await this.auth.refresh(request.cookies?.[CANDIDATE_REFRESH_COOKIE], this.context(request));
      setCandidateCookies(response, tokens.accessToken, tokens.refreshToken);
      return result;
    } catch (error) {
      clearCandidateCookies(response);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[CANDIDATE_REFRESH_COOKIE], this.context(request));
    clearCandidateCookies(response);
    return { loggedOut: true };
  }

  @Get("me")
  @UseGuards(CandidateAuthGuard)
  me(@CurrentCandidate() candidate: CandidateAuthPrincipal) {
    return this.auth.me(candidate.id);
  }

  private context(request: Request) {
    return { ipAddress: request.ip, userAgent: request.get("user-agent") };
  }
}
