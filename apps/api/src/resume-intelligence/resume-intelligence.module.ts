import { Global, Module } from "@nestjs/common";
import { ResumeIntelligenceService } from "./resume-intelligence.service";

@Global()
@Module({
  providers: [ResumeIntelligenceService],
  exports: [ResumeIntelligenceService],
})
export class ResumeIntelligenceModule {}
