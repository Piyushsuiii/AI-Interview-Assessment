import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OrgContextGuard, PermissionsGuard],
})
export class AnalyticsModule {}
