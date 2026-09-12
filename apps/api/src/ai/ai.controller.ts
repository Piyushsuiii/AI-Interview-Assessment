import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { AiService } from "./ai.service";

const analyzeJobSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(40).max(20_000),
});

@Controller("organizations/:orgId/ai")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("job-analysis")
  @RequirePermissions("jobs:write")
  analyzeJob(
    @Param("orgId") organizationId: string,
    @CurrentUser() user: AuthUser,
    @Body(new SchemaPipe(analyzeJobSchema)) input: z.infer<typeof analyzeJobSchema>,
  ) {
    return this.ai.analyzeJob(organizationId, user.id, input);
  }
}
