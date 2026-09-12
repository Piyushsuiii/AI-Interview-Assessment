import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Authentication required for organization access",
      });
    }

    const organizationId =
      request.params?.orgId ||
      request.params?.id ||
      request.headers["x-org-id"] ||
      request.query?.organizationId;

    if (!organizationId || typeof organizationId !== "string") {
      throw new ForbiddenException({
        code: "ORG_CONTEXT_REQUIRED",
        message: "Organization context is required",
      });
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.organization.deletedAt) {
      throw new ForbiddenException({
        code: "ORG_ACCESS_DENIED",
        message: "You do not have access to this organization",
      });
    }

    request.orgContext = {
      organizationId: membership.organizationId,
      role: membership.role,
      membershipId: membership.id,
    };
    return true;
  }
}
