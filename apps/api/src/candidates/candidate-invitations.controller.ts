import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  invitationTokenSchema,
  startInterviewSchema,
  submitInterviewAnswerSchema,
} from "@ai-hiring-platform/validation";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CandidatesService } from "./candidates.service";

@Controller("candidate/invitations")
export class CandidateInvitationsController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get(":token")
  get(@Param("token", new SchemaPipe(invitationTokenSchema)) token: string) {
    return this.candidates.getInvitation(token);
  }

  @Post(":token/start")
  start(
    @Param("token", new SchemaPipe(invitationTokenSchema)) token: string,
    @Body(new SchemaPipe(startInterviewSchema)) _input: { consent: true },
  ) {
    return this.candidates.startInvitation(token);
  }

  @Get(":token/question")
  question(@Param("token", new SchemaPipe(invitationTokenSchema)) token: string) {
    return this.candidates.currentQuestion(token);
  }

  @Post(":token/answers")
  answer(
    @Param("token", new SchemaPipe(invitationTokenSchema)) token: string,
    @Body(new SchemaPipe(submitInterviewAnswerSchema)) input: { questionId: string; text: string },
  ) {
    return this.candidates.submitAnswer(token, input);
  }
}
