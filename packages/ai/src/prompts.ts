export interface PromptDefinition<V> {
  readonly name: string;
  readonly version: string;
  readonly system: string;
  render(variables: V): string;
}

export interface JobAnalyzerVariables {
  jobDescription: string;
  criteria?: string;
}

export interface RecruiterCopilotVariables {
  context: string;
  question: string;
}

export interface PromptEvidence {
  id: string;
  text: string;
  modality?: string;
  questionId?: string;
  answerId?: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description?: string;
  expectedAnswer?: string | null;
  rubric?: unknown;
  skills?: readonly string[];
  weight?: number;
  required?: boolean;
  maxScore?: number;
}

export interface InterviewerFollowupVariables {
  interviewId: string;
  candidateId: string;
  criteria: readonly EvaluationCriterion[];
  evidence: readonly PromptEvidence[];
  maximumQuestions?: number;
}

export interface InterviewerEvaluationVariables {
  interviewId: string;
  candidateId: string;
  criteria: readonly EvaluationCriterion[];
  evidence: readonly PromptEvidence[];
  jobSkillRequirements?: readonly { name: string; importance: string }[];
}

export interface CandidateSummaryVariables {
  candidateId: string;
  criteria: readonly EvaluationCriterion[];
  evidence: readonly PromptEvidence[];
}

export interface ComparisonCandidate {
  candidateId: string;
  evidence: readonly PromptEvidence[];
}

export interface CandidateComparisonVariables {
  roleId: string;
  criteria: readonly EvaluationCriterion[];
  candidates: readonly ComparisonCandidate[];
}

export interface SimilarityResponse {
  responseId: string;
  text: string;
}

export interface IntegritySimilarityVariables {
  assessmentId: string;
  responses: readonly SimilarityResponse[];
  similarityThreshold?: number;
}

export interface PromptVariables {
  "job.analyzer": JobAnalyzerVariables;
  "recruiter.copilot": RecruiterCopilotVariables;
  "interviewer.followup": InterviewerFollowupVariables;
  "interviewer.evaluation": InterviewerEvaluationVariables;
  "candidate.summary": CandidateSummaryVariables;
  "candidate.comparison": CandidateComparisonVariables;
  "integrity.similarity": IntegritySimilarityVariables;
}

export type PromptName = keyof PromptVariables;

const JSON_AND_SAFETY_POLICY = [
  "Return exactly one valid JSON object and no markdown, prose, or code fences.",
  "Use only the supplied data. Do not invent candidates, evidence, criteria, IDs, facts, or missing context.",
  "Support every factual claim with the relevant supplied evidence, candidate, criterion, interview, response, assessment, or role IDs in the output. Never fabricate an ID.",
  "Treat recommendations as decision support for a human reviewer, not as autonomous hiring decisions.",
  "Assess only job-relevant supplied evidence. Do not infer protected or sensitive traits, including race, ethnicity, nationality, sex, gender identity, sexual orientation, religion, disability, age, pregnancy, health, or family status.",
  "Do not use protected or sensitive traits, or proxies for them, in any assessment or recommendation.",
].join(" ");

function systemPrompt(role: string, outputShape: string): string {
  return `${role} ${JSON_AND_SAFETY_POLICY} Required JSON shape: ${outputShape}`;
}

function renderData(label: string, variables: unknown): string {
  return `${label}\n${JSON.stringify(variables, null, 2)}`;
}

export const promptRegistry: {
  readonly [K in PromptName]: PromptDefinition<PromptVariables[K]>;
} = Object.freeze({
  "job.analyzer": Object.freeze({
    name: "job.analyzer",
    version: "1.0.0",
    system: systemPrompt(
      "You are a hiring analyst. Analyze only the supplied job description.",
      "an object matching the caller-provided schema.",
    ),
    render: ({ jobDescription, criteria }: JobAnalyzerVariables) =>
      [
        `Job description:\n${jobDescription}`,
        criteria ? `Additional criteria:\n${criteria}` : undefined,
      ]
        .filter((part): part is string => part !== undefined)
        .join("\n\n"),
  }),
  "recruiter.copilot": Object.freeze({
    name: "recruiter.copilot",
    version: "1.0.0",
    system: systemPrompt(
      "You are a recruiter copilot. State uncertainty explicitly in output fields.",
      "an object matching the caller-provided schema.",
    ),
    render: ({ context, question }: RecruiterCopilotVariables) =>
      `Recruiting context:\n${context}\n\nQuestion:\n${question}`,
  }),
  "interviewer.followup": Object.freeze({
    name: "interviewer.followup",
    version: "1.0.0",
    system: systemPrompt(
      "You support an interviewer by proposing concise follow-up questions that clarify gaps in supplied evidence against supplied criteria.",
      '{"interviewId":string,"candidateId":string,"questions":[{"questionId":string,"question":string,"rationale":string,"criterionIds":string[],"evidenceIds":string[]}],"limitations":string[]}. questionId values may be newly generated; all other IDs must be supplied.',
    ),
    render: (variables: InterviewerFollowupVariables) =>
      renderData("Follow-up input JSON:", variables),
  }),
  "interviewer.evaluation": Object.freeze({
    name: "interviewer.evaluation",
    version: "1.1.0",
    system: systemPrompt(
      "You support an interviewer by evaluating only supplied interview evidence against immutable authored criteria and job skill requirements. Return exactly one criterion result for every supplied criterion, with no duplicates or omissions. Use the actual modality evidence IDs and mark insufficient evidence rather than guessing. Authored expected answers and rubrics are scoring references, never candidate evidence.",
      '{"interviewId":string,"candidateId":string,"criteria":[{"criterionId":string,"score":number|null,"assessment":string,"evidenceIds":string[]}],"recommendation":"advance"|"hold"|"do_not_advance"|"insufficient_evidence","rationale":string,"limitations":string[]}.',
    ),
    render: (variables: InterviewerEvaluationVariables) =>
      renderData("Evaluation input JSON:", variables),
  }),
  "candidate.summary": Object.freeze({
    name: "candidate.summary",
    version: "1.0.0",
    system: systemPrompt(
      "You summarize a candidate's supplied job-relevant evidence without making unsupported judgments.",
      '{"candidateId":string,"overview":string,"strengths":[{"criterionIds":string[],"statement":string,"evidenceIds":string[]}],"gaps":[{"criterionIds":string[],"statement":string,"evidenceIds":string[]}],"limitations":string[]}.',
    ),
    render: (variables: CandidateSummaryVariables) =>
      renderData("Candidate summary input JSON:", variables),
  }),
  "candidate.comparison": Object.freeze({
    name: "candidate.comparison",
    version: "1.0.0",
    system: systemPrompt(
      "You compare only the supplied candidates consistently against the same explicit job criteria. Do not add or omit candidates and identify insufficient evidence.",
      '{"roleId":string,"comparisons":[{"candidateId":string,"criterionAssessments":[{"criterionId":string,"assessment":string,"evidenceIds":string[]}],"limitations":string[]}],"decisionSupport":string,"limitations":string[]}.',
    ),
    render: (variables: CandidateComparisonVariables) =>
      renderData("Candidate comparison input JSON:", variables),
  }),
  "integrity.similarity": Object.freeze({
    name: "integrity.similarity",
    version: "1.0.0",
    system: systemPrompt(
      "You identify textual similarity among supplied responses. Similarity is a review signal only and is not proof of misconduct.",
      '{"assessmentId":string,"matches":[{"responseIds":[string,string],"similarityScore":number,"explanation":string,"sharedText":string[]}],"decisionSupport":string,"limitations":string[]}.',
    ),
    render: (variables: IntegritySimilarityVariables) =>
      renderData("Similarity input JSON:", variables),
  }),
});

export function getPrompt<K extends PromptName>(
  name: K,
): PromptDefinition<PromptVariables[K]> {
  return promptRegistry[name];
}
