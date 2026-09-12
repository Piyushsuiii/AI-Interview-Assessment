import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CandidateIntegrityController, RecruiterIntegrityController } from "./integrity.controller";
import { IntegrityService } from "./integrity.service";

@Module({
  imports: [AuthModule],
  controllers: [CandidateIntegrityController, RecruiterIntegrityController],
  providers: [IntegrityService, OrgContextGuard, PermissionsGuard],
})
export class IntegrityModule {}
