CREATE TYPE "CandidateStatus" AS ENUM ('INVITED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "QuestionType" AS ENUM ('TECHNICAL', 'CODING', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'SCENARIO');
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');
CREATE TYPE "InterviewState" AS ENUM (
  'CREATED', 'INVITED', 'STARTED', 'INTRODUCTION', 'TECHNICAL', 'FOLLOW_UP',
  'CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'EVALUATION', 'COMPLETED',
  'CANCELLED', 'EXPIRED'
);

ALTER TABLE "Candidate"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "status" "CandidateStatus" NOT NULL DEFAULT 'INVITED';

ALTER TABLE "Assessment"
  ADD COLUMN "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "activeVersionId" TEXT;

-- Add and populate the replacement before removing InterviewStatus so existing rows remain valid.
ALTER TABLE "Interview"
  ADD COLUMN "state" "InterviewState",
  ADD COLUMN "invitationTokenHash" TEXT,
  ADD COLUMN "invitationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "consentedAt" TIMESTAMP(3),
  ADD COLUMN "currentSection" TEXT,
  ADD COLUMN "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "recommendation" TEXT;

UPDATE "Interview"
SET "state" = CASE "status"::TEXT
  WHEN 'INVITED' THEN 'INVITED'::"InterviewState"
  WHEN 'IN_PROGRESS' THEN 'STARTED'::"InterviewState"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"InterviewState"
  WHEN 'EVALUATED' THEN 'EVALUATION'::"InterviewState"
  WHEN 'EXPIRED' THEN 'EXPIRED'::"InterviewState"
END;

ALTER TABLE "Interview"
  ALTER COLUMN "state" SET NOT NULL,
  ALTER COLUMN "state" SET DEFAULT 'CREATED',
  DROP COLUMN "status";

DROP TYPE "InterviewStatus";

CREATE TABLE "AssessmentVersion" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "durationMins" INTEGER NOT NULL DEFAULT 60,
  "instructions" TEXT,
  "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL,
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionVersion" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "difficulty" "Difficulty" NOT NULL,
  "expectedAnswer" TEXT,
  "rubric" JSONB,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "maxScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentQuestion" (
  "id" TEXT NOT NULL,
  "assessmentVersionId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewSession" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "state" "InterviewState" NOT NULL DEFAULT 'STARTED',
  "lastEventSequence" INTEGER NOT NULL DEFAULT 0,
  "reconnectTokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewQuestion" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "questionId" TEXT,
  "questionVersionId" TEXT,
  "type" "QuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "maxScore" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Answer" (
  "id" TEXT NOT NULL,
  "interviewQuestionId" TEXT NOT NULL,
  "text" TEXT,
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Candidate_organizationId_status_idx" ON "Candidate"("organizationId", "status");
CREATE UNIQUE INDEX "Assessment_activeVersionId_key" ON "Assessment"("activeVersionId");
CREATE INDEX "Assessment_organizationId_status_idx" ON "Assessment"("organizationId", "status");
CREATE INDEX "Assessment_jobId_idx" ON "Assessment"("jobId");
CREATE UNIQUE INDEX "Interview_invitationTokenHash_key" ON "Interview"("invitationTokenHash");
CREATE INDEX "Interview_assessmentId_idx" ON "Interview"("assessmentId");
CREATE INDEX "Interview_organizationId_state_idx" ON "Interview"("organizationId", "state");
CREATE INDEX "AssessmentVersion_assessmentId_idx" ON "AssessmentVersion"("assessmentId");
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_version_key" ON "AssessmentVersion"("assessmentId", "version");
CREATE INDEX "Question_organizationId_idx" ON "Question"("organizationId");
CREATE INDEX "Question_organizationId_status_archivedAt_idx" ON "Question"("organizationId", "status", "archivedAt");
CREATE INDEX "QuestionVersion_questionId_idx" ON "QuestionVersion"("questionId");
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");
CREATE INDEX "AssessmentQuestion_questionVersionId_idx" ON "AssessmentQuestion"("questionVersionId");
CREATE UNIQUE INDEX "AssessmentQuestion_assessmentVersionId_questionVersionId_key" ON "AssessmentQuestion"("assessmentVersionId", "questionVersionId");
CREATE UNIQUE INDEX "AssessmentQuestion_assessmentVersionId_order_key" ON "AssessmentQuestion"("assessmentVersionId", "order");
CREATE UNIQUE INDEX "InterviewSession_reconnectTokenHash_key" ON "InterviewSession"("reconnectTokenHash");
CREATE UNIQUE INDEX "InterviewSession_interviewId_key" ON "InterviewSession"("interviewId");
CREATE INDEX "InterviewSession_interviewId_state_idx" ON "InterviewSession"("interviewId", "state");
CREATE INDEX "InterviewQuestion_interviewId_idx" ON "InterviewQuestion"("interviewId");
CREATE INDEX "InterviewQuestion_questionId_idx" ON "InterviewQuestion"("questionId");
CREATE INDEX "InterviewQuestion_questionVersionId_idx" ON "InterviewQuestion"("questionVersionId");
CREATE UNIQUE INDEX "InterviewQuestion_interviewId_order_key" ON "InterviewQuestion"("interviewId", "order");
CREATE UNIQUE INDEX "Answer_interviewQuestionId_key" ON "Answer"("interviewQuestionId");

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- This FK is intentionally added after AssessmentVersion to avoid the active-version ownership cycle during creation.
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
