import { BadRequestException, ConflictException, GoneException, Inject, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import type { Queue } from "bullmq";
import { CODE_EXECUTION_JOB, type CodeExecutionJob } from "@ai-hiring-platform/events";
import { hashToken } from "../common/crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CODE_EXECUTION_QUEUE } from "./coding.queue";
import type { CodeRequest } from "./coding.schemas";
import { advanceInterview, currentUnansweredQuestion, progressionQuestionInclude } from "../interviews/interview-progression";

const ACTIVE_STATES = ["STARTED", "INTRODUCTION", "TECHNICAL", "FOLLOW_UP", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "EVALUATION"];
const EXECUTABLE_LANGUAGES = ["javascript", "typescript", "python"];

@Injectable()
export class CodingService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CODE_EXECUTION_QUEUE) private readonly queue: Queue<CodeExecutionJob>,
  ) {}

  async onModuleDestroy() { await this.queue.close(); }

  async getChallenge(token: string, questionId: string) {
    const { question, challenge } = await this.context(token, questionId);
    return {
      questionId: question.id,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        allowedLanguages: challenge.allowedLanguages,
        starterCode: challenge.starterCode,
        publicTests: challenge.publicTests,
        timeLimitMs: challenge.timeLimitMs,
        memoryLimitMb: challenge.memoryLimitMb,
      },
    };
  }

  run(token: string, questionId: string, input: CodeRequest) {
    return this.enqueue(token, questionId, input, false);
  }

  submit(token: string, questionId: string, input: CodeRequest) {
    return this.enqueue(token, questionId, input, true);
  }

  async execution(token: string, executionId: string) {
    const interview = await this.activeInterview(token);
    const execution = await (this.prisma as any).codeExecution.findFirst({
      where: { id: executionId, submission: { interviewId: interview.id } },
      select: { id: true, status: true, durationMs: true, stdout: true, stderr: true, exitCode: true, passedTests: true, totalTests: true, error: true, createdAt: true, updatedAt: true },
    });
    if (!execution) throw new NotFoundException({ code: "EXECUTION_NOT_FOUND", message: "Execution not found" });
    return execution;
  }

  private async enqueue(token: string, questionId: string, input: CodeRequest, submitted: boolean) {
    if (submitted) {
      const existing = await this.existingFinalSubmission(token, questionId);
      if (existing) {
        if (existing.language !== input.language || existing.code !== input.sourceCode || existing.explanation !== (input.explanation ?? null)) {
          throw new ConflictException({ code: "FINAL_SUBMISSION_EXISTS", message: "A final submission already exists for this question" });
        }
        return { executionId: existing.executions[0].id, status: existing.executions[0].status, submitted: true, idempotent: true };
      }
    }
    const { interview, question, challenge } = await this.context(token, questionId);
    if (!EXECUTABLE_LANGUAGES.includes(input.language)) {
      throw new BadRequestException({ code: "LANGUAGE_UNSUPPORTED", message: "Language is not supported by the execution worker" });
    }
    const allowed = (challenge.allowedLanguages as string[]).map((item) => item.toLowerCase());
    if (!allowed.includes(input.language)) {
      throw new BadRequestException({ code: "LANGUAGE_NOT_ALLOWED", message: "Language is not allowed for this challenge" });
    }
    const maximum = 100_000;
    if (Buffer.byteLength(input.sourceCode, "utf8") > maximum) {
      throw new BadRequestException({ code: "CODE_TOO_LARGE", message: `Source code exceeds ${maximum} bytes` });
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const submission = await (tx as any).codeSubmission.create({
        data: {
          challengeId: challenge.id,
          interviewId: interview.id,
          language: input.language,
          code: input.sourceCode,
          explanation: input.explanation,
          isFinal: submitted,
          status: "QUEUED",
          submittedAt: new Date(),
        },
        select: { id: true },
      });
      const execution = await (tx as any).codeExecution.create({
        data: { submissionId: submission.id, status: "QUEUED" },
        select: { id: true, status: true },
      });
      return { submission, execution };
    });

    const payload = { executionId: record.execution.id, submissionId: record.submission.id, challengeId: challenge.id };
    await (this.prisma as any).codeExecution.update({ where: { id: record.execution.id }, data: { workerJobId: record.execution.id } });
    try {
      await this.queue.add(CODE_EXECUTION_JOB, payload, { jobId: record.execution.id });
    } catch {
      await (this.prisma as any).codeExecution.update({ where: { id: record.execution.id }, data: { status: "FAILED", error: "Unable to enqueue execution" } });
      await (this.prisma as any).codeSubmission.update({ where: { id: record.submission.id }, data: { status: "FAILED", isFinal: false } });
      throw new ConflictException({ code: "EXECUTION_QUEUE_UNAVAILABLE", message: "Code execution is temporarily unavailable" });
    }
    const progression = submitted
      ? await this.prisma.$transaction((tx) => advanceInterview(tx, interview.id, { questionId: question.id, evidenceId: record.submission.id }))
      : undefined;
    return { executionId: record.execution.id, status: record.execution.status, submitted, ...(progression ?? {}) };
  }

  private async context(token: string, questionId: string) {
    const interview = await this.activeInterview(token);
    const current = currentUnansweredQuestion(interview.questions);
    if (!current || current.id !== questionId) {
      throw new ConflictException({ code: "QUESTION_NOT_CURRENT", message: "This coding question is not currently active" });
    }
    const question = await (this.prisma as any).interviewQuestion.findFirst({
      where: { id: questionId, interviewId: interview.id, type: "CODING" },
      select: { id: true },
    });
    if (!question) throw new NotFoundException({ code: "CODING_QUESTION_NOT_FOUND", message: "Coding question not found" });
    const challenge = await (this.prisma as any).codingChallenge.findUnique({ where: { interviewQuestionId: question.id } });
    if (!challenge) throw new NotFoundException({ code: "CODING_CHALLENGE_NOT_FOUND", message: "Coding challenge not found" });
    return { interview, question, challenge };
  }

  private async activeInterview(token: string) {
    const interview = await (this.prisma as any).interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      select: {
        id: true,
        state: true,
        invitationExpiresAt: true,
        questions: { orderBy: { order: "asc" }, include: progressionQuestionInclude },
      },
    });
    if (!interview) throw new NotFoundException({ code: "INVITATION_NOT_FOUND", message: "Invitation not found" });
    if (!interview.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now()) throw new GoneException({ code: "INVITATION_EXPIRED", message: "Invitation has expired" });
    if (!ACTIVE_STATES.includes(interview.state)) throw new ConflictException({ code: "INTERVIEW_NOT_ACTIVE", message: "The interview is not active" });
    return interview;
  }

  private async existingFinalSubmission(token: string, questionId: string) {
    const interview = await (this.prisma as any).interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      select: {
        invitationExpiresAt: true,
        state: true,
        questions: {
          where: { id: questionId, type: "CODING" },
          select: {
            codingChallenge: {
              select: {
                submissions: {
                  where: { isFinal: true },
                  take: 1,
                  select: { language: true, code: true, explanation: true, executions: { take: 1, select: { id: true, status: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!interview?.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now() || ["CANCELLED", "EXPIRED"].includes(interview.state)) return null;
    const submission = interview.questions[0]?.codingChallenge?.submissions[0];
    return submission?.executions[0] ? submission : null;
  }
}
