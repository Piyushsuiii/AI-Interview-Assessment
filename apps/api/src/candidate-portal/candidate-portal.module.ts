import { Module } from "@nestjs/common";
import { CandidateAuthModule } from "../candidate-auth/candidate-auth.module";
import { StorageModule } from "../storage/storage.module";
import { CandidatePortalController } from "./candidate-portal.controller";
import { CandidatePortalService } from "./candidate-portal.service";

@Module({
  imports: [CandidateAuthModule, StorageModule],
  controllers: [CandidatePortalController],
  providers: [CandidatePortalService],
})
export class CandidatePortalModule {}
