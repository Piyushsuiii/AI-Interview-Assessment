import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { copilotQuerySchema, type CopilotQueryInput } from "@ai-hiring-platform/validation";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CopilotService } from "./copilot.service";

@Controller("organizations/:orgId/copilot")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post("query")
  @RequirePermissions("interviews:read")
  query(@Param("orgId") orgId: string, @Body(new SchemaPipe(copilotQuerySchema)) input: CopilotQueryInput, @CurrentUser() user: AuthUser) {
    return this.copilot.query(orgId, input, user.id);
  }
}
