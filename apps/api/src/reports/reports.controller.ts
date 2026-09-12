import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { compareCandidatesSchema, type CompareCandidatesInput } from "@ai-hiring-platform/validation";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { ReportsService } from "./reports.service";

@Controller("organizations/:orgId/reports")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("interviews/:interviewId")
  @RequirePermissions("interviews:read")
  get(@Param("orgId") orgId: string, @Param("interviewId") interviewId: string) { return this.reports.getByInterview(orgId, interviewId); }

  @Post("compare")
  @RequirePermissions("interviews:read")
  compare(@Param("orgId") orgId: string, @Body(new SchemaPipe(compareCandidatesSchema)) input: CompareCandidatesInput, @CurrentUser() user: AuthUser) {
    return this.reports.compare(orgId, input, user.id);
  }
}
