import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";

@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [JobsService, OrgContextGuard, PermissionsGuard],
})
export class JobsModule {}
