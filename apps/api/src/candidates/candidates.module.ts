import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CandidateInvitationsController } from "./candidate-invitations.controller";
import { InterviewsModule } from "../interviews/interviews.module";
import { CandidatesController } from "./candidates.controller";
import { CandidatesService } from "./candidates.service";

@Module({
  imports: [AuthModule, InterviewsModule],
  controllers: [CandidatesController, CandidateInvitationsController],
  providers: [CandidatesService, OrgContextGuard, PermissionsGuard],
})
export class CandidatesModule {}
