import { Module } from "@nestjs/common";
import { CandidateAuthModule } from "../candidate-auth/candidate-auth.module";
import { StorageModule } from "../storage/storage.module";
import { CandidatePortalController } from "./candidate-portal.controller";
import { CandidatePortalService } from "./candidate-portal.service";
import { ResumeIntelligenceModule } from "../resume-intelligence/resume-intelligence.module";

@Module({
  imports: [CandidateAuthModule, StorageModule, ResumeIntelligenceModule],
  controllers: [CandidatePortalController],
  providers: [CandidatePortalService],
})
export class CandidatePortalModule {}
