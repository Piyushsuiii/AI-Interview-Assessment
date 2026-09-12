import { z } from "zod";

const idListSchema = z.array(z.string());
const limitationListSchema = z.array(z.string());

export const interviewerFollowupOutputSchema = z.object({
  interviewId: z.string(),
  candidateId: z.string(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      question: z.string(),
      rationale: z.string(),
      criterionIds: idListSchema,
      evidenceIds: idListSchema,
    }),
  ),
  limitations: limitationListSchema,
});

export const interviewerEvaluationOutputSchema = z.object({
  interviewId: z.string(),
  candidateId: z.string(),
  criteria: z.array(
    z.object({
      criterionId: z.string(),
      score: z.number().nullable(),
      assessment: z.string(),
      evidenceIds: idListSchema,
    }),
  ),
  recommendation: z.enum([
    "advance",
    "hold",
    "do_not_advance",
    "insufficient_evidence",
  ]),
  rationale: z.string(),
  limitations: limitationListSchema,
});

const supportedStatementSchema = z.object({
  criterionIds: idListSchema,
  statement: z.string(),
  evidenceIds: idListSchema,
});

export const candidateSummaryOutputSchema = z.object({
  candidateId: z.string(),
  overview: z.string(),
  strengths: z.array(supportedStatementSchema),
  gaps: z.array(supportedStatementSchema),
  limitations: limitationListSchema,
});

export const candidateComparisonOutputSchema = z.object({
  roleId: z.string(),
  comparisons: z.array(
    z.object({
      candidateId: z.string(),
      criterionAssessments: z.array(
        z.object({
          criterionId: z.string(),
          assessment: z.string(),
          evidenceIds: idListSchema,
        }),
      ),
      limitations: limitationListSchema,
    }),
  ),
  decisionSupport: z.string(),
  limitations: limitationListSchema,
});

export const integritySimilarityOutputSchema = z.object({
  assessmentId: z.string(),
  matches: z.array(
    z.object({
      responseIds: z.tuple([z.string(), z.string()]),
      similarityScore: z.number().min(0).max(1),
      explanation: z.string(),
      sharedText: z.array(z.string()),
    }),
  ),
  decisionSupport: z.string(),
  limitations: limitationListSchema,
});

export type InterviewerFollowupOutput = z.infer<
  typeof interviewerFollowupOutputSchema
>;
export type InterviewerEvaluationOutput = z.infer<
  typeof interviewerEvaluationOutputSchema
>;
export type CandidateSummaryOutput = z.infer<typeof candidateSummaryOutputSchema>;
export type CandidateComparisonOutput = z.infer<
  typeof candidateComparisonOutputSchema
>;
export type IntegritySimilarityOutput = z.infer<
  typeof integritySimilarityOutputSchema
>;
