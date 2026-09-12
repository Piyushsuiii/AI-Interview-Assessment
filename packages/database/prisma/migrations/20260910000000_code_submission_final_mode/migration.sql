ALTER TABLE "CodeSubmission"
ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;

-- Runs are repeatable, but a challenge can only have one authoritative final submission.
CREATE UNIQUE INDEX "CodeSubmission_one_final_per_challenge"
ON "CodeSubmission" ("interviewId", "challengeId")
WHERE "isFinal" = true;
