import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC } from "../decorators/permissions.decorator";
import { ACCESS_COOKIE } from "../cookies";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; email: string }>(
        token,
        { secret: this.config.getOrThrow("JWT_ACCESS_SECRET") },
      );

      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.userId !== payload.sub
      ) {
        throw new UnauthorizedException({
          code: "UNAUTHORIZED",
          message: "Session is no longer valid",
        });
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        sessionId: payload.sid,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Invalid or expired session",
      });
    }
  }

  private extractToken(request: { cookies?: Record<string, string>; headers: Record<string, string> }) {
    const cookieToken = request.cookies?.[ACCESS_COOKIE];
    if (cookieToken) {
      return cookieToken;
    }
    const header = request.headers.authorization || request.headers.Authorization;
    if (header?.startsWith("Bearer ")) {
      return header.slice(7);
    }
    return null;
  }
}
