import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CandidateInvitationsController } from "./candidate-invitations.controller";
import { InterviewsModule } from "../interviews/interviews.module";
import { CandidatesController } from "./candidates.controller";
import { CandidatesService } from "./candidates.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [AuthModule, InterviewsModule, StorageModule],
  controllers: [CandidatesController, CandidateInvitationsController],
  providers: [CandidatesService, OrgContextGuard, PermissionsGuard],
})
export class CandidatesModule {}
