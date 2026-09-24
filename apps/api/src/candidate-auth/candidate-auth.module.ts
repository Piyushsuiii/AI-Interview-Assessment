import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CandidateAuthController } from "./candidate-auth.controller";
import { CandidateAuthGuard } from "./candidate-auth.guard";
import { CandidateAuthService } from "./candidate-auth.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [CandidateAuthController],
  providers: [CandidateAuthService, CandidateAuthGuard],
  exports: [JwtModule, CandidateAuthGuard],
})
export class CandidateAuthModule {}
