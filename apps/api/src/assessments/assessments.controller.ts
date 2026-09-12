import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  addAssessmentQuestionSchema,
  assessmentListQuerySchema,
  createAssessmentSchema,
  updateAssessmentQuestionSchema,
  updateAssessmentSchema,
  type AddAssessmentQuestionInput,
  type AssessmentListQuery,
  type CreateAssessmentInput,
  type UpdateAssessmentInput,
  type UpdateAssessmentQuestionInput,
} from "@ai-hiring-platform/validation";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgContextGuard } from "../common/guards/org-context.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SchemaPipe } from "../common/pipes/zod-validation.pipe";
import { AssessmentsService } from "./assessments.service";

@Controller("organizations/:orgId/assessments")
@UseGuards(JwtAuthGuard, OrgContextGuard, PermissionsGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  @RequirePermissions("assessments:read")
  list(
    @Param("orgId") orgId: string,
    @Query(new SchemaPipe(assessmentListQuerySchema)) query: AssessmentListQuery,
  ) {
    return this.assessments.list(orgId, query);
  }

  @Get(":assessmentId")
  @RequirePermissions("assessments:read")
  get(@Param("orgId") orgId: string, @Param("assessmentId") assessmentId: string) {
    return this.assessments.get(orgId, assessmentId);
  }

  @Post()
  @RequirePermissions("assessments:write")
  create(
    @Param("orgId") orgId: string,
    @Body(new SchemaPipe(createAssessmentSchema)) input: CreateAssessmentInput,
  ) {
    return this.assessments.create(orgId, input);
  }

  @Patch(":assessmentId")
  @RequirePermissions("assessments:write")
  update(
    @Param("orgId") orgId: string,
    @Param("assessmentId") assessmentId: string,
    @Body(new SchemaPipe(updateAssessmentSchema)) input: UpdateAssessmentInput,
  ) {
    return this.assessments.update(orgId, assessmentId, input);
  }

  @Post(":assessmentId/questions")
  @RequirePermissions("assessments:write")
  addQuestion(
    @Param("orgId") orgId: string,
    @Param("assessmentId") assessmentId: string,
    @Body(new SchemaPipe(addAssessmentQuestionSchema)) input: AddAssessmentQuestionInput,
  ) {
    return this.assessments.addQuestion(orgId, assessmentId, input);
  }

  @Patch(":assessmentId/questions/:assessmentQuestionId")
  @RequirePermissions("assessments:write")
  updateQuestion(
    @Param("orgId") orgId: string,
    @Param("assessmentId") assessmentId: string,
    @Param("assessmentQuestionId") assessmentQuestionId: string,
    @Body(new SchemaPipe(updateAssessmentQuestionSchema)) input: UpdateAssessmentQuestionInput,
  ) {
    return this.assessments.updateQuestion(orgId, assessmentId, assessmentQuestionId, input);
  }

  @Delete(":assessmentId/questions/:assessmentQuestionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("assessments:write")
  removeQuestion(
    @Param("orgId") orgId: string,
    @Param("assessmentId") assessmentId: string,
    @Param("assessmentQuestionId") assessmentQuestionId: string,
  ) {
    return this.assessments.removeQuestion(orgId, assessmentId, assessmentQuestionId);
  }

  @Post(":assessmentId/publish")
  @RequirePermissions("assessments:write")
  publish(@Param("orgId") orgId: string, @Param("assessmentId") assessmentId: string) {
    return this.assessments.publish(orgId, assessmentId);
  }

  @Post(":assessmentId/duplicate")
  @RequirePermissions("assessments:write")
  duplicate(@Param("orgId") orgId: string, @Param("assessmentId") assessmentId: string) {
    return this.assessments.duplicate(orgId, assessmentId);
  }
}
