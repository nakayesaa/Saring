-- ExtendEnum
ALTER TYPE "AnalysisJobStage" ADD VALUE IF NOT EXISTS 'UPLOADING_RESULTS';

-- CreateEnum
CREATE TYPE "AnalysisArtifactStatus" AS ENUM ('PREPARED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "AnalysisJob"
  ADD COLUMN "leaseTokenHash" TEXT,
  ADD COLUMN "lastProgressSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resultCallbackId" TEXT;

-- CreateTable
CREATE TABLE "AnalysisArtifact" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "engine" "AnalysisEngine" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "prepareRequestId" TEXT NOT NULL,
    "status" "AnalysisArtifactStatus" NOT NULL DEFAULT 'PREPARED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisArtifact_objectKey_key" ON "AnalysisArtifact"("objectKey");
CREATE UNIQUE INDEX "AnalysisArtifact_jobId_attempt_engine_key" ON "AnalysisArtifact"("jobId", "attempt", "engine");
CREATE INDEX "AnalysisArtifact_jobId_status_idx" ON "AnalysisArtifact"("jobId", "status");

-- AddForeignKey
ALTER TABLE "AnalysisArtifact"
  ADD CONSTRAINT "AnalysisArtifact_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
