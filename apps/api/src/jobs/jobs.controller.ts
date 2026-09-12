import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  createJobSchema,
  jobListQuerySchema,
  updateJobSchema,
  type CreateJobInput,
  type JobListQuery,
  type UpdateJobInput,
} from "@ai-hiring-platform/validation";
import { JobsService } from "./jobs.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";

@Controller("organizations/:orgId/jobs")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePermissions("jobs:read")
  list(
    @Param("orgId") orgId: string,
    @Query(new SchemaPipe(jobListQuerySchema)) query: JobListQuery,
  ) {
    return this.jobs.list(orgId, query);
  }

  @Get(":jobId")
  @RequirePermissions("jobs:read")
  get(@Param("orgId") orgId: string, @Param("jobId") jobId: string) {
    return this.jobs.get(orgId, jobId);
  }

  @Post()
  @RequirePermissions("jobs:write")
  create(
    @Param("orgId") orgId: string,
    @Body(new SchemaPipe(createJobSchema)) input: CreateJobInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.jobs.create(orgId, input, this.context(user, req));
  }

  @Patch(":jobId")
  @RequirePermissions("jobs:write")
  update(
    @Param("orgId") orgId: string,
    @Param("jobId") jobId: string,
    @Body(new SchemaPipe(updateJobSchema)) input: UpdateJobInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.jobs.update(orgId, jobId, input, this.context(user, req));
  }

  @Post(":jobId/close")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("jobs:write")
  close(
    @Param("orgId") orgId: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.jobs.close(orgId, jobId, this.context(user, req));
  }

  private context(user: AuthUser, req: Request) {
    return { userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent") };
  }
}
