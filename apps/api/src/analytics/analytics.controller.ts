import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { analyticsQuerySchema, type AnalyticsQuery } from "@ai-hiring-platform/validation";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { AnalyticsService } from "./analytics.service";

@Controller("organizations/:orgId/analytics")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @RequirePermissions("interviews:read")
  get(@Param("orgId") orgId: string, @Query(new SchemaPipe(analyticsQuerySchema)) query: AnalyticsQuery) {
    return this.analytics.get(orgId, query);
  }
}
