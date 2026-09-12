export type InterviewProgress = {
  answeredQuestions: number;
  totalQuestions: number;
};

export type CandidateSession = {
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  progress?: InterviewProgress | null;
};

export type CandidateInvitation = {
  status: string;
  expiresAt?: string | null;
  organization: {
    name: string;
  };
  candidate: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  job: {
    title: string;
    department?: string | null;
    location?: string | null;
    employmentType?: string | null;
  };
  assessment: {
    title: string;
    durationMins: number;
  };
  session?: CandidateSession | null;
  interview?: CandidateSession | null;
};

export type CurrentQuestion = {
  completed: boolean;
  state: string;
  progress: InterviewProgress;
  question: null | { id: string; type: string; prompt: string; order: number; maxScore: number };
};

export type AnswerResult = {
  accepted: boolean;
  completed: boolean;
  state: string;
  progress: InterviewProgress;
  nextQuestion: CurrentQuestion["question"];
};

export type CodingLanguage = {
  id: string;
  name: string;
  starterCode?: string | null;
};

export type CodingChallenge = {
  languages: CodingLanguage[];
  title?: string | null;
  description?: string | null;
  timeLimitMs?: number | null;
  memoryLimitMb?: number | null;
  starterCode?: string | null;
  code?: string | null;
  selectedLanguage?: string | null;
  explanation?: string | null;
};

export type CodingExecution = {
  id: string;
  status: string;
  output?: string | null;
  error?: string | null;
  explanation?: string | null;
  tests?: Array<{
    name?: string | null;
    passed: boolean;
    output?: string | null;
    error?: string | null;
  }>;
};

export type SystemDesignDocument = {
  diagram?: unknown;
  explanation?: string | null;
};

export type IntegritySignal = {
  type: "TAB_SWITCH" | "PASTE" | "INACTIVITY" | "FACE_ABSENT";
  clientTimestamp: string;
  details?: Record<string, string | number | boolean>;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export class PublicInvitationError extends Error {
  constructor(public status: number) {
    super("The invitation request could not be completed.");
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

async function invitationRequest<T>(
  token: string,
  path = "",
  init: RequestInit = {},
): Promise<T> {
  if (!API_URL) throw new PublicInvitationError(0);

  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    response = await fetch(
      `${API_URL}/candidate/invitations/${encodeURIComponent(token)}${path}`,
      {
        ...init,
        headers,
        cache: "no-store",
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PublicInvitationError(0);
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
  const failedEnvelope = payload && typeof payload === "object" && "success" in payload && payload.success === false;
  if (!response.ok || failedEnvelope) throw new PublicInvitationError(response.status);

  if (payload && typeof payload === "object" && "success" in payload) {
    return payload.data as T;
  }
  return payload as T;
}

export function getCandidateInvitation(token: string, signal?: AbortSignal) {
  return invitationRequest<CandidateInvitation>(token, "", { signal });
}

export async function startCandidateInterview(token: string) {
  await invitationRequest<unknown>(token, "/start", {
    method: "POST",
    body: JSON.stringify({ consent: true }),
  });
}

export function getCurrentQuestion(token: string, signal?: AbortSignal) {
  return invitationRequest<CurrentQuestion>(token, "/question", { signal });
}

export function submitCandidateAnswer(token: string, questionId: string, text: string) {
  return invitationRequest<AnswerResult>(token, "/answers", {
    method: "POST",
    body: JSON.stringify({ questionId, text }),
  });
}

export async function getCodingChallenge(token: string, questionId: string, signal?: AbortSignal) {
  const response = await invitationRequest<{
    challenge: { title?: string; description?: string; allowedLanguages: string[]; starterCode?: unknown; timeLimitMs?: number; memoryLimitMb?: number };
  }>(token, `/coding/${encodeURIComponent(questionId)}`, { signal });
  const starterFor = (language: string) => {
    if (typeof response.challenge.starterCode === "string") return response.challenge.starterCode;
    if (response.challenge.starterCode && typeof response.challenge.starterCode === "object") {
      const value = (response.challenge.starterCode as Record<string, unknown>)[language];
      return typeof value === "string" ? value : null;
    }
    return null;
  };
  return {
    title: response.challenge.title,
    description: response.challenge.description,
    timeLimitMs: response.challenge.timeLimitMs,
    memoryLimitMb: response.challenge.memoryLimitMb,
    languages: response.challenge.allowedLanguages.map((language) => ({ id: language, name: language, starterCode: starterFor(language) })),
  } satisfies CodingChallenge;
}

export async function runCandidateCode(token: string, questionId: string, language: string, code: string) {
  const result = await invitationRequest<{ executionId: string; status: string }>(token, `/coding/${encodeURIComponent(questionId)}/run`, {
    method: "POST",
    body: JSON.stringify({ language, sourceCode: code }),
  });
  return { id: result.executionId, status: result.status } satisfies CodingExecution;
}

export async function getCodingExecution(token: string, _questionId: string, executionId: string, signal?: AbortSignal) {
  const result = await invitationRequest<{
    id: string; status: string; stdout?: string | null; stderr?: string | null; error?: string | null;
    passedTests?: number | null; totalTests?: number | null; testResults?: CodingExecution["tests"];
  }>(token, `/coding/executions/${encodeURIComponent(executionId)}`, { signal });
  const summary = typeof result.totalTests === "number" && typeof result.passedTests === "number"
    ? [{ name: `${result.passedTests} of ${result.totalTests} tests passed`, passed: result.passedTests === result.totalTests }]
    : undefined;
  return { id: result.id, status: result.status, output: result.stdout, error: result.error ?? result.stderr, tests: Array.isArray(result.testResults) ? result.testResults : summary } satisfies CodingExecution;
}

export async function submitCandidateCode(token: string, questionId: string, language: string, code: string, explanation?: string) {
  const result = await invitationRequest<{ executionId: string; status: string }>(token, `/coding/${encodeURIComponent(questionId)}/submit`, {
    method: "POST",
    body: JSON.stringify({ language, sourceCode: code, explanation }),
  });
  return { id: result.executionId, status: result.status } satisfies CodingExecution;
}

export async function getSystemDesign(token: string, questionId: string, signal?: AbortSignal) {
  const result = await invitationRequest<{ submission?: SystemDesignDocument | null }>(token, `/system-design/${encodeURIComponent(questionId)}`, { signal });
  return result.submission ?? {};
}

export function saveSystemDesign(token: string, questionId: string, diagram: unknown, explanation: string) {
  return invitationRequest<SystemDesignDocument>(token, `/system-design/${encodeURIComponent(questionId)}`, {
    method: "PUT",
    body: JSON.stringify({ diagram, explanation }),
  });
}

export function postIntegritySignals(token: string, signals: IntegritySignal[], keepalive = false) {
  return Promise.all(signals.map((signal) => invitationRequest<unknown>(token, "/integrity", {
      method: "POST",
      body: JSON.stringify(signal),
      keepalive,
    })));
}
