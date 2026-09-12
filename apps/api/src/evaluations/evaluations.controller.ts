import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { evaluateInterviewSchema, overrideEvaluationSchema, type EvaluateInterviewInput, type OverrideEvaluationInput } from "@ai-hiring-platform/validation";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { EvaluationsService } from "./evaluations.service";

@Controller("organizations/:orgId/interviews/:id")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Post("evaluate")
  @RequirePermissions("interviews:write")
  evaluate(@Param("orgId") orgId: string, @Param("id") id: string, @Body(new SchemaPipe(evaluateInterviewSchema)) input: EvaluateInterviewInput, @CurrentUser() user: AuthUser) {
    return this.evaluations.evaluate(orgId, id, input, user.id);
  }

  @Get("evaluation")
  @RequirePermissions("interviews:read")
  get(@Param("orgId") orgId: string, @Param("id") id: string) { return this.evaluations.get(orgId, id); }

  @Patch("evaluation/override")
  @RequirePermissions("interviews:write")
  override(@Param("orgId") orgId: string, @Param("id") id: string, @Body(new SchemaPipe(overrideEvaluationSchema)) input: OverrideEvaluationInput, @CurrentUser() user: AuthUser) {
    return this.evaluations.override(orgId, id, input, user.id);
  }
}
