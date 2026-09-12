import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ReportsModule } from "../reports/reports.module";
import { CopilotController } from "./copilot.controller";
import { CopilotService } from "./copilot.service";

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [CopilotController],
  providers: [CopilotService, OrgContextGuard, PermissionsGuard],
  exports: [CopilotService],
})
export class CopilotModule {}
