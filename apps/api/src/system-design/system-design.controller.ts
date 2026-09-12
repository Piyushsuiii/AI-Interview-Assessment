import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { SystemDesignService } from "./system-design.service";
import { systemDesignSubmissionSchema, type SystemDesignInput } from "./system-design.schemas";

@Controller("candidate/invitations/:token/system-design/:questionId")
export class SystemDesignController {
  constructor(private readonly systemDesign: SystemDesignService) {}

  @Get()
  get(@Param("token") token: string, @Param("questionId") questionId: string) {
    return this.systemDesign.get(token, questionId);
  }

  @Put()
  put(@Param("token") token: string, @Param("questionId") questionId: string, @Body(new SchemaPipe(systemDesignSubmissionSchema)) input: SystemDesignInput) {
    return this.systemDesign.put(token, questionId, input);
  }
}
