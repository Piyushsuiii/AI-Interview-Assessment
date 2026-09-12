import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  updateOrganizationSchema,
  acceptInviteSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type AcceptInviteInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type UpdateOrganizationInput,
} from "@ai-hiring-platform/validation";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.organizations.list(user.id);
  }

  @Get(":orgId")
  @RequirePermissions("org:read")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  get(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.organizations.get(orgId, user.id);
  }

  @Patch(":orgId")
  @RequirePermissions("org:update")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  update(
    @Param("orgId") orgId: string,
    @Body(new SchemaPipe(updateOrganizationSchema)) input: UpdateOrganizationInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.organizations.update(orgId, input, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
  }

  @Get(":orgId/team")
  @RequirePermissions("team:read")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  team(@Param("orgId") orgId: string) {
    return this.organizations.team(orgId);
  }

  @Post(":orgId/invites")
  @RequirePermissions("team:invite")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  invite(@Param("orgId") orgId: string, @Body(new SchemaPipe(inviteMemberSchema)) input: InviteMemberInput, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.organizations.invite(orgId, input, this.context(user, req));
  }

  @Patch(":orgId/members/:memberId")
  @RequirePermissions("team:update_role")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  updateMember(@Param("orgId") orgId: string, @Param("memberId") memberId: string, @Body(new SchemaPipe(updateMemberRoleSchema)) input: UpdateMemberRoleInput, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.organizations.updateMemberRole(orgId, memberId, input, this.context(user, req));
  }

  @Delete(":orgId/members/:memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("team:remove")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  removeMember(@Param("orgId") orgId: string, @Param("memberId") memberId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.organizations.removeMember(orgId, memberId, this.context(user, req));
  }

  @Delete(":orgId/invites/:inviteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("team:invite")
  @UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
  revokeInvite(@Param("orgId") orgId: string, @Param("inviteId") inviteId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.organizations.revokeInvite(orgId, inviteId, this.context(user, req));
  }

  @Post("invites/accept")
  @UseGuards(JwtAuthGuard)
  acceptInvite(@Body(new SchemaPipe(acceptInviteSchema)) input: AcceptInviteInput, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.organizations.acceptInvite(input, user, this.context(user, req));
  }

  private context(user: AuthUser, req: Request) {
    return { userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent") };
  }
}
