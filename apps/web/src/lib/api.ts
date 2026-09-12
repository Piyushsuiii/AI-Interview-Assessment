export type Organization = {
  id: string;
  name: string;
  slug?: string;
  role?: string;
  logoUrl?: string | null;
  industry?: string | null;
  companySize?: string | null;
  timezone?: string;
};

export type TeamMember = { id: string; role: string; createdAt: string; user: User };
export type TeamInvite = { id: string; email: string; role: string; createdAt: string; expiresAt: string; invitedBy: Pick<User, "email" | "firstName" | "lastName"> };
export type InterviewSummary = {
  id: string; state: string; score: number | null; recommendation: string | null; progress: number;
  createdAt: string; startedAt: string | null; completedAt: string | null;
  candidate: { id: string; email: string; firstName: string | null; lastName: string | null; job: { id: string; title: string } };
  assessment: { id: string; title: string }; report: { id: string } | null;
  evaluation: { status: string; overallScore: number | null; recommendation: string | null } | null;
};

export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
};

export type Session = {
  user: User;
  organizations: Organization[];
};

export type Notification = {
  id: string;
  type: "CANDIDATE_INVITED" | "ASSESSMENT_PUBLISHED" | "INTERVIEW_COMPLETED" | "EVALUATION_COMPLETED" | "INTEGRITY_ALERT";
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type BillingSummary = {
  configured: boolean;
  subscription: {
    plan: "STARTER" | "GROWTH" | "ENTERPRISE";
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canManage: boolean;
    canCheckout: boolean;
  };
  period: { start: string; end: string };
  usage: {
    interviews: { used: number; enabled: boolean; limit: number | null };
    aiTokens: { used: number; enabled: boolean; limit: number | null };
    teamMembers: { used: number; enabled: boolean; limit: number | null };
  };
  features: { advancedAnalytics: boolean };
  plans: Array<{ plan: "STARTER" | "GROWTH" | "ENTERPRISE"; checkoutAvailable: boolean }>;
};

export type Job = {
  id: string;
  title: string;
  description?: string | null;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  responsibilities?: string[];
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | string;
  createdAt?: string;
  updatedAt?: string;
  skills?: Array<{ id?: string; name: string; importance?: string }>;
  candidates?: unknown[];
};

export type Candidate = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  resumeUrl?: string | null;
  jobId: string;
  job?: Pick<Job, "id" | "title"> | null;
  interviews?: Array<{
    id: string;
    status: string;
    state?: string;
    score?: number | null;
    assessment?: { id: string; title: string } | null;
    createdAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type AssessmentQuestion = {
  id?: string;
  type: string;
  difficulty: string;
  prompt: string;
  skills: string[];
  rubric: string;
};

export type Assessment = {
  id: string;
  title: string;
  description?: string | null;
  durationMins: number;
  status?: string;
  questions?: AssessmentQuestion[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string; code?: string };
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  organizationId?: string,
): Promise<T> {
  if (!API_URL) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not configured.", 0, "API_URL_MISSING");
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (organizationId) headers.set("X-Organization-Id", organizationId);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to reach the API. Check the service and try again.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.error?.message ?? payload?.message ?? "The request could not be completed.",
      response.status,
      payload?.error?.code,
    );
  }

  return (payload && "data" in payload ? payload.data : payload) as T;
}

export function getJobs(data: Job[] | { jobs?: Job[]; items?: Job[] }): Job[] {
  if (Array.isArray(data)) return data;
  return data.jobs ?? data.items ?? [];
}

export function getCollection<T>(data: T[] | { items?: T[]; candidates?: T[]; assessments?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.items ?? data.candidates ?? data.assessments ?? [];
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
