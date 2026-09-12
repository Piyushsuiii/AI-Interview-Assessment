import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { interviewListQuerySchema, type InterviewListQuery } from "@ai-hiring-platform/validation";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { InterviewsService } from "./interviews.service";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";

@Controller("organizations/:orgId/interviews")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  @RequirePermissions("interviews:read")
  list(@Param("orgId") orgId: string, @Query(new SchemaPipe(interviewListQuerySchema)) query: InterviewListQuery) {
    return this.interviews.list(orgId, query);
  }

  @Get(":id")
  @RequirePermissions("interviews:read")
  get(@Param("orgId") orgId: string, @Param("id") id: string) { return this.interviews.get(orgId, id); }

  @Get(":id/replay")
  @RequirePermissions("interviews:read")
  replay(@Param("orgId") orgId: string, @Param("id") id: string) { return this.interviews.replay(orgId, id); }
}
