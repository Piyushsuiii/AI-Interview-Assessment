import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import {
  candidateListQuerySchema,
  createCandidateSchema,
  inviteCandidateSchema,
  updateCandidateSchema,
  type CandidateListQuery,
  type CreateCandidateInput,
  type InviteCandidateInput,
  type UpdateCandidateInput,
} from "@ai-hiring-platform/validation";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { CandidatesService } from "./candidates.service";

@Controller("organizations/:orgId/candidates")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get()
  @RequirePermissions("candidates:read")
  list(
    @Param("orgId") orgId: string,
    @Query(new SchemaPipe(candidateListQuerySchema)) query: CandidateListQuery,
  ) {
    return this.candidates.list(orgId, query);
  }

  @Get(":candidateId")
  @RequirePermissions("candidates:read")
  get(@Param("orgId") orgId: string, @Param("candidateId") candidateId: string) {
    return this.candidates.get(orgId, candidateId);
  }

  @Post()
  @RequirePermissions("candidates:write")
  create(
    @Param("orgId") orgId: string,
    @Body(new SchemaPipe(createCandidateSchema)) input: CreateCandidateInput,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.candidates.create(orgId, input, this.context(user, request));
  }

  @Patch(":candidateId")
  @RequirePermissions("candidates:write")
  update(
    @Param("orgId") orgId: string,
    @Param("candidateId") candidateId: string,
    @Body(new SchemaPipe(updateCandidateSchema)) input: UpdateCandidateInput,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.candidates.update(orgId, candidateId, input, this.context(user, request));
  }

  @Post(":candidateId/resume")
  @RequirePermissions("candidates:write")
  @UseInterceptors(FileInterceptor("resume", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadResume(
    @Param("orgId") orgId: string,
    @Param("candidateId") candidateId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.candidates.uploadResume(orgId, candidateId, file, this.context(user, request));
  }

  @Get(":candidateId/resume-url")
  @RequirePermissions("candidates:read")
  getResumeUrl(@Param("orgId") orgId: string, @Param("candidateId") candidateId: string) {
    return this.candidates.getResumeUrl(orgId, candidateId);
  }

  @Delete(":candidateId/resume")
  @RequirePermissions("candidates:write")
  deleteResume(
    @Param("orgId") orgId: string,
    @Param("candidateId") candidateId: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.candidates.deleteResume(orgId, candidateId, this.context(user, request));
  }

  @Post(":candidateId/invite")
  @RequirePermissions("candidates:write", "interviews:write")
  invite(
    @Param("orgId") orgId: string,
    @Param("candidateId") candidateId: string,
    @Body(new SchemaPipe(inviteCandidateSchema)) input: InviteCandidateInput,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.candidates.invite(orgId, candidateId, input, this.context(user, request));
  }

  private context(user: AuthUser, request: Request) {
    return { userId: user.id, ipAddress: request.ip, userAgent: request.get("user-agent") };
  }
}
