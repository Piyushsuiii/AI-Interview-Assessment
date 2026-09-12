import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllPermissions, type Permission } from "@ai-hiring-platform/auth";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { OrgContext } from "../decorators/current-user.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const orgContext = context.switchToHttp().getRequest().orgContext as OrgContext | undefined;
    if (!orgContext) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Missing organization context",
      });
    }

    if (!hasAllPermissions(orgContext.role, required)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSIONS",
        message: "You do not have permission to perform this action",
      });
    }

    return true;
  }
}
