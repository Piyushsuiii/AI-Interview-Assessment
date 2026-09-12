import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CandidateInterviewOrchestratorService } from "./candidate-interview-orchestrator.service";
import { InterviewsController } from "./interviews.controller";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [AuthModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, CandidateInterviewOrchestratorService, OrgContextGuard, PermissionsGuard],
  exports: [InterviewsService, CandidateInterviewOrchestratorService],
})
export class InterviewsModule {}
