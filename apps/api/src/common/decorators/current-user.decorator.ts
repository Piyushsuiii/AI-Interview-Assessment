import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { OrgRole } from "@ai-hiring-platform/auth";

export type AuthUser = {
  id: string;
  email: string;
  sessionId: string;
};

export type OrgContext = {
  organizationId: string;
  role: OrgRole;
  membershipId: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().orgContext as OrgContext;
});
