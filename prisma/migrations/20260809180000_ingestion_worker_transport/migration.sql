-- ExtendEnum
ALTER TYPE "IngestionJobStage" ADD VALUE IF NOT EXISTS 'PARSING_STRUCTURED';
ALTER TYPE "IngestionJobStage" ADD VALUE IF NOT EXISTS 'PARSING_DOCUMENTS';
ALTER TYPE "IngestionJobStage" ADD VALUE IF NOT EXISTS 'UPLOADING_ARTIFACTS';

-- CreateEnum
CREATE TYPE "IngestionArtifactKind" AS ENUM ('PARSER_RESULT', 'CANONICAL_SNAPSHOT');

-- CreateEnum
CREATE TYPE "IngestionArtifactStatus" AS ENUM ('PREPARED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "IngestionJob"
  ADD COLUMN "leaseTokenHash" TEXT,
  ADD COLUMN "lastProgressSequence" INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN "resultCallbackId" TEXT;

-- CreateTable
CREATE TABLE "IngestionProgressEvent" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "stage" "IngestionJobStage" NOT NULL,
    "completedUnits" INTEGER,
    "totalUnits" INTEGER,
    "unitLabel" TEXT,
    "message" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionArtifact" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "kind" "IngestionArtifactKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "prepareRequestId" TEXT NOT NULL,
    "status" "IngestionArtifactStatus" NOT NULL DEFAULT 'PREPARED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionProgressEvent_jobId_externalEventId_key"
  ON "IngestionProgressEvent"("jobId", "externalEventId");
CREATE UNIQUE INDEX "IngestionProgressEvent_jobId_sequence_key"
  ON "IngestionProgressEvent"("jobId", "sequence");
CREATE INDEX "IngestionProgressEvent_jobId_occurredAt_idx"
  ON "IngestionProgressEvent"("jobId", "occurredAt");
CREATE UNIQUE INDEX "IngestionArtifact_objectKey_key" ON "IngestionArtifact"("objectKey");
CREATE UNIQUE INDEX "IngestionArtifact_jobId_attempt_kind_key"
  ON "IngestionArtifact"("jobId", "attempt", "kind");
CREATE INDEX "IngestionArtifact_jobId_status_idx" ON "IngestionArtifact"("jobId", "status");

-- AddForeignKey
ALTER TABLE "IngestionProgressEvent"
  ADD CONSTRAINT "IngestionProgressEvent_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionArtifact"
  ADD CONSTRAINT "IngestionArtifact_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
