CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "Recommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'LEAN_NO_HIRE', 'NO_HIRE', 'NEEDS_REVIEW');
CREATE TYPE "SubmissionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT');
CREATE TYPE "IntegrityEventType" AS ENUM ('TAB_SWITCH', 'PASTE', 'INACTIVITY', 'FACE_ABSENT', 'MULTIPLE_FACES', 'ANSWER_SIMILARITY', 'CODE_SIMILARITY');
CREATE TYPE "InterviewEventType" AS ENUM ('INTERVIEW_STARTED', 'QUESTION_DISPLAYED', 'ANSWER_SUBMITTED', 'FOLLOWUP_GENERATED', 'SECTION_CHANGED', 'INTEGRITY_SIGNAL', 'EVALUATION_COMPLETED', 'INTERVIEW_COMPLETED');

ALTER TABLE "InterviewQuestion"
  ADD COLUMN "parentQuestionId" TEXT,
  ADD COLUMN "isAdaptive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adaptationReason" TEXT,
  ADD COLUMN "systemDesignPrompt" JSONB;

CREATE TABLE "CodingChallenge" (
  "id" TEXT NOT NULL,
  "interviewQuestionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "starterCode" JSONB NOT NULL,
  "allowedLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "publicTests" JSONB NOT NULL,
  "hiddenTests" JSONB NOT NULL,
  "timeLimitMs" INTEGER NOT NULL,
  "memoryLimitMb" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodingChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodeSubmission" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "explanation" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
  "score" DOUBLE PRECISION,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodeExecution" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "workerJobId" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
  "stdout" TEXT,
  "stderr" TEXT,
  "exitCode" INTEGER,
  "durationMs" INTEGER,
  "passedTests" INTEGER,
  "totalTests" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemDesignSubmission" (
  "id" TEXT NOT NULL,
  "interviewQuestionId" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "diagram" JSONB NOT NULL,
  "explanation" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemDesignSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evaluation" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
  "overallScore" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "recommendation" "Recommendation",
  "reasoningSummary" TEXT NOT NULL,
  "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "model" TEXT,
  "provider" TEXT,
  "promptVersion" TEXT,
  "error" TEXT,
  "overrideRecommendation" "Recommendation",
  "overrideReason" TEXT,
  "overriddenById" TEXT,
  "overriddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyEvaluation" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summary" TEXT NOT NULL,
  CONSTRAINT "CompetencyEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationEvidence" (
  "id" TEXT NOT NULL,
  "competencyEvaluationId" TEXT NOT NULL,
  "interviewQuestionId" TEXT,
  "answerId" TEXT,
  "quote" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "timestampMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateSkill" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "subskills" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recommendation" "Recommendation" NOT NULL,
  "overallScore" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "snapshot" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrityEvent" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "IntegrityEventType" NOT NULL,
  "riskScore" DOUBLE PRECISION NOT NULL,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewEvent" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" "InterviewEventType" NOT NULL,
  "payload" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterviewQuestion_parentQuestionId_idx" ON "InterviewQuestion"("parentQuestionId");
CREATE UNIQUE INDEX "CodingChallenge_interviewQuestionId_key" ON "CodingChallenge"("interviewQuestionId");
CREATE INDEX "CodeSubmission_challengeId_idx" ON "CodeSubmission"("challengeId");
CREATE INDEX "CodeSubmission_interviewId_submittedAt_idx" ON "CodeSubmission"("interviewId", "submittedAt");
CREATE INDEX "CodeSubmission_status_idx" ON "CodeSubmission"("status");
CREATE UNIQUE INDEX "CodeExecution_workerJobId_key" ON "CodeExecution"("workerJobId");
CREATE INDEX "CodeExecution_submissionId_idx" ON "CodeExecution"("submissionId");
CREATE INDEX "CodeExecution_status_createdAt_idx" ON "CodeExecution"("status", "createdAt");
CREATE UNIQUE INDEX "SystemDesignSubmission_interviewQuestionId_key" ON "SystemDesignSubmission"("interviewQuestionId");
CREATE INDEX "SystemDesignSubmission_interviewId_idx" ON "SystemDesignSubmission"("interviewId");
CREATE UNIQUE INDEX "Evaluation_interviewId_key" ON "Evaluation"("interviewId");
CREATE INDEX "Evaluation_organizationId_status_idx" ON "Evaluation"("organizationId", "status");
CREATE INDEX "Evaluation_overriddenById_idx" ON "Evaluation"("overriddenById");
CREATE INDEX "Evaluation_createdAt_idx" ON "Evaluation"("createdAt");
CREATE INDEX "CompetencyEvaluation_evaluationId_idx" ON "CompetencyEvaluation"("evaluationId");
CREATE INDEX "EvaluationEvidence_competencyEvaluationId_idx" ON "EvaluationEvidence"("competencyEvaluationId");
CREATE INDEX "EvaluationEvidence_interviewQuestionId_idx" ON "EvaluationEvidence"("interviewQuestionId");
CREATE INDEX "EvaluationEvidence_answerId_idx" ON "EvaluationEvidence"("answerId");
CREATE INDEX "CandidateSkill_candidateId_idx" ON "CandidateSkill"("candidateId");
CREATE UNIQUE INDEX "CandidateSkill_candidateId_name_key" ON "CandidateSkill"("candidateId", "name");
CREATE UNIQUE INDEX "Report_interviewId_key" ON "Report"("interviewId");
CREATE INDEX "Report_organizationId_generatedAt_idx" ON "Report"("organizationId", "generatedAt");
CREATE INDEX "IntegrityEvent_interviewId_occurredAt_idx" ON "IntegrityEvent"("interviewId", "occurredAt");
CREATE INDEX "IntegrityEvent_organizationId_type_occurredAt_idx" ON "IntegrityEvent"("organizationId", "type", "occurredAt");
CREATE INDEX "InterviewEvent_interviewId_occurredAt_idx" ON "InterviewEvent"("interviewId", "occurredAt");
CREATE UNIQUE INDEX "InterviewEvent_interviewId_sequence_key" ON "InterviewEvent"("interviewId", "sequence");

ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CodingChallenge" ADD CONSTRAINT "CodingChallenge_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CodingChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeExecution" ADD CONSTRAINT "CodeExecution_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CodeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemDesignSubmission" ADD CONSTRAINT "SystemDesignSubmission_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SystemDesignSubmission" ADD CONSTRAINT "SystemDesignSubmission_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyEvaluation" ADD CONSTRAINT "CompetencyEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_competencyEvaluationId_fkey" FOREIGN KEY ("competencyEvaluationId") REFERENCES "CompetencyEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrityEvent" ADD CONSTRAINT "IntegrityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewEvent" ADD CONSTRAINT "InterviewEvent_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
