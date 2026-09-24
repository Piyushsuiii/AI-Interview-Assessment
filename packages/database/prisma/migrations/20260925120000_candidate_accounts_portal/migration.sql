CREATE TYPE "CandidatePrivacyRequestType" AS ENUM ('EXPORT', 'DELETION');
CREATE TYPE "CandidatePrivacyRequestStatus" AS ENUM ('REQUESTED', 'IN_REVIEW', 'COMPLETED', 'REJECTED');

CREATE TABLE "CandidateAccount" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "emailVerifiedAt" TIMESTAMP(3),
  "privacyConsentAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateSession" (
  "id" TEXT NOT NULL,
  "candidateAccountId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateMagicLink" (
  "id" TEXT NOT NULL,
  "candidateAccountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateMagicLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidatePrivacyRequest" (
  "id" TEXT NOT NULL,
  "candidateAccountId" TEXT NOT NULL,
  "type" "CandidatePrivacyRequestType" NOT NULL,
  "status" "CandidatePrivacyRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  CONSTRAINT "CandidatePrivacyRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Candidate" ADD COLUMN "candidateAccountId" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CandidateAccount_email_key" ON "CandidateAccount"("email");
CREATE UNIQUE INDEX "CandidateSession_refreshTokenHash_key" ON "CandidateSession"("refreshTokenHash");
CREATE INDEX "CandidateSession_candidateAccountId_idx" ON "CandidateSession"("candidateAccountId");
CREATE UNIQUE INDEX "CandidateMagicLink_tokenHash_key" ON "CandidateMagicLink"("tokenHash");
CREATE INDEX "CandidateMagicLink_candidateAccountId_expiresAt_idx" ON "CandidateMagicLink"("candidateAccountId", "expiresAt");
CREATE INDEX "CandidatePrivacyRequest_candidateAccountId_requestedAt_idx" ON "CandidatePrivacyRequest"("candidateAccountId", "requestedAt");
CREATE INDEX "CandidatePrivacyRequest_candidateAccountId_type_status_idx" ON "CandidatePrivacyRequest"("candidateAccountId", "type", "status");
CREATE INDEX "Candidate_candidateAccountId_idx" ON "Candidate"("candidateAccountId");

ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_candidateAccountId_fkey" FOREIGN KEY ("candidateAccountId") REFERENCES "CandidateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CandidateSession" ADD CONSTRAINT "CandidateSession_candidateAccountId_fkey" FOREIGN KEY ("candidateAccountId") REFERENCES "CandidateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateMagicLink" ADD CONSTRAINT "CandidateMagicLink_candidateAccountId_fkey" FOREIGN KEY ("candidateAccountId") REFERENCES "CandidateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidatePrivacyRequest" ADD CONSTRAINT "CandidatePrivacyRequest_candidateAccountId_fkey" FOREIGN KEY ("candidateAccountId") REFERENCES "CandidateAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
