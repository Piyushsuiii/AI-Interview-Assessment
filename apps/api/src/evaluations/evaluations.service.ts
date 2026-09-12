import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type { EvaluateInterviewInput, OverrideEvaluationInput } from "@ai-hiring-platform/validation";
import { PrismaService } from "../prisma/prisma.service";
import { createIntelligenceGateway, intelligenceDb, recordAiUsage } from "./intelligence.types";
import { notifyOrganization } from "../notifications/notification-events";

const evaluationAiSchema = z.object({
  interviewId: z.string().min(1),
  candidateId: z.string().min(1),
  criteria: z.array(z.object({
    criterionId: z.string().min(1),
    score: z.number().min(0).max(100).nullable(),
    assessment: z.string().trim().min(1).max(5_000),
    evidenceIds: z.array(z.string().min(1)).max(50),
  }).strict()).min(1).max(100),
  recommendation: z.enum(["advance", "hold", "do_not_advance", "insufficient_evidence"]),
  rationale: z.string().trim().min(1).max(10_000),
  limitations: z.array(z.string().max(2_000)).max(50),
}).strict();

type EvaluationOutput = {
  score: number;
  confidence: number;
  recommendation: "STRONG_HIRE" | "HIRE" | "LEAN_HIRE" | "LEAN_NO_HIRE" | "NO_HIRE" | "NEEDS_REVIEW";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  competencies: Array<{ name: string; score: number; confidence: number; summary: string; evidence: Array<{ questionId: string; answerId?: string; excerpt: string; rationale: string }> }>;
};

type Recommendation = EvaluationOutput["recommendation"];

type EvaluationCriterionContext = {
  id: string;
  name: string;
  description: string;
  expectedAnswer: string | null;
  rubric: unknown;
  skills: string[];
  weight: number;
  required: boolean;
  maxScore: number;
};

type EvaluationSource = {
  id: string;
  text: string;
  modality: string;
  questionId?: string;
  answerId?: string;
};

type EvaluationPromptInput = {
  variables: {
    interviewId: string;
    candidateId: string;
    criteria: EvaluationCriterionContext[];
    jobSkillRequirements: Array<{ name: string; importance: string }>;
    evidence: EvaluationSource[];
  };
  criteria: EvaluationCriterionContext[];
  sources: EvaluationSource[];
  interviewId: string;
  candidateId: string;
};

export function evaluationRecommendation(score: number, confidence: number, coverage: number): Recommendation {
  if (Math.max(0, Math.min(1, confidence)) < 0.5 || Math.max(0, Math.min(1, coverage)) < 0.7) return "NEEDS_REVIEW";
  if (score >= 85) return "STRONG_HIRE";
  if (score >= 70) return "HIRE";
  if (score >= 60) return "LEAN_HIRE";
  if (score >= 45) return "LEAN_NO_HIRE";
  return "NO_HIRE";
}

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async evaluate(organizationId: string, interviewId: string, input: EvaluateInterviewInput, userId: string) {
    const db = intelligenceDb(this.prisma);
    const completed = await db.evaluation.findFirst({
      where: { interviewId, interview: { organizationId }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: { competencies: { include: { evidence: true } } },
    });
    if (completed && !input.force) return completed;

    const interview = await db.interview.findFirst({
      where: { id: interviewId, organizationId },
      include: {
        candidate: { select: { id: true, jobId: true, firstName: true, lastName: true, email: true } },
        assessment: {
          select: {
            activeVersion: {
              select: { questions: { select: { questionVersionId: true, weight: true, required: true } } },
            },
            job: { select: { skills: { select: { name: true, importance: true } } } },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          include: {
            answer: true,
            questionVersion: { select: { expectedAnswer: true, rubric: true, skills: true, maxScore: true } },
            systemDesignSubmission: true,
            codingChallenge: { include: { submissions: { orderBy: { submittedAt: "desc" }, include: { executions: true } } } },
          },
        },
        integrityEvents: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!interview) throw new NotFoundException({ code: "INTERVIEW_NOT_FOUND", message: "Interview not found" });
    if (!input.force && interview.state !== "EVALUATION") {
      throw new ConflictException({ code: "INTERVIEW_NOT_READY_FOR_EVALUATION", message: "The candidate has not completed the interview" });
    }
    if (input.force && !["EVALUATION", "COMPLETED"].includes(interview.state)) {
      throw new ConflictException({ code: "INTERVIEW_NOT_READY_FOR_EVALUATION", message: "The candidate has not completed the interview" });
    }

    const context = this.buildContext(interview);
    if (!context.questions.some((question: any) => question.answer || question.code || question.systemDesign)) {
      throw new BadRequestException({ code: "NO_EVALUATION_EVIDENCE", message: "The interview has no submitted evidence" });
    }
    const promptInput = this.buildPromptInput(interview, context);
    await db.evaluation.upsert({
      where: { interviewId },
      create: { interviewId, organizationId, status: "PROCESSING", reasoningSummary: "Evaluation in progress" },
      update: { status: "PROCESSING", error: null },
    });

    let result;
    let output: EvaluationOutput;
    try {
      const gateway = createIntelligenceGateway(this.config);
      if (!gateway) throw new ServiceUnavailableException({ code: "AI_NOT_CONFIGURED", message: "No AI provider is configured" });
      result = await gateway.generate({
        prompt: "interviewer.evaluation",
        variables: promptInput.variables,
        schema: evaluationAiSchema,
      });
      await recordAiUsage(this.prisma, organizationId, "interviewer.evaluation", result.metadata.requestId, result.metadata.attempts, userId);
      output = this.toEvaluationOutput(result.data, promptInput, context.questions);
    } catch (error) {
      await this.persistFailure(organizationId, interviewId, error);
      throw error;
    }

    const evaluation = await this.prisma.$transaction(async (tx) => {
      const tdb = intelligenceDb(tx);
      const evaluationData = {
        organizationId,
        status: "COMPLETED",
        overallScore: output.score,
        confidence: output.confidence,
        recommendation: output.recommendation,
        reasoningSummary: output.summary,
        strengths: output.strengths,
        weaknesses: output.weaknesses,
        model: result.metadata.model,
        provider: result.metadata.provider,
        promptVersion: result.metadata.prompt.version,
        error: null,
      };
      const created = await tdb.evaluation.upsert({
        where: { interviewId },
        create: { interviewId, ...evaluationData },
        update: evaluationData,
      });
      await tdb.competencyEvaluation.deleteMany({ where: { evaluationId: created.id } });
      for (const competency of output.competencies) {
        const saved = await tdb.competencyEvaluation.create({ data: {
          evaluationId: created.id,
          name: competency.name,
          score: competency.score,
          confidence: competency.confidence,
          summary: competency.summary,
        } });
        if (competency.evidence.length) await tdb.evaluationEvidence.createMany({ data: competency.evidence.map((evidence) => ({
          competencyEvaluationId: saved.id,
          interviewQuestionId: evidence.questionId,
          answerId: evidence.answerId,
          quote: evidence.excerpt,
          rationale: evidence.rationale,
        })) });
        await tdb.candidateSkill.upsert({
          where: { candidateId_name: { candidateId: interview.candidate.id, name: competency.name } },
          create: { candidateId: interview.candidate.id, name: competency.name, score: competency.score, confidence: competency.confidence },
          update: { score: competency.score, confidence: competency.confidence },
        });
      }
      const snapshot = this.reportSnapshot(interview, created.id, output);
      await tdb.report.upsert({
        where: { interviewId },
        create: { organizationId, interviewId, recommendation: output.recommendation, overallScore: output.score, confidence: output.confidence, snapshot },
        update: { recommendation: output.recommendation, overallScore: output.score, confidence: output.confidence, snapshot, generatedAt: new Date() },
      });
      const now = new Date();
      const firstCompletion = interview.state !== "COMPLETED";
      const session = await tdb.interviewSession.update({
        where: { interviewId },
        data: {
          state: "COMPLETED",
          lastEventSequence: { increment: firstCompletion ? 2 : 1 },
        },
      });
      const evaluationSequence = firstCompletion ? session.lastEventSequence - 1 : session.lastEventSequence;
      await tdb.interviewEvent.create({ data: { interviewId, sequence: evaluationSequence, type: "EVALUATION_COMPLETED", payload: { evaluationId: created.id }, occurredAt: now } });
      if (firstCompletion) {
        await tdb.interviewEvent.create({ data: { interviewId, sequence: session.lastEventSequence, type: "INTERVIEW_COMPLETED", payload: { evaluationId: created.id }, occurredAt: now } });
      }
      await tdb.interview.update({
        where: { id: interviewId },
        data: { state: "COMPLETED", currentSection: "COMPLETED", score: output.score, recommendation: output.recommendation, completedAt: interview.completedAt ?? now },
      });
      await tdb.candidate.update({ where: { id: interview.candidate.id }, data: { status: "COMPLETED" } });
      const candidateName = [interview.candidate.firstName, interview.candidate.lastName].filter(Boolean).join(" ") || interview.candidate.email;
      await notifyOrganization(tx, organizationId, {
        type: "EVALUATION_COMPLETED",
        title: "Evaluation completed",
        message: `${candidateName}'s evaluation is ready for review.`,
        href: `/interviews/${interviewId}`,
        dedupeKey: `evaluation-completed:${created.id}:${created.updatedAt.toISOString()}`,
        metadata: { interviewId, evaluationId: created.id },
      });
      if (firstCompletion) await notifyOrganization(tx, organizationId, {
        type: "INTERVIEW_COMPLETED",
        title: "Interview completed",
        message: `${candidateName} completed their interview.`,
        href: `/interviews/${interviewId}`,
        dedupeKey: `interview-completed:${interviewId}`,
        metadata: { interviewId, candidateId: interview.candidate.id },
      });
      return tdb.evaluation.findFirst({ where: { id: created.id }, include: { competencies: { include: { evidence: true } } } });
    });
    return evaluation;
  }

  async get(organizationId: string, interviewId: string) {
    const evaluation = await intelligenceDb(this.prisma).evaluation.findFirst({
      where: { interviewId, interview: { organizationId }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: { competencies: { include: { evidence: true } } },
    });
    if (!evaluation) throw new NotFoundException({ code: "EVALUATION_NOT_FOUND", message: "Evaluation not found" });
    return evaluation;
  }

  async override(organizationId: string, interviewId: string, input: OverrideEvaluationInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const db = intelligenceDb(tx);
      const evaluation = await db.evaluation.findFirst({
        where: { interviewId, interview: { organizationId }, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      });
      if (!evaluation) throw new NotFoundException({ code: "EVALUATION_NOT_FOUND", message: "Evaluation not found" });
      const previous = { recommendation: evaluation.overrideRecommendation ?? evaluation.recommendation };
      const updated = await db.evaluation.update({ where: { id: evaluation.id }, data: {
        overrideRecommendation: input.recommendation,
        overrideReason: input.reason,
        overriddenById: userId,
        overriddenAt: new Date(),
      } });
      await db.auditLog.create({ data: {
        organizationId,
        userId,
        action: "evaluation.override",
        metadata: { interviewId, evaluationId: evaluation.id, reason: input.reason, previous, next: { recommendation: input.recommendation } },
      } });
      return updated;
    });
  }

  assertEvidenceGrounded(output: EvaluationOutput, questions: Array<{ id: string; answer: { id: string; text?: string | null } | null }>) {
    const allowed = new Map(questions.map((item) => [item.id, item.answer?.id]));
    for (const competency of output.competencies) for (const evidence of competency.evidence) {
      if (!allowed.has(evidence.questionId) || (evidence.answerId !== undefined && allowed.get(evidence.questionId) !== evidence.answerId)) {
        throw new BadRequestException({ code: "UNGROUNDED_EVIDENCE", message: "AI evidence referenced an answer outside the evaluation context" });
      }
      const source = evidence.answerId ? questions.find((item) => item.id === evidence.questionId)?.answer?.text : undefined;
      if (source && !source.toLocaleLowerCase().includes(evidence.excerpt.toLocaleLowerCase())) {
        throw new BadRequestException({ code: "UNGROUNDED_EVIDENCE", message: "AI evidence excerpt was not found in the referenced answer" });
      }
    }
  }

  private buildPromptInput(interview: any, context: ReturnType<EvaluationsService["buildContext"]>): EvaluationPromptInput {
    const evaluatedQuestions = context.questions.filter((question: any) => question.authored && (question.required || question.answer || question.code || question.systemDesign));
    const criteria: EvaluationCriterionContext[] = evaluatedQuestions.map((question: any) => ({
      id: question.id,
      name: question.skills.length ? question.skills.join(", ") : question.type,
      description: question.prompt,
      expectedAnswer: question.expectedAnswer,
      rubric: question.rubric,
      skills: question.skills,
      weight: question.weight,
      required: question.required,
      maxScore: question.maxScore,
    }));
    const sources: EvaluationSource[] = [];
    for (const question of context.questions) {
      if (question.answer?.text) sources.push({ id: question.answer.id, text: question.answer.text, modality: "TEXT", questionId: question.id, answerId: question.answer.id });
      if (question.code) sources.push({ id: question.code.id, text: JSON.stringify(question.code), modality: "CODE", questionId: question.id });
      if (question.systemDesign) sources.push({ id: question.systemDesign.id, text: JSON.stringify(question.systemDesign), modality: "SYSTEM_DESIGN", questionId: question.id });
    }
    for (const event of context.integrity) sources.push({ id: event.id, text: JSON.stringify(event), modality: "INTEGRITY_SIGNAL" });
    return {
      variables: {
        interviewId: interview.id,
        candidateId: interview.candidate.id,
        criteria,
        jobSkillRequirements: context.jobSkillRequirements,
        evidence: sources,
      },
      criteria,
      sources,
      interviewId: interview.id,
      candidateId: interview.candidate.id,
    };
  }

  private toEvaluationOutput(
    ai: z.infer<typeof evaluationAiSchema>,
    input: EvaluationPromptInput,
    questions: Array<{ id: string; answer: { id: string; text?: string | null } | null }>,
  ): EvaluationOutput {
    if (ai.interviewId !== input.interviewId || ai.candidateId !== input.candidateId) this.ungroundedEvidence();
    const criterionById = new Map(input.criteria.map((criterion) => [criterion.id, criterion]));
    const sourceById = new Map(input.sources.map((source) => [source.id, source]));
    if (ai.criteria.some((criterion) => !criterionById.has(criterion.criterionId) || criterion.evidenceIds.some((id) => !sourceById.has(id)))) this.ungroundedEvidence();

    const returnedIds = ai.criteria.map((criterion) => criterion.criterionId);
    const uniqueIds = new Set(returnedIds);
    if (uniqueIds.size !== returnedIds.length) {
      throw new BadRequestException({ code: "DUPLICATE_EVALUATION_CRITERION", message: "AI output contained duplicate evaluation criteria" });
    }
    const missingIds = input.criteria.filter((criterion) => !uniqueIds.has(criterion.id)).map((criterion) => criterion.id);
    if (missingIds.length || ai.criteria.length !== input.criteria.length) {
      throw new BadRequestException({ code: "INCOMPLETE_EVALUATION_CRITERIA", message: "AI output must contain exactly one result for every evaluated question", missingCriterionIds: missingIds });
    }

    const assessed = ai.criteria.filter((criterion) => criterion.score !== null);
    const competencies = ai.criteria.map((criterion) => {
      const definition = criterionById.get(criterion.criterionId)!;
      const evidence = criterion.evidenceIds.flatMap((id) => {
        const source = sourceById.get(id)!;
        return source.questionId ? [{
          questionId: source.questionId,
          answerId: source.answerId,
          excerpt: source.text.slice(0, 2_000),
          rationale: criterion.assessment,
        }] : [];
      });
      return {
        name: definition.name,
        score: criterion.score ?? 0,
        confidence: criterion.score === null ? 0 : Math.max(0, Math.min(1, evidence.length ? 0.6 + evidence.length * 0.1 : 0.25)),
        summary: criterion.assessment,
        evidence,
      };
    });
    const authoredWeight = (criterionId: string) => {
      const criterion = criterionById.get(criterionId)!;
      return Math.max(0, criterion.weight * criterion.maxScore);
    };
    const totalWeight = input.criteria.reduce((sum, criterion) => sum + Math.max(0, criterion.weight * criterion.maxScore), 0);
    const assessedWeight = assessed.reduce((sum, criterion) => sum + authoredWeight(criterion.criterionId), 0);
    const score = assessedWeight
      ? assessed.reduce((sum, criterion) => sum + criterion.score! * authoredWeight(criterion.criterionId), 0) / assessedWeight
      : 0;
    const confidence = totalWeight
      ? Math.max(0, Math.min(1, competencies.reduce((sum, competency, index) => sum + competency.confidence * authoredWeight(ai.criteria[index].criterionId), 0) / totalWeight))
      : 0;
    const coverage = totalWeight ? Math.max(0, Math.min(1, assessedWeight / totalWeight)) : 0;
    const recommendation = evaluationRecommendation(score, confidence, coverage);
    const output: EvaluationOutput = {
      score,
      confidence,
      recommendation,
      summary: [ai.rationale, ...ai.limitations].join("\n"),
      strengths: competencies.filter((item) => item.score >= 70).map((item) => item.name),
      weaknesses: competencies.filter((item) => item.score < 50).map((item) => item.name),
      competencies,
    };
    this.assertEvidenceGrounded(output, questions);
    return output;
  }

  private ungroundedEvidence(): never {
    throw new BadRequestException({ code: "UNGROUNDED_EVIDENCE", message: "AI evidence referenced an ID outside the evaluation context" });
  }

  private buildContext(interview: any) {
    const assessmentLinks = new Map(
      (interview.assessment.activeVersion?.questions ?? []).map((link: any) => [link.questionVersionId, link]),
    );
    return {
      interviewId: interview.id,
      questions: interview.questions.map((question: any) => {
        const assessmentLink: any = question.questionVersionId ? assessmentLinks.get(question.questionVersionId) : undefined;
        return {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        maxScore: question.maxScore,
        authored: Boolean(assessmentLink && question.questionVersion),
        expectedAnswer: question.questionVersion?.expectedAnswer ?? null,
        rubric: question.questionVersion?.rubric ?? null,
        skills: question.questionVersion?.skills ?? [],
        weight: assessmentLink?.weight ?? 0,
        required: assessmentLink?.required ?? false,
        answer: question.answer ? { id: question.answer.id, text: question.answer.text, submittedAt: question.answer.submittedAt } : null,
        code: question.codingChallenge?.submissions?.[0] ? {
          id: question.codingChallenge.submissions[0].id,
          language: question.codingChallenge.submissions[0].language,
          code: question.codingChallenge.submissions[0].code,
          explanation: question.codingChallenge.submissions[0].explanation,
          score: question.codingChallenge.submissions[0].score,
          executions: question.codingChallenge.submissions[0].executions,
        } : null,
        systemDesign: question.systemDesignSubmission ? { id: question.systemDesignSubmission.id, diagram: question.systemDesignSubmission.diagram, explanation: question.systemDesignSubmission.explanation } : null,
        };
      }),
      jobSkillRequirements: interview.assessment.job?.skills ?? [],
      integrity: interview.integrityEvents.map((event: any) => ({ id: event.id, type: event.type, riskScore: event.riskScore, details: event.details, occurredAt: event.occurredAt })),
    };
  }

  private async persistFailure(organizationId: string, interviewId: string, error: unknown) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    try {
      await intelligenceDb(this.prisma).evaluation.upsert({
        where: { interviewId },
        create: { interviewId, organizationId, status: "FAILED", reasoningSummary: "Evaluation failed", error: message.slice(0, 10_000) },
        update: { status: "FAILED", error: message.slice(0, 10_000) },
      });
    } catch {
      // Preserve the provider or validation error when failure-state persistence is unavailable.
    }
  }

  private reportSnapshot(interview: any, evaluationId: string, output: EvaluationOutput) {
    const codingSubmissions = interview.questions
      .map((question: any) => question.codingChallenge?.submissions?.[0])
      .filter(Boolean);
    const codingScores = codingSubmissions
      .map((submission: any) => submission.score)
      .filter((score: unknown): score is number => typeof score === "number");
    const systemDesignSubmissions = interview.questions
      .map((question: any) => question.systemDesignSubmission)
      .filter(Boolean);
    const integrityRisk = Math.min(
      100,
      interview.integrityEvents.reduce(
        (sum: number, event: any) => sum + (typeof event.riskScore === "number" ? event.riskScore : 0),
        0,
      ),
    );
    return {
      version: 1,
      evaluationId,
      interviewId: interview.id,
      candidateId: interview.candidate.id,
      score: output.score,
      confidence: output.confidence,
      recommendation: output.recommendation,
      summary: output.summary,
      competencies: output.competencies.map(({ evidence, ...competency }) => ({ ...competency, evidenceCount: evidence.length })),
      coding: codingSubmissions.length ? {
        score: codingScores.length ? codingScores.reduce((sum: number, score: number) => sum + score, 0) / codingScores.length : null,
        summary: `${codingSubmissions.length} coding submission${codingSubmissions.length === 1 ? "" : "s"} reviewed.`,
        evidence: codingSubmissions.map((submission: any) => ({ id: submission.id, status: submission.status, language: submission.language })),
      } : null,
      systemDesign: systemDesignSubmissions.length ? {
        summary: `${systemDesignSubmissions.length} structured system design submission${systemDesignSubmissions.length === 1 ? "" : "s"} reviewed.`,
        evidence: systemDesignSubmissions.map((submission: any) => ({ id: submission.id, submittedAt: submission.submittedAt })),
      } : null,
      integrity: {
        status: interview.integrityEvents.length ? "SIGNALS_RECORDED" : "NO_SIGNALS_RECORDED",
        riskScore: integrityRisk,
        summary: "Integrity signals require manual review and are not proof of misconduct.",
        flags: interview.integrityEvents.map((event: any) => event.type),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
