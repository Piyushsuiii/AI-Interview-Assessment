import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { createIntelligenceGateway, intelligenceDb, recordAiUsage } from "../evaluations/intelligence.types";

const followupSchema = z.object({
  interviewId: z.string().min(1),
  candidateId: z.string().min(1),
  questions: z.array(z.object({
    questionId: z.string().min(1),
    question: z.string().trim().min(1).max(5_000),
    rationale: z.string().trim().min(1).max(1_000),
    criterionIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
  }).strict()).max(1),
  limitations: z.array(z.string()),
}).strict();

@Injectable()
export class CandidateInterviewOrchestratorService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async afterTextAnswer(interviewId: string, parentQuestionId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { questions: { orderBy: { order: "asc" }, include: { answer: true } } },
    });
    if (!interview) throw new NotFoundException({ code: "INTERVIEW_NOT_FOUND", message: "Interview not found" });
    const parent = interview.questions.find((question) => question.id === parentQuestionId);
    if (!parent?.answer?.text) throw new NotFoundException({ code: "ANSWER_NOT_FOUND", message: "Submitted text answer not found" });
    const parentAnswerId = parent.answer.id;

    const db = intelligenceDb(this.prisma);
    const maxQuestions = this.config.get<number>("INTERVIEW_MAX_QUESTIONS") ?? 20;
    const existing = await db.interviewQuestion.findFirst({ where: { interviewId, parentQuestionId, isAdaptive: true } });
    if (existing || interview.questions.length >= maxQuestions) return { followup: existing ?? null, reason: existing ? "ALREADY_EXISTS" : "QUESTION_LIMIT" };

    let proposal = {
      prompt: "Please clarify the most important trade-off in your previous answer.",
      rationale: "Deterministic clarification fallback",
    };
    const gateway = createIntelligenceGateway(this.config);
    if (gateway) {
      try {
        const result = await gateway.generate({
          prompt: "interviewer.followup",
          variables: {
            interviewId,
            candidateId: interview.candidateId,
            criteria: [{ id: parent.id, name: parent.type, description: parent.prompt }],
            evidence: [{ id: parentAnswerId, text: parent.answer.text }],
            maximumQuestions: 1,
          },
          schema: followupSchema,
        });
        await recordAiUsage(this.prisma, interview.organizationId, "interviewer.followup", result.metadata.requestId, result.metadata.attempts);
        if (result.data.interviewId !== interviewId || result.data.candidateId !== interview.candidateId) throw new Error("Ungrounded follow-up identity");
        const question = result.data.questions[0];
        if (!question) return { followup: null, reason: "NOT_NEEDED" };
        if (question.criterionIds.some((id) => id !== parent.id) || question.evidenceIds.some((id) => id !== parentAnswerId)) throw new Error("Ungrounded follow-up IDs");
        proposal = { prompt: question.question, rationale: question.rationale };
      } catch {
        // The deterministic proposal keeps the candidate flow available when AI fails.
      }
    }
    const followupPrompt = proposal.prompt;
    return this.prisma.$transaction(async (tx) => {
      const tdb = intelligenceDb(tx);
      const duplicate = await tdb.interviewQuestion.findFirst({ where: { interviewId, parentQuestionId, isAdaptive: true } });
      const count = await tdb.interviewQuestion.count({ where: { interviewId } });
      if (duplicate || count >= maxQuestions) return { followup: duplicate ?? null, reason: duplicate ? "ALREADY_EXISTS" : "QUESTION_LIMIT" };

      const later = await tdb.interviewQuestion.findMany({ where: { interviewId, order: { gt: parent.order } }, orderBy: { order: "desc" } });
      for (const question of later) await tdb.interviewQuestion.update({ where: { id: question.id }, data: { order: question.order + 1 } });
      const followup = await tdb.interviewQuestion.create({ data: {
        interviewId,
        parentQuestionId,
        isAdaptive: true,
        adaptationReason: proposal.rationale,
        type: parent.type,
        prompt: followupPrompt,
        order: parent.order + 1,
        maxScore: parent.maxScore,
      } });
      const session = await tdb.interviewSession.update({ where: { interviewId }, data: { lastEventSequence: { increment: 1 } } });
      await tdb.interviewEvent.create({ data: {
        interviewId,
        sequence: session.lastEventSequence,
        type: "FOLLOWUP_GENERATED",
        payload: { parentQuestionId, questionId: followup.id, rationale: proposal.rationale },
        occurredAt: new Date(),
      } });
      return { followup, reason: gateway ? "AI_OR_FALLBACK" : "FALLBACK" };
    });
  }
}
