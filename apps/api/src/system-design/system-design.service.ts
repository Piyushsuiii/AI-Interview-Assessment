import { ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { hashToken } from "../common/crypto";
import { PrismaService } from "../prisma/prisma.service";
import { advanceInterview, currentUnansweredQuestion, progressionQuestionInclude } from "../interviews/interview-progression";
import type { SystemDesignInput } from "./system-design.schemas";

const ACTIVE_STATES = ["STARTED", "INTRODUCTION", "TECHNICAL", "FOLLOW_UP", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL"];

@Injectable()
export class SystemDesignService {
  constructor(private readonly prisma: PrismaService) {}

  async get(token: string, questionId: string) {
    const { question } = await this.context(token, questionId);
    const submission = await (this.prisma as any).systemDesignSubmission.findUnique({
      where: { interviewQuestionId: question.id },
      select: { diagram: true, explanation: true, submittedAt: true, updatedAt: true },
    });
    return { question: { id: question.id, prompt: question.prompt, maxScore: question.maxScore }, submission };
  }

  async put(token: string, questionId: string, input: SystemDesignInput) {
    const existing = await this.existingSubmission(token, questionId);
    if (existing) return { accepted: true, idempotent: true, ...existing };
    const { interview, question } = await this.context(token, questionId);
    const now = new Date();
    const submission = await this.prisma.$transaction(async (tx) => {
      const saved = await (tx as any).systemDesignSubmission.create({
        data: { interviewQuestionId: question.id, interviewId: interview.id, diagram: input.diagram, explanation: input.explanation, submittedAt: now },
        select: { id: true, diagram: true, explanation: true, submittedAt: true, updatedAt: true },
      });
      const progression = await advanceInterview(tx, interview.id, { questionId: question.id, evidenceId: saved.id });
      return { saved, progression };
    });
    const { id: _id, ...saved } = submission.saved;
    return { accepted: true, ...saved, ...submission.progression };
  }

  private async context(token: string, questionId: string) {
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
    const current = currentUnansweredQuestion(interview.questions);
    if (!current || current.id !== questionId) throw new ConflictException({ code: "QUESTION_NOT_CURRENT", message: "This system design question is not currently active" });
    const question = await (this.prisma as any).interviewQuestion.findFirst({
      where: { id: questionId, interviewId: interview.id, type: "SYSTEM_DESIGN" },
      select: { id: true, prompt: true, maxScore: true },
    });
    if (!question) throw new NotFoundException({ code: "SYSTEM_DESIGN_QUESTION_NOT_FOUND", message: "System design question not found" });
    return { interview, question };
  }

  private async existingSubmission(token: string, questionId: string) {
    const interview = await (this.prisma as any).interview.findUnique({
      where: { invitationTokenHash: hashToken(token) },
      select: {
        invitationExpiresAt: true,
        state: true,
        questions: {
          where: { id: questionId, type: "SYSTEM_DESIGN" },
          select: { systemDesignSubmission: { select: { diagram: true, explanation: true, submittedAt: true, updatedAt: true } } },
        },
      },
    });
    if (!interview?.invitationExpiresAt || interview.invitationExpiresAt.getTime() <= Date.now() || ["CANCELLED", "EXPIRED"].includes(interview.state)) return null;
    return interview.questions[0]?.systemDesignSubmission ?? null;
  }
}
