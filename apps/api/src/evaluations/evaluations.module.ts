import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { EvaluationsController } from "./evaluations.controller";
import { EvaluationsService } from "./evaluations.service";

@Module({
  imports: [AuthModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, OrgContextGuard, PermissionsGuard],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
