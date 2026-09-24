import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { CANDIDATE_ACCESS_COOKIE } from "./candidate-cookies";

@Injectable()
export class CandidateAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[CANDIDATE_ACCESS_COOKIE];
    if (!token) this.unauthorized();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; email: string; typ: string }>(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        audience: "ai-hiring-candidate",
        issuer: "ai-hiring-api",
      });
      if (payload.typ !== "candidate") this.unauthorized();
      const session = await this.prisma.candidateSession.findUnique({
        where: { id: payload.sid },
        include: { candidateAccount: { select: { id: true, email: true, disabledAt: true } } },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || session.candidateAccountId !== payload.sub || session.candidateAccount.disabledAt) {
        this.unauthorized();
      }
      request.candidate = { id: session.candidateAccount.id, email: session.candidateAccount.email, sessionId: session.id };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.unauthorized();
    }
  }

  private unauthorized(): never {
    throw new UnauthorizedException({ code: "CANDIDATE_UNAUTHORIZED", message: "Candidate authentication required" });
  }
}
