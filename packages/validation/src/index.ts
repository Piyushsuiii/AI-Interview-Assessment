import { z } from "zod";
import { ORG_ROLES } from "@ai-hiring-platform/auth";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const signupSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  organizationName: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(500),
});

export const candidateMagicLinkRequestSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
});

export const candidateMagicLinkVerifySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

export const updateCandidateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).nullable().optional(),
  lastName: z.string().trim().min(1).max(80).nullable().optional(),
  phone: z.string().trim().min(3).max(32).nullable().optional(),
  privacyConsent: z.literal(true).optional(),
}).refine((input) => Object.keys(input).length > 0, "At least one field must be provided");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens");

export const companySizeSchema = z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional(),
  companySize: companySizeSchema.optional(),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one field must be provided",
);

export const skillLevelSchema = z.enum(["NICE_TO_HAVE", "REQUIRED", "CRITICAL"]);
export const jobStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED"]);

export const jobSkillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  importance: skillLevelSchema.default("REQUIRED"),
});

const jobFieldsSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20_000).optional(),
  department: z.string().trim().max(100).optional(),
  location: z.string().trim().max(160).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP"]).optional(),
  experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE"]).optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  salaryCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  responsibilities: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  status: jobStatusSchema.default("DRAFT"),
  skills: z.array(jobSkillSchema).max(100).default([]),
});

const validSalaryRange = (input: { salaryMin?: number; salaryMax?: number }) =>
  input.salaryMin === undefined || input.salaryMax === undefined || input.salaryMin <= input.salaryMax;

export const createJobSchema = jobFieldsSchema.refine(
  validSalaryRange,
  { message: "Minimum salary cannot exceed maximum salary", path: ["salaryMin"] },
);

export const updateJobSchema = jobFieldsSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided")
  .refine(validSalaryRange, {
    message: "Minimum salary cannot exceed maximum salary",
    path: ["salaryMin"],
  });

export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: jobStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const candidateStatusSchema = z.enum([
  "INVITED",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
]);

const candidateFieldsSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(3).max(32).optional(),
  resumeUrl: z.string().url().max(2_000).optional(),
  jobId: z.string().uuid(),
  status: candidateStatusSchema.default("INVITED"),
});

export const createCandidateSchema = candidateFieldsSchema;
export const updateCandidateSchema = candidateFieldsSchema
  .omit({ jobId: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");

export const candidateListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: candidateStatusSchema.optional(),
  jobId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const inviteCandidateSchema = z.object({
  assessmentId: z.string().uuid(),
  expiresInHours: z.coerce.number().int().min(1).max(24 * 30).default(72),
});

export const assessmentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const questionTypeSchema = z.enum(["TECHNICAL", "CODING", "BEHAVIORAL", "SYSTEM_DESIGN", "SCENARIO"]);
export const questionDifficultySchema = z.enum(["EASY", "MEDIUM", "HARD", "EXPERT"]);

const assessmentMetadataSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(20_000).optional(),
  durationMins: z.number().int().min(1).max(480).default(60),
  jobId: z.string().uuid().optional(),
});

const questionContentObject = z.object({
  type: questionTypeSchema,
  difficulty: questionDifficultySchema.default("MEDIUM"),
  prompt: z.string().trim().min(1).max(20_000),
  expectedAnswer: z.string().trim().max(20_000).optional(),
  rubric: z.string().trim().max(20_000).optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  maxScore: z.number().min(0.1).max(10_000).default(10),
  codingConfig: z.object({
    title: z.string().trim().min(1).max(200),
    allowedLanguages: z.array(z.enum(["javascript", "typescript", "python"])).min(1).max(3),
    starterCode: z.record(z.string().max(50_000)),
    publicTests: z.array(z.object({ name: z.string().trim().min(1).max(100), input: jsonValueSchema, expected: jsonValueSchema })).max(20),
    hiddenTests: z.array(z.object({ name: z.string().trim().min(1).max(100), input: jsonValueSchema, expected: jsonValueSchema })).min(1).max(80),
    timeLimitMs: z.number().int().min(500).max(30_000).default(5_000),
    memoryLimitMb: z.number().int().min(32).max(512).default(128),
  }).optional(),
});

const requireCodingConfig = (input: { type: string; codingConfig?: unknown }, context: z.RefinementCtx) => {
  if (input.type === "CODING" && !input.codingConfig) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["codingConfig"], message: "Coding questions require starter code and hidden tests" });
  }
};

const questionContentSchema = questionContentObject.superRefine(requireCodingConfig);

export const createAssessmentSchema = assessmentMetadataSchema.extend({
  questions: z.array(questionContentSchema).max(100).default([]),
});
export const updateAssessmentSchema = assessmentMetadataSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");

export const assessmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: assessmentStatusSchema.optional(),
  jobId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const questionFieldsSchema = questionContentObject.extend({
  order: z.number().int().min(0),
  weight: z.number().positive().max(100).default(1),
  required: z.boolean().default(true),
}).superRefine(requireCodingConfig);

export const addAssessmentQuestionSchema = questionFieldsSchema;
export const updateAssessmentQuestionSchema = questionContentObject.extend({
  order: z.number().int().min(0),
  weight: z.number().positive().max(100),
  required: z.boolean(),
})
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided");

export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Invalid invitation token");
export const startInterviewSchema = z.object({ consent: z.literal(true) });
export const submitInterviewAnswerSchema = z.object({
  questionId: z.string().uuid(),
  text: z.string().trim().min(1).max(50_000),
});

export const evaluateInterviewSchema = z.object({
  force: z.boolean().optional().default(false),
}).strict();

export const overrideEvaluationSchema = z.object({
  recommendation: z.enum(["STRONG_HIRE", "HIRE", "LEAN_HIRE", "LEAN_NO_HIRE", "NO_HIRE", "NEEDS_REVIEW"]),
  reason: z.string().trim().min(10).max(2_000),
}).strict();

export const compareCandidatesSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(2).max(5)
    .refine((ids) => new Set(ids).size === ids.length, "Candidate IDs must be unique"),
  includeNarrative: z.boolean().optional().default(false),
}).strict();

export const copilotQuerySchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("list_candidates"),
    filters: z.object({
      jobId: z.string().uuid().optional(),
      status: candidateStatusSchema.optional(),
      minimumScore: z.number().min(0).max(100).optional(),
      limit: z.number().int().min(1).max(50).optional().default(20),
    }).strict().optional().default({ limit: 20 }),
    includeNarrative: z.boolean().optional().default(false),
  }).strict(),
  z.object({
    tool: z.literal("compare_candidates"),
    candidateIds: z.array(z.string().uuid()).min(2).max(5)
      .refine((ids) => new Set(ids).size === ids.length, "Candidate IDs must be unique"),
    includeNarrative: z.boolean().optional().default(false),
  }).strict(),
  z.object({
    tool: z.literal("explain_score"),
    candidateId: z.string().uuid(),
    includeNarrative: z.boolean().optional().default(false),
  }).strict(),
  z.object({
    tool: z.literal("review_priority"),
    jobId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(25).optional().default(10),
    includeNarrative: z.boolean().optional().default(false),
  }).strict(),
]);

export const inviteMemberSchema = z.object({
  email: z.string().email().max(255).transform((value) => value.toLowerCase().trim()),
  role: z.enum(ORG_ROLES).refine((role) => role !== "OWNER", {
    message: "Invite an existing owner flow cannot assign OWNER. Transfer ownership separately.",
  }),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(500),
});

export const interviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.enum(["CREATED", "INVITED", "STARTED", "INTRODUCTION", "TECHNICAL", "FOLLOW_UP", "CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "EVALUATION", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
  assessmentId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "startedAt", "completedAt", "score", "state"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "From date must not be after to date",
  path: ["from"],
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type CandidateMagicLinkRequestInput = z.infer<typeof candidateMagicLinkRequestSchema>;
export type CandidateMagicLinkVerifyInput = z.infer<typeof candidateMagicLinkVerifySchema>;
export type UpdateCandidateProfileInput = z.infer<typeof updateCandidateProfileSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;
export type InviteCandidateInput = z.infer<typeof inviteCandidateSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;
export type AddAssessmentQuestionInput = z.infer<typeof addAssessmentQuestionSchema>;
export type UpdateAssessmentQuestionInput = z.infer<typeof updateAssessmentQuestionSchema>;
export type EvaluateInterviewInput = z.infer<typeof evaluateInterviewSchema>;
export type OverrideEvaluationInput = z.infer<typeof overrideEvaluationSchema>;
export type CompareCandidatesInput = z.infer<typeof compareCandidatesSchema>;
export type CopilotQueryInput = z.infer<typeof copilotQuerySchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type InterviewListQuery = z.infer<typeof interviewListQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
