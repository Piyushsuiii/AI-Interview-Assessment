import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CodingService } from "./coding.service";
import { codeRequestSchema, type CodeRequest } from "./coding.schemas";

@Controller("candidate/invitations/:token/coding")
export class CodingController {
  constructor(private readonly coding: CodingService) {}

  @Get("executions/:executionId")
  execution(@Param("token") token: string, @Param("executionId") executionId: string) {
    return this.coding.execution(token, executionId);
  }

  @Get(":questionId")
  get(@Param("token") token: string, @Param("questionId") questionId: string) {
    return this.coding.getChallenge(token, questionId);
  }

  @Post(":questionId/run")
  run(@Param("token") token: string, @Param("questionId") questionId: string, @Body(new SchemaPipe(codeRequestSchema)) input: CodeRequest) {
    return this.coding.run(token, questionId, input);
  }

  @Post(":questionId/submit")
  submit(@Param("token") token: string, @Param("questionId") questionId: string, @Body(new SchemaPipe(codeRequestSchema)) input: CodeRequest) {
    return this.coding.submit(token, questionId, input);
  }
}
