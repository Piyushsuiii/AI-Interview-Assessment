import { BadRequestException, ConflictException, GoneException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { CandidateListQuery, CreateCandidateInput, InviteCandidateInput, UpdateCandidateInput } from "@ai-hiring-platform/validation";
import { AuditService } from "../audit/audit.service";
import { createRawToken, hashToken } from "../common/crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { CandidateInterviewOrchestratorService } from "../interviews/candidate-interview-orchestrator.service";
import { advanceInterview, currentUnansweredQuestion, isQuestionAnswered, progressionQuestionInclude } from "../interviews/interview-progression";
import { canConsumeUsage, incrementUsage } from "../billing/entitlements";
import { notifyOrganization } from "../notifications/notification-events";
import { StorageService } from "../storage/storage.service";
import { randomUUID } from "node:crypto";

type MutationContext = { userId: string; ipAddress?: string; userAgent?: string };

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly orchestrator: CandidateInterviewOrchestratorService,
    private readonly storage: StorageService,
  ) {}

  async list(organizationId: string, query: CandidateListQuery) {
    const where: Prisma.CandidateWhereInput = {
      organizationId,
      status: query.status,
      jobId: query.jobId,
      ...(query.search ? { OR: [
        { email: { contains: query.search, mode: "insensitive" } },
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        where,
        include: { job: { select: { id: true, title: true } }, interviews: { select: { id: true, state: true, score: true, createdAt: true } } },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.candidate.count({ where }),
    ]);
    return { items: items.map((candidate) => this.withoutResumeKey(candidate)), pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } };
  }

  async get(organizationId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
      include: {
        job: { select: { id: true, title: true } },
        interviews: { include: { assessment: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!candidate) this.notFound();
    return this.withoutResumeKey({
      ...candidate,
      interviews: candidate.interviews.map((interview) => ({
        ...interview,
        status: interview.state,
      })),
    });
  }

  async create(organizationId: string, input: CreateCandidateInput, context: MutationContext) {
    try {
      const candidate = await this.prisma.$transaction(async (tx) => {
        const job = await tx.job.findFirst({ where: { id: input.jobId, organizationId, archivedAt: null }, select: { id: true } });
        if (!job) throw new BadRequestException({ code: "JOB_NOT_FOUND", message: "Job not found" });
        return tx.candidate.create({ data: { organizationId, ...input } });
      });
      await this.audit.record({ action: "candidate.created", organizationId, ...context, metadata: { candidateId: candidate.id, jobId: input.jobId } });
      return this.withoutResumeKey(candidate);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({ code: "CANDIDATE_ALREADY_EXISTS", message: "This candidate already exists for the job" });
      }
      throw error;
    }
  }

  async update(organizationId: string, candidateId: string, input: UpdateCandidateInput, context: MutationContext) {
    const candidate = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidate.findFirst({ where: { id: candidateId, organizationId }, select: { id: true } });
      if (!existing) this.notFound();
      return tx.candidate.update({ where: { id: candidateId }, data: input });
    });
    await this.audit.record({ action: "candidate.updated", organizationId, ...context, metadata: { candidateId, fields: Object.keys(input) } });
    return this.withoutResumeKey(candidate);
  }

  async uploadResume(
    organizationId: string,
    candidateId: string,
    file: Express.Multer.File | undefined,
    context: MutationContext,
  ) {
    if (!file) throw new BadRequestException({ code: "RESUME_REQUIRED", message: "A resume PDF is required" });
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException({ code: "RESUME_TOO_LARGE", message: "Resume must be 10 MB or smaller" });
    if (file.mimetype !== "application/pdf" || !file.originalname.toLowerCase().endsWith(".pdf") || file.buffer.subarray(0, 5).toString() !== "%PDF-") {
      throw new BadRequestException({ code: "RESUME_TYPE_UNSUPPORTED", message: "Only valid PDF resumes are supported" });
    }
    const existing = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
      select: { id: true, resumeObjectKey: true },
    });
    if (!existing) this.notFound();

    const fileName = this.safeFileName(file.originalname);
    const objectKey = `organizations/${organizationId}/candidates/${candidateId}/resumes/${randomUUID()}.pdf`;
    await this.storage.putObject(objectKey, file.buffer, "application/pdf");
    const uploadedAt = new Date();
    try {
      await this.prisma.candidate.update({
        where: { id: candidateId },
        data: {
          resumeUrl: null,
          resumeObjectKey: objectKey,
          resumeFileName: fileName,
          resumeContentType: "application/pdf",
          resumeSize: file.size,
          resumeUploadedAt: uploadedAt,
        },
      });
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
    if (existing.resumeObjectKey) await this.storage.deleteObject(existing.resumeObjectKey).catch(() => undefined);
    await this.audit.record({
      action: "candidate.resume_uploaded",
      organizationId,
      ...context,
      metadata: { candidateId, fileName, size: file.size, replaced: Boolean(existing.resumeObjectKey) },
    });
    return { fileName, contentType: "application/pdf", size: file.size, uploadedAt };
  }

  async getResumeUrl(organizationId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
      select: { resumeObjectKey: true, resumeFileName: true, resumeUrl: true },
    });
    if (!candidate) this.notFound();
    if (candidate.resumeObjectKey) {
      const expiresInSeconds = 300;
      const url = await this.storage.getSignedDownloadUrl(candidate.resumeObjectKey, candidate.resumeFileName ?? "resume.pdf", expiresInSeconds);
      return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000), managed: true };
    }
    if (candidate.resumeUrl) return { url: candidate.resumeUrl, expiresAt: null, managed: false };
    throw new NotFoundException({ code: "RESUME_NOT_FOUND", message: "Candidate resume not found" });
  }

  async deleteResume(organizationId: string, candidateId: string, context: MutationContext) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
      select: { resumeObjectKey: true, resumeUrl: true },
    });
    if (!candidate) this.notFound();
    if (!candidate.resumeObjectKey && !candidate.resumeUrl) {
      throw new NotFoundException({ code: "RESUME_NOT_FOUND", message: "Candidate resume not found" });
    }
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl: null, resumeObjectKey: null, resumeFileName: null, resumeContentType: null, resumeSize: null, resumeUploadedAt: null },
    });
    if (candidate.resumeObjectKey) await this.storage.deleteObject(candidate.resumeObjectKey).catch(() => undefined);
    await this.audit.record({ action: "candidate.resume_deleted", organizationId, ...context, metadata: { candidateId } });
    return { deleted: true };
  }

  async invite(organizationId: string, candidateId: string, input: InviteCandidateInput, context: MutationContext) {
    const token = createRawToken();
    const invitationTokenHash = hashToken(token);
    const invitationExpiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
    const invitedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({ where: { id: candidateId, organizationId }, select: { id: true, email: true, jobId: true } });
      if (!candidate) this.notFound();
      const assessment = await tx.assessment.findFirst({ where: { id: input.assessmentId, organizationId, status: "PUBLISHED" }, select: { id: true, jobId: true, activeVersionId: true } });
      if (!assessment?.activeVersionId) throw new BadRequestException({ code: "ASSESSMENT_NOT_PUBLISHED", message: "A published assessment is required" });
      if (assessment.jobId && assessment.jobId !== candidate.jobId) throw new BadRequestException({ code: "ASSESSMENT_JOB_MISMATCH", message: "Assessment and candidate must belong to the same job" });
      const existing = await tx.interview.findFirst({ where: { organizationId, candidateId, assessmentId: input.assessmentId, state: { in: ["CREATED", "INVITED", "EXPIRED"] } }, select: { id: true } });
      const data = { organizationId, candidateId, assessmentId: input.assessmentId, state: "INVITED" as const, invitationTokenHash, invitationExpiresAt, invitedAt, progress: 0 };
      if (!existing && !(await canConsumeUsage(tx, organizationId, "INTERVIEWS", 1n, invitedAt))) {
        throw new HttpException(
          { code: "INTERVIEW_LIMIT_REACHED", message: "The monthly interview limit has been reached" },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const interview = existing ? await tx.interview.update({ where: { id: existing.id }, data }) : await tx.interview.create({ data });
      await tx.candidate.update({ where: { id: candidateId }, data: { status: "INVITED" } });
      if (!existing) await incrementUsage(tx, organizationId, "INTERVIEWS", 1n, invitedAt);
      await notifyOrganization(tx, organizationId, {
        type: "CANDIDATE_INVITED",
        title: "Candidate invited",
        message: `${candidate.email} was invited to an assessment.`,
        href: `/candidates/${candidate.id}`,
        dedupeKey: `candidate-invited:${interview.id}:${invitedAt.toISOString()}`,
        metadata: { candidateId: candidate.id, interviewId: interview.id, assessmentId: input.assessmentId },
      });
      return { candidate, interview };
    });
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const invitationUrl = `${frontendUrl}/interview/${token}`;
    await this.mail.sendCandidateInvitation(result.candidate.email, invitationUrl);
    await this.audit.record({ action: "candidate.invited", organizationId, ...context, metadata: { candidateId, assessmentId: input.assessmentId, interviewId: result.interview.id } });
    return { interviewId: result.interview.id, invitationUrl, expiresAt: invitationExpiresAt };
  }

  async getInvitation(token: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      include: {
        organization: { select: { name: true } },
        candidate: { select: { firstName: true, lastName: true, email: true, job: { select: { title: true, department: true, location: true, employmentType: true } } } },
        assessment: { select: { title: true, durationMins: true } },
        session: { select: { state: true, startedAt: true, completedAt: true } },
        questions: { orderBy: { order: "asc" }, include: progressionQuestionInclude },
      },
    });
    this.assertInvitationUsable(interview);
    return {
      status: interview.state,
      expiresAt: interview.invitationExpiresAt,
      organization: interview.organization,
      candidate: { firstName: interview.candidate.firstName, lastName: interview.candidate.lastName, email: interview.candidate.email },
      job: interview.candidate.job,
      assessment: interview.assessment,
      session: interview.session ? { status: interview.session.state, startedAt: interview.session.startedAt, completedAt: interview.session.completedAt, progress: { answeredQuestions: interview.questions.filter(isQuestionAnswered).length, totalQuestions: interview.questions.length } } : null,
    };
  }

  async startInvitation(token: string) {
    const tokenHash = hashToken(token);
    return this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { invitationTokenHash: tokenHash },
        include: {
          session: true,
          assessment: { include: { activeVersion: { include: { questions: { orderBy: { order: "asc" }, include: { questionVersion: { include: { question: true } } } } } } } },
        },
      });
      this.assertInvitationUsable(interview);
      if (interview.state !== "INVITED" && interview.session) return { status: interview.state, session: this.publicSession(interview.session), reconnected: true };
      const activeVersion = interview.assessment.activeVersion;
      if (!activeVersion) throw new ConflictException({ code: "ASSESSMENT_VERSION_MISSING", message: "The assessment is unavailable" });
      const now = new Date();
      const firstState = this.stateForQuestion(activeVersion.questions[0]?.questionVersion.question.type);
      await tx.interview.update({ where: { id: interview.id }, data: { state: firstState, startedAt: interview.startedAt ?? now, consentedAt: now, currentSection: firstState, progress: 0 } });
      if (!(await tx.interviewQuestion.count({ where: { interviewId: interview.id } }))) {
        await tx.interviewQuestion.createMany({ data: activeVersion.questions.map((link) => ({
          interviewId: interview.id,
          questionId: link.questionVersion.questionId,
          questionVersionId: link.questionVersionId,
          type: link.questionVersion.question.type,
          prompt: link.questionVersion.prompt,
          order: link.order,
          maxScore: link.questionVersion.maxScore,
        })) });
      }
      const codingQuestions = await tx.interviewQuestion.findMany({
        where: { interviewId: interview.id, type: "CODING", codingChallenge: null },
        select: { id: true, prompt: true, questionVersion: { select: { codingConfig: true } } },
      });
      for (const question of codingQuestions) {
        const config = question.questionVersion?.codingConfig as {
          title: string;
          allowedLanguages: string[];
          starterCode: Record<string, string>;
          publicTests: unknown[];
          hiddenTests: unknown[];
          timeLimitMs: number;
          memoryLimitMb: number;
        } | null;
        if (!config) throw new ConflictException({ code: "CODING_CONFIG_MISSING", message: "A coding question is missing its execution configuration" });
        await tx.codingChallenge.create({
          data: {
            interviewQuestionId: question.id,
            title: config.title,
            description: question.prompt,
            allowedLanguages: config.allowedLanguages,
            starterCode: config.starterCode,
            publicTests: { tests: config.publicTests } as Prisma.InputJsonObject,
            hiddenTests: { tests: config.hiddenTests } as Prisma.InputJsonObject,
            timeLimitMs: config.timeLimitMs,
            memoryLimitMb: config.memoryLimitMb,
          },
        });
      }
      const session = await tx.interviewSession.upsert({
        where: { interviewId: interview.id },
        create: { interviewId: interview.id, state: firstState, startedAt: now, reconnectTokenHash: hashToken(createRawToken()) },
        update: { state: firstState },
      });
      const eventSession = await tx.interviewSession.update({
        where: { id: session.id },
        data: { lastEventSequence: { increment: 1 } },
      });
      await tx.interviewEvent.create({
        data: {
          interviewId: interview.id,
          sequence: eventSession.lastEventSequence,
          type: "INTERVIEW_STARTED",
          payload: { state: firstState },
          occurredAt: now,
        },
      });
      await tx.candidate.update({ where: { id: interview.candidateId }, data: { status: "ACTIVE" } });
      return { status: firstState, session: this.publicSession(eventSession), reconnected: false };
    });
  }

  async currentQuestion(token: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      include: {
        questions: { orderBy: { order: "asc" }, include: progressionQuestionInclude },
      },
    });
    this.assertActiveInterview(interview);
    const answered = interview.questions.filter(isQuestionAnswered).length;
    const question = currentUnansweredQuestion(interview.questions);
    return {
      completed: !question,
      state: interview.state,
      progress: { answeredQuestions: answered, totalQuestions: interview.questions.length },
      question: question ? { id: question.id, type: question.type, prompt: question.prompt, order: question.order, maxScore: question.maxScore } : null,
    };
  }

  async submitAnswer(token: string, input: { questionId: string; text: string }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const interview = await tx.interview.findUnique({
        where: { invitationTokenHash: hashToken(token) },
        include: { questions: { orderBy: { order: "asc" }, include: progressionQuestionInclude } },
      });
      this.assertActiveInterview(interview);
      const current = currentUnansweredQuestion(interview.questions);
      if (!current || current.id !== input.questionId) {
        throw new ConflictException({ code: "QUESTION_SEQUENCE_CONFLICT", message: "This is not the current interview question" });
      }
      if (["CODING", "SYSTEM_DESIGN"].includes(current.type)) {
        throw new ConflictException({ code: "QUESTION_SUBMISSION_TYPE_MISMATCH", message: "This question requires its dedicated submission endpoint" });
      }
      const now = new Date();
      const answer = await tx.answer.create({ data: { interviewQuestionId: current.id, text: input.text, submittedAt: now } });
      return {
        interviewId: interview.id,
        answerId: answer.id,
        questionType: current.type,
        isAdaptive: current.isAdaptive,
      };
    });
    if (!["CODING", "SYSTEM_DESIGN"].includes(result.questionType) && !result.isAdaptive) {
      await this.orchestrator.afterTextAnswer(result.interviewId, input.questionId);
    }
    const progression = await this.prisma.$transaction((tx) => advanceInterview(tx, result.interviewId, { questionId: input.questionId, evidenceId: result.answerId }));
    return { accepted: true, ...progression };
  }

  private assertInvitationUsable<T extends { invitationExpiresAt: Date | null; state: string }>(interview: T | null): asserts interview is T {
    if (!interview) throw new NotFoundException({ code: "INVITATION_NOT_FOUND", message: "Invitation not found" });
    if (!interview.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now()) throw new GoneException({ code: "INVITATION_EXPIRED", message: "Invitation has expired" });
    if (["CANCELLED", "EXPIRED"].includes(interview.state)) throw new ConflictException({ code: "INVITATION_UNAVAILABLE", message: "Invitation is no longer available" });
  }

  private assertActiveInterview<T extends { invitationExpiresAt: Date | null; state: string }>(interview: T | null): asserts interview is T {
    if (!interview) throw new NotFoundException({ code: "INVITATION_NOT_FOUND", message: "Invitation not found" });
    if (!interview.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now()) throw new GoneException({ code: "INVITATION_EXPIRED", message: "Invitation has expired" });
    if (!["TECHNICAL", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "FOLLOW_UP", "INTRODUCTION", "STARTED"].includes(interview.state)) {
      throw new ConflictException({ code: "INTERVIEW_NOT_ACTIVE", message: "The interview is not accepting answers" });
    }
  }

  private stateForQuestion(type?: string): "TECHNICAL" | "CODING" | "SYSTEM_DESIGN" | "BEHAVIORAL" {
    if (type === "CODING") return "CODING";
    if (type === "SYSTEM_DESIGN") return "SYSTEM_DESIGN";
    if (type === "BEHAVIORAL") return "BEHAVIORAL";
    return "TECHNICAL";
  }

  private publicSession(session: { state: string; startedAt: Date; completedAt: Date | null; lastEventSequence: number }) {
    return { status: session.state, startedAt: session.startedAt, completedAt: session.completedAt, lastEventSequence: session.lastEventSequence };
  }

  private safeFileName(fileName: string) {
    const baseName = fileName.split(/[\\/]/).pop() ?? "resume.pdf";
    const cleaned = baseName.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 180);
    return cleaned || "resume.pdf";
  }

  private withoutResumeKey<T extends { resumeObjectKey?: string | null }>(candidate: T): Omit<T, "resumeObjectKey"> {
    const { resumeObjectKey: _privateKey, ...safeCandidate } = candidate;
    return safeCandidate;
  }

  private notFound(): never { throw new NotFoundException({ code: "CANDIDATE_NOT_FOUND", message: "Candidate not found" }); }
}
