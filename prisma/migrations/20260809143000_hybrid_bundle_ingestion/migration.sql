-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IngestionJobStage" AS ENUM ('QUEUED', 'VALIDATING_BUNDLE', 'PARSING', 'OCR', 'EXTRACTING', 'CANONICALIZING', 'COMPLETE');

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "IngestionJobStage" NOT NULL DEFAULT 'QUEUED',
    "inputBundleHash" TEXT NOT NULL,
    "inputBundleLocation" TEXT NOT NULL,
    "inputContractVersion" TEXT NOT NULL,
    "outputContractVersion" TEXT NOT NULL,
    "requestedParserVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lease" JSONB,
    "error" JSONB,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_runId_key" ON "IngestionJob"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_organizationId_idempotencyKey_key" ON "IngestionJob"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IngestionJob_organizationId_status_availableAt_idx" ON "IngestionJob"("organizationId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "IngestionJob_packageId_createdAt_idx" ON "IngestionJob"("packageId", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
