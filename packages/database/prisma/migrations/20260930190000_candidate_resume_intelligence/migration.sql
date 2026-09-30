ALTER TABLE "Candidate"
ADD COLUMN "resumeCategory" TEXT,
ADD COLUMN "resumeCategoryConfidence" DOUBLE PRECISION,
ADD COLUMN "resumeCategoryPredictions" JSONB,
ADD COLUMN "resumeAnalyzedAt" TIMESTAMP(3),
ADD COLUMN "resumeModel" TEXT;
