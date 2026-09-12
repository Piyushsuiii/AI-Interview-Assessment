import { apiRequest, type Candidate } from "@/lib/api";

export type Evidence = {
  id?: string;
  quote?: string;
  text?: string;
  source?: string;
  questionId?: string;
  timestampMs?: number;
  rationale?: string;
};

export type Competency = {
  id?: string;
  name: string;
  score?: number | null;
  confidence?: number | null;
  summary?: string | null;
  evidence?: Evidence[];
};

export type InterviewReplay = {
  id: string;
  state?: string;
  status?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  candidate?: { id: string; firstName?: string | null; lastName?: string | null; email: string };
  assessment?: { id: string; title: string };
  evaluation?: { id?: string; status: string; updatedAt?: string; error?: string | null } | null;
  timeline?: Array<{
    id: string;
    type: string;
    sequence?: number;
    timestamp?: string;
    timestampMs?: number;
    prompt?: string | null;
    answer?: string | null;
    detail?: string | null;
    evidence?: Evidence[];
    integrity?: { type?: string; severity?: string; detail?: string } | null;
  }>;
};

export type InterviewReport = {
  id?: string;
  interviewId: string;
  status?: string;
  recommendation?: string | null;
  score?: number | null;
  confidence?: number | null;
  summary?: string | null;
  candidate?: { id: string; firstName?: string | null; lastName?: string | null; email: string };
  assessment?: { id: string; title: string };
  competencies?: Competency[];
  strengths?: Array<string | Evidence>;
  weaknesses?: Array<string | Evidence>;
  evidence?: Evidence[];
  coding?: { score?: number | null; summary?: string | null; evidence?: Evidence[] } | null;
  systemDesign?: { score?: number | null; summary?: string | null; evidence?: Evidence[] } | null;
  integrity?: { status?: string; score?: number | null; summary?: string | null; flags?: Array<string | Evidence> } | null;
  override?: { recommendation: string; reason: string; createdAt?: string; actor?: { name?: string; email?: string } } | null;
  updatedAt?: string;
};

export type ComparisonCandidate = {
  candidateId: string;
  candidate: { id: string; firstName?: string | null; lastName?: string | null; email: string };
  job?: { id: string; title: string } | null;
  recommendation?: string | null;
  score?: number | null;
  confidence?: number | null;
  competencies?: Competency[];
  strengths?: string[];
  risks?: string[];
  reportId?: string | null;
  interviewId?: string | null;
};

export type Comparison = {
  candidates: ComparisonCandidate[];
  competencies?: string[];
  generatedAt?: string;
};

export type CopilotRecord = Record<string, unknown> & {
  id?: string;
  candidateId?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
};

export type CopilotResult = {
  answer?: string | null;
  tool: { name: string; arguments?: Record<string, unknown> };
  records: CopilotRecord[];
};

export type CopilotToolInput =
  | { tool: "list_candidates"; filters?: { jobId?: string; status?: string; minimumScore?: number; limit?: number }; includeNarrative?: boolean }
  | { tool: "compare_candidates"; candidateIds: string[]; includeNarrative?: boolean }
  | { tool: "explain_score"; candidateId: string; includeNarrative?: boolean }
  | { tool: "review_priority"; jobId?: string; limit?: number; includeNarrative?: boolean };

const orgPath = (organizationId: string, path: string) =>
  `/organizations/${encodeURIComponent(organizationId)}${path}`;

export async function getInterviewReplay(organizationId: string, interviewId: string) {
  const replay = await apiRequest<RawReplay>(
    orgPath(organizationId, `/interviews/${encodeURIComponent(interviewId)}/replay`),
    {},
    organizationId,
  );
  const evaluation = await apiRequest<RawEvaluation>(
    orgPath(organizationId, `/interviews/${encodeURIComponent(interviewId)}/evaluation`),
    {},
    organizationId,
  ).catch((error: unknown) => {
    if (typeof error === "object" && error && "status" in error && error.status === 404) return null;
    throw error;
  });
  const questionEvents: NonNullable<InterviewReplay["timeline"]> = replay.questions.map((question) => ({
    id: `question-${question.id}`,
    type: question.answer ? "ANSWER_SUBMITTED" : "QUESTION_PRESENTED",
    sequence: question.order * 10,
    timestamp: question.answer?.submittedAt ?? question.createdAt,
    prompt: question.prompt,
    answer: question.answer?.text ?? null,
  }));
  const systemEvents: NonNullable<InterviewReplay["timeline"]> = replay.events.map((event) => ({
    id: event.id,
    type: event.type,
    sequence: event.sequence * 10 + 1,
    timestamp: event.occurredAt ?? event.createdAt,
    detail: describePayload(event.payload),
  }));
  const integrityEvents: NonNullable<InterviewReplay["timeline"]> = replay.integrityMarkers.map((event, index) => ({
    id: event.id,
    type: `INTEGRITY_${event.type}`,
    sequence: 1_000_000 + index,
    timestamp: event.occurredAt ?? event.clientTimestamp ?? event.createdAt,
    integrity: { type: event.type, severity: riskSeverity(event.riskScore ?? event.riskWeight), detail: describePayload(event.details) ?? undefined },
  }));
  return {
    id: replay.interview.id,
    state: replay.interview.state,
    startedAt: replay.interview.startedAt,
    completedAt: replay.interview.completedAt,
    candidate: replay.interview.candidate,
    assessment: replay.interview.assessment,
    evaluation: evaluation ? { id: evaluation.id, status: evaluation.status, updatedAt: evaluation.updatedAt, error: evaluation.error } : null,
    timeline: [...questionEvents, ...systemEvents, ...integrityEvents],
  };
}

export function triggerEvaluation(organizationId: string, interviewId: string, force = false) {
  return apiRequest<RawEvaluation>(
    orgPath(organizationId, `/interviews/${encodeURIComponent(interviewId)}/evaluate`),
    { method: "POST", body: JSON.stringify({ force }) },
    organizationId,
  );
}

export async function getInterviewReport(organizationId: string, interviewId: string) {
  const [raw, replay, integritySummary] = await Promise.all([
    apiRequest<RawReport>(
      orgPath(organizationId, `/reports/interviews/${encodeURIComponent(interviewId)}`),
      {},
      organizationId,
    ),
    getInterviewReplay(organizationId, interviewId),
    apiRequest<{ signalCount?: number; riskScore?: number; disclaimer?: string }>(
      orgPath(organizationId, `/interviews/${encodeURIComponent(interviewId)}/integrity`),
      {},
      organizationId,
    ).catch((error: unknown) => {
      if (typeof error === "object" && error && "status" in error && error.status === 404) return null;
      throw error;
    }),
  ]);
  const evaluation = raw.evaluation;
  const snapshot = asRecord(raw.snapshot);
  const coding = asRecord(snapshot.coding);
  const systemDesign = asRecord(snapshot.systemDesign);
  const snapshotIntegrity = asRecord(snapshot.integrity);
  return {
    id: raw.id,
    interviewId: raw.interviewId,
    status: evaluation?.status,
    recommendation: evaluation?.overrideRecommendation ?? raw.recommendation ?? textValue(snapshot.recommendation),
    score: evaluation?.overrideScore ?? evaluation?.overallScore ?? evaluation?.score ?? raw.overallScore ?? numberValue(snapshot.score),
    confidence: evaluation?.confidence ?? raw.confidence ?? numberValue(snapshot.confidence),
    summary: evaluation?.reasoningSummary ?? evaluation?.summary ?? textValue(snapshot.summary),
    candidate: replay.candidate,
    assessment: replay.assessment,
    competencies: evaluation?.competencies?.map((competency) => ({
      id: competency.id,
      name: competency.name,
      score: competency.score,
      confidence: competency.confidence,
      summary: competency.summary,
      evidence: competency.evidence?.map(normalizeEvidence),
    })) ?? arrayValue(snapshot.competencies).map((item) => {
      const competency = asRecord(item);
      return { name: textValue(competency.name) ?? "Unnamed competency", score: numberValue(competency.score), confidence: numberValue(competency.confidence), summary: textValue(competency.summary) };
    }),
    strengths: evaluation?.strengths?.length ? evaluation.strengths : stringArray(snapshot.strengths),
    weaknesses: evaluation?.weaknesses?.length ? evaluation.weaknesses : stringArray(snapshot.weaknesses),
    evidence: evaluation?.competencies?.flatMap((competency) => competency.evidence?.map(normalizeEvidence) ?? []),
    coding: Object.keys(coding).length ? { score: numberValue(coding.score), summary: textValue(coding.summary), evidence: arrayValue(coding.evidence).map((item) => normalizeEvidence(asRecord(item))) } : null,
    systemDesign: Object.keys(systemDesign).length ? { score: numberValue(systemDesign.score), summary: textValue(systemDesign.summary), evidence: arrayValue(systemDesign.evidence).map((item) => normalizeEvidence(asRecord(item))) } : null,
    integrity: integritySummary ? {
      status: integritySummary.signalCount ? "REVIEW_REQUIRED" : "NO_SIGNALS_RECORDED",
      score: integritySummary.riskScore,
      summary: integritySummary.disclaimer,
    } : Object.keys(snapshotIntegrity).length ? {
      status: textValue(snapshotIntegrity.status),
      score: numberValue(snapshotIntegrity.score) ?? numberValue(snapshotIntegrity.riskScore),
      summary: textValue(snapshotIntegrity.summary),
      flags: stringArray(snapshotIntegrity.flags),
    } : null,
    override: evaluation?.overrideReason ? { recommendation: evaluation.overrideRecommendation ?? evaluation.recommendation ?? "Not changed", reason: evaluation.overrideReason, createdAt: evaluation.overriddenAt } : null,
    updatedAt: raw.updatedAt,
  } satisfies InterviewReport;
}

export function overrideRecommendation(
  organizationId: string,
  interviewId: string,
  recommendation: string,
  reason: string,
) {
  return apiRequest<RawEvaluation>(
    orgPath(organizationId, `/interviews/${encodeURIComponent(interviewId)}/evaluation/override`),
    { method: "PATCH", body: JSON.stringify({ recommendation, reason }) },
    organizationId,
  ).then(() => getInterviewReport(organizationId, interviewId));
}

export function listComparisonCandidates(organizationId: string) {
  return apiRequest<Candidate[] | { items?: Candidate[]; candidates?: Candidate[] }>(
    orgPath(organizationId, "/candidates"),
    {},
    organizationId,
  );
}

export function compareCandidates(organizationId: string, candidateIds: string[]) {
  return apiRequest<RawComparison>(
    orgPath(organizationId, "/reports/compare"),
    { method: "POST", body: JSON.stringify({ candidateIds, includeNarrative: true }) },
    organizationId,
  ).then((result) => ({
    candidates: result.records.map((record) => {
      const snapshot = asRecord(record.snapshot);
      return {
        candidateId: record.candidate.id,
        candidate: record.candidate,
        recommendation: textValue(snapshot.recommendation),
        score: numberValue(snapshot.score) ?? numberValue(snapshot.overallScore),
        confidence: numberValue(snapshot.confidence),
        competencies: arrayValue(snapshot.competencies).map((item) => {
          const competency = asRecord(item);
          return { name: textValue(competency.name) ?? "Unnamed competency", score: numberValue(competency.score), confidence: numberValue(competency.confidence), summary: textValue(competency.summary) };
        }),
        strengths: stringArray(snapshot.strengths),
        risks: stringArray(snapshot.weaknesses),
        reportId: record.reportId,
        interviewId: record.interviewId,
      };
    }),
  }));
}

export function queryCopilot(organizationId: string, input: CopilotToolInput) {
  return apiRequest<{ tool: string; records: CopilotRecord[]; narrative?: string | null }>(
    orgPath(organizationId, "/copilot/query"),
    { method: "POST", body: JSON.stringify(input) },
    organizationId,
  ).then((result) => ({ answer: result.narrative, tool: { name: result.tool, arguments: toolArguments(input) }, records: result.records }));
}

export function displayName(person?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ") || person?.email || "Unknown candidate";
}

export function formatScore(value?: number | null) {
  if (typeof value !== "number") return "Not scored";
  const percentage = value <= 1 ? value * 100 : value;
  return `${Math.round(percentage)}%`;
}

type RawEvaluation = {
  id: string; status: string; updatedAt?: string; error?: string | null; score?: number | null; overallScore?: number | null; overrideScore?: number | null;
  confidence?: number | null; recommendation?: string | null; overrideRecommendation?: string | null; summary?: string | null; reasoningSummary?: string | null;
  strengths?: string[]; weaknesses?: string[]; overrideReason?: string | null; overriddenAt?: string; competencies?: RawCompetency[];
};
type RawCompetency = { id?: string; name: string; score?: number | null; confidence?: number | null; summary?: string | null; evidence?: Array<Record<string, unknown>> };
type RawReplay = {
  interview: { id: string; state?: string; startedAt?: string | null; completedAt?: string | null; candidate?: InterviewReplay["candidate"]; assessment?: InterviewReplay["assessment"] };
  questions: Array<{ id: string; order: number; prompt: string; createdAt?: string; answer?: { text?: string | null; submittedAt?: string | null } | null }>;
  events: Array<{ id: string; type: string; sequence: number; occurredAt?: string; createdAt?: string; payload?: unknown }>;
  integrityMarkers: Array<{ id: string; type: string; occurredAt?: string; clientTimestamp?: string; createdAt?: string; riskScore?: number; riskWeight?: number; details?: unknown }>;
};
type RawReport = { id?: string; interviewId: string; recommendation?: string; overallScore?: number; confidence?: number; snapshot?: unknown; updatedAt?: string; evaluation?: RawEvaluation };
type RawComparison = { records: Array<{ candidate: ComparisonCandidate["candidate"]; interviewId?: string | null; reportId?: string | null; snapshot?: unknown }> };

function normalizeEvidence(item: Record<string, unknown>): Evidence {
  return { id: textValue(item.id), quote: textValue(item.quote) ?? textValue(item.excerpt), text: textValue(item.text), source: textValue(item.source), questionId: textValue(item.interviewQuestionId) ?? textValue(item.questionId), timestampMs: numberValue(item.timestampMs), rationale: textValue(item.rationale) };
}
function asRecord(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function arrayValue(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function textValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" ? value : undefined; }
function stringArray(value: unknown): string[] | undefined { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined; }
function describePayload(value: unknown): string | null {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return textValue(record.detail) ?? textValue(record.message) ?? textValue(record.reason) ?? null;
}
function riskSeverity(value?: number) { return typeof value !== "number" ? undefined : value >= 5 ? "high" : value >= 2 ? "medium" : "low"; }
function toolArguments(input: CopilotToolInput): Record<string, unknown> {
  const arguments_: Record<string, unknown> = { ...input };
  delete arguments_.tool;
  delete arguments_.includeNarrative;
  return arguments_;
}
