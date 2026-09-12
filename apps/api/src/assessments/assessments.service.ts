import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AddAssessmentQuestionInput,
  AssessmentListQuery,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  UpdateAssessmentQuestionInput,
} from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { notifyOrganization } from "../notifications/notification-events";

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: AssessmentListQuery) {
    const where: Prisma.AssessmentWhereInput = {
      organizationId,
      status: query.status,
      jobId: query.jobId,
      ...(query.search ? { OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assessment.findMany({
        where,
        include: { job: { select: { id: true, title: true } }, _count: { select: { interviews: true } } },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assessment.count({ where }),
    ]);
    return { items, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
  }

  async get(organizationId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, organizationId },
      include: {
        job: { select: { id: true, title: true } },
        versions: {
          orderBy: { version: "desc" },
          include: { questions: { orderBy: { order: "asc" }, include: { questionVersion: { include: { question: true } } } } },
        },
      },
    });
    if (!assessment) this.notFound();
    const latest = assessment.versions[0];
    return {
      ...assessment,
      questions: latest?.questions.map((link) => ({
        id: link.id,
        order: link.order,
        weight: link.weight,
        required: link.required,
        type: link.questionVersion.question.type,
        difficulty: link.questionVersion.difficulty,
        prompt: link.questionVersion.prompt,
        expectedAnswer: link.questionVersion.expectedAnswer,
        rubric: link.questionVersion.rubric,
        skills: link.questionVersion.skills,
        maxScore: link.questionVersion.maxScore,
      })) ?? [],
    };
  }

  async create(organizationId: string, input: CreateAssessmentInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertJob(tx, organizationId, input.jobId);
      const { questions, ...metadata } = input;
      const assessment = await tx.assessment.create({ data: { organizationId, ...metadata, status: "DRAFT" } });
      const version = await tx.assessmentVersion.create({
        data: { assessmentId: assessment.id, version: 1, durationMins: input.durationMins },
      });
      for (const [order, content] of questions.entries()) {
        await this.createQuestion(tx, organizationId, version.id, { ...content, order, weight: 1, required: true });
      }
      return this.getFromClient(tx, organizationId, assessment.id);
    });
  }

  async update(organizationId: string, assessmentId: string, input: UpdateAssessmentInput) {
    return this.prisma.$transaction(async (tx) => {
      const { version } = await this.getDraft(tx, organizationId, assessmentId);
      await this.assertJob(tx, organizationId, input.jobId);
      const assessment = await tx.assessment.update({ where: { id: assessmentId }, data: input });
      if (input.durationMins !== undefined) {
        await tx.assessmentVersion.update({ where: { id: version.id }, data: { durationMins: input.durationMins } });
      }
      return assessment;
    });
  }

  async addQuestion(organizationId: string, assessmentId: string, input: AddAssessmentQuestionInput) {
    return this.prisma.$transaction(async (tx) => {
      const { version } = await this.getDraft(tx, organizationId, assessmentId);
      const count = await tx.assessmentQuestion.count({ where: { assessmentVersionId: version.id } });
      if (input.order > count) this.invalidPosition();
      await tx.assessmentQuestion.updateMany({
        where: { assessmentVersionId: version.id, order: { gte: input.order } },
        data: { order: { increment: 1 } },
      });
      return this.createQuestion(tx, organizationId, version.id, input);
    });
  }

  async updateQuestion(organizationId: string, assessmentId: string, linkId: string, input: UpdateAssessmentQuestionInput) {
    return this.prisma.$transaction(async (tx) => {
      const { version } = await this.getDraft(tx, organizationId, assessmentId);
      const link = await tx.assessmentQuestion.findFirst({
        where: { id: linkId, assessmentVersionId: version.id },
        include: { questionVersion: { include: { question: true } } },
      });
      if (!link) this.questionNotFound();
      const { order, weight, required, ...changes } = input;
      let questionVersionId = link.questionVersionId;
      if (Object.keys(changes).length) {
        const previous = link.questionVersion;
        const questionType = changes.type ?? previous.question.type;
        const codingConfig = changes.codingConfig === undefined ? previous.codingConfig : changes.codingConfig;
        if (questionType === "CODING" && !codingConfig) {
          throw new BadRequestException({ code: "CODING_CONFIG_MISSING", message: "Coding questions require an execution configuration" });
        }
        await tx.question.update({ where: { id: previous.questionId }, data: { type: questionType } });
        const next = await tx.questionVersion.create({
          data: {
            questionId: previous.questionId,
            version: previous.version + 1,
            prompt: changes.prompt ?? previous.prompt,
            difficulty: changes.difficulty ?? previous.difficulty,
            expectedAnswer: changes.expectedAnswer ?? previous.expectedAnswer,
            rubric: changes.rubric === undefined ? previous.rubric ?? undefined : changes.rubric,
            skills: changes.skills ?? previous.skills,
            maxScore: changes.maxScore ?? previous.maxScore,
            codingConfig: codingConfig as Prisma.InputJsonValue | undefined,
          },
        });
        questionVersionId = next.id;
      }
      if (order !== undefined && order !== link.order) await this.moveQuestion(tx, version.id, link.order, order);
      return tx.assessmentQuestion.update({
        where: { id: linkId },
        data: { questionVersionId, ...(order === undefined ? {} : { order }), ...(weight === undefined ? {} : { weight }), ...(required === undefined ? {} : { required }) },
        include: { questionVersion: true },
      });
    });
  }

  async removeQuestion(organizationId: string, assessmentId: string, linkId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { version } = await this.getDraft(tx, organizationId, assessmentId);
      const link = await tx.assessmentQuestion.findFirst({ where: { id: linkId, assessmentVersionId: version.id } });
      if (!link) this.questionNotFound();
      await tx.assessmentQuestion.delete({ where: { id: link.id } });
      await tx.assessmentQuestion.updateMany({ where: { assessmentVersionId: version.id, order: { gt: link.order } }, data: { order: { decrement: 1 } } });
    });
  }

  async publish(organizationId: string, assessmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { assessment, version } = await this.getDraft(tx, organizationId, assessmentId);
      const questions = await tx.assessmentQuestion.findMany({
        where: { assessmentVersionId: version.id },
        include: { questionVersion: { include: { question: true } } },
      });
      if (!questions.length) throw new BadRequestException({ code: "ASSESSMENT_EMPTY", message: "Add at least one question before publishing" });
      if (questions.some((item) => item.questionVersion.question.type === "CODING" && !item.questionVersion.codingConfig)) {
        throw new BadRequestException({ code: "CODING_CONFIG_MISSING", message: "Every coding question requires an execution configuration" });
      }
      const totalScore = questions.reduce((sum, item) => sum + item.questionVersion.maxScore * item.weight, 0);
      await tx.assessmentVersion.update({ where: { id: version.id }, data: { publishedAt: new Date(), totalScore } });
      await tx.question.updateMany({ where: { versions: { some: { assessmentQuestions: { some: { assessmentVersionId: version.id } } } } }, data: { status: "PUBLISHED" } });
      const published = await tx.assessment.update({ where: { id: assessment.id }, data: { status: "PUBLISHED", activeVersionId: version.id }, include: { activeVersion: true } });
      await notifyOrganization(tx, organizationId, {
        type: "ASSESSMENT_PUBLISHED",
        title: "Assessment published",
        message: `${assessment.title} is ready to use.`,
        href: `/assessments/${assessment.id}`,
        dedupeKey: `assessment-published:${assessment.id}:${version.id}`,
        metadata: { assessmentId: assessment.id, versionId: version.id },
      });
      return published;
    });
  }

  async duplicate(organizationId: string, assessmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.assessment.findFirst({
        where: { id: assessmentId, organizationId },
        include: { versions: { orderBy: { version: "desc" }, take: 1, include: { questions: { orderBy: { order: "asc" } } } } },
      });
      if (!source) this.notFound();
      const copy = await tx.assessment.create({ data: { organizationId, jobId: source.jobId, title: `${source.title} (copy)`, description: source.description, durationMins: source.durationMins, status: "DRAFT" } });
      const version = await tx.assessmentVersion.create({ data: { assessmentId: copy.id, version: 1, durationMins: source.durationMins } });
      const sourceQuestions = source.versions[0]?.questions ?? [];
      if (sourceQuestions.length) await tx.assessmentQuestion.createMany({ data: sourceQuestions.map((item) => ({ assessmentVersionId: version.id, questionVersionId: item.questionVersionId, order: item.order, weight: item.weight, required: item.required })) });
      return this.getFromClient(tx, organizationId, copy.id);
    });
  }

  private async createQuestion(tx: Prisma.TransactionClient, organizationId: string, versionId: string, input: AddAssessmentQuestionInput) {
    const { order, weight, required, type, codingConfig, ...content } = input;
    const question = await tx.question.create({ data: { organizationId, type } });
    const questionVersion = await tx.questionVersion.create({
      data: { questionId: question.id, version: 1, ...content, codingConfig: codingConfig as Prisma.InputJsonValue | undefined },
    });
    return tx.assessmentQuestion.create({ data: { assessmentVersionId: versionId, questionVersionId: questionVersion.id, order, weight, required }, include: { questionVersion: true } });
  }

  private async moveQuestion(tx: Prisma.TransactionClient, versionId: string, previous: number, next: number) {
    const count = await tx.assessmentQuestion.count({ where: { assessmentVersionId: versionId } });
    if (next >= count) this.invalidPosition();
    if (next < previous) await tx.assessmentQuestion.updateMany({ where: { assessmentVersionId: versionId, order: { gte: next, lt: previous } }, data: { order: { increment: 1 } } });
    else await tx.assessmentQuestion.updateMany({ where: { assessmentVersionId: versionId, order: { gt: previous, lte: next } }, data: { order: { decrement: 1 } } });
  }

  private async getDraft(tx: Prisma.TransactionClient, organizationId: string, assessmentId: string) {
    const assessment = await tx.assessment.findFirst({ where: { id: assessmentId, organizationId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!assessment) this.notFound();
    if (assessment.status !== "DRAFT") throw new ConflictException({ code: "ASSESSMENT_IMMUTABLE", message: "Published assessments cannot be modified" });
    if (!assessment.versions[0]) throw new ConflictException({ code: "ASSESSMENT_VERSION_MISSING", message: "Assessment draft has no version" });
    return { assessment, version: assessment.versions[0] };
  }

  private async assertJob(tx: Prisma.TransactionClient, organizationId: string, jobId?: string) {
    if (!jobId) return;
    const job = await tx.job.findFirst({ where: { id: jobId, organizationId, archivedAt: null }, select: { id: true } });
    if (!job) throw new BadRequestException({ code: "JOB_NOT_FOUND", message: "Job not found" });
  }

  private getFromClient(tx: Prisma.TransactionClient, organizationId: string, assessmentId: string) {
    return tx.assessment.findFirst({ where: { id: assessmentId, organizationId }, include: { versions: { include: { questions: { orderBy: { order: "asc" }, include: { questionVersion: true } } } } } });
  }

  private invalidPosition(): never { throw new BadRequestException({ code: "INVALID_QUESTION_POSITION", message: "Question position is out of range" }); }
  private notFound(): never { throw new NotFoundException({ code: "ASSESSMENT_NOT_FOUND", message: "Assessment not found" }); }
  private questionNotFound(): never { throw new NotFoundException({ code: "QUESTION_NOT_FOUND", message: "Assessment question not found" }); }
}
