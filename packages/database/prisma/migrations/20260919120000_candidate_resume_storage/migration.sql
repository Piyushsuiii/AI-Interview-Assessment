ALTER TABLE "Candidate"
ADD COLUMN "resumeObjectKey" TEXT,
ADD COLUMN "resumeFileName" TEXT,
ADD COLUMN "resumeContentType" TEXT,
ADD COLUMN "resumeSize" INTEGER,
ADD COLUMN "resumeUploadedAt" TIMESTAMP(3);
