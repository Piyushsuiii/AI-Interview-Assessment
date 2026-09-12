import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { integritySignalSchema, type IntegritySignalInput } from "./integrity.schemas";
import { IntegrityService } from "./integrity.service";

@Controller("candidate/invitations/:token/integrity")
export class CandidateIntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Post()
  record(@Param("token") token: string, @Body(new SchemaPipe(integritySignalSchema)) input: IntegritySignalInput) {
    return this.integrity.record(token, input);
  }
}

@Controller("organizations/:orgId/interviews/:interviewId/integrity")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
@RequirePermissions("interviews:read")
export class RecruiterIntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Get()
  summary(@Param("orgId") orgId: string, @Param("interviewId") interviewId: string) {
    return this.integrity.summary(orgId, interviewId);
  }

  @Get("events")
  events(@Param("orgId") orgId: string, @Param("interviewId") interviewId: string) {
    return this.integrity.events(orgId, interviewId);
  }
}
