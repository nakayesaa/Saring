-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'REVIEWER', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "CaseRole" AS ENUM ('OWNER', 'REVIEWER', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('INGESTING', 'VALIDATING', 'READY_FOR_ANALYSIS', 'IN_REVIEW', 'CLARIFICATION', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('REGISTERED', 'SUBMITTED', 'WITHDRAWN', 'DISQUALIFIED', 'EVALUATED', 'AWARDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MANIFEST', 'PACKAGE_METADATA', 'HPS', 'RUP', 'ADMINISTRATIVE_BID', 'TECHNICAL_BID', 'COMMERCIAL_BID', 'EVALUATION', 'NEGOTIATION', 'AWARD', 'CONTRACT', 'CORPORATE_REGISTRY', 'MARKET_COMPARATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('QUARANTINED', 'VALIDATED', 'PARSING', 'PARSED', 'NEEDS_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "LegalBasisTag" AS ENUM ('PUBLIC_INFORMATION', 'AUTHORIZED_PROCUREMENT', 'CONSENT', 'DSA', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "RetentionClass" AS ENUM ('PUBLIC_ARCHIVE', 'PROCUREMENT_CASE', 'PERSONAL_RESTRICTED', 'TEMPORARY_ENRICHMENT');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED', 'PERSONAL_RESTRICTED', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "FindingModule" AS ENUM ('PRICE', 'DOCUMENT', 'GRAPH', 'FUSION', 'DATA_QUALITY');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'EXPLAINED', 'ESCALATED', 'DISMISSED', 'ABSTAINED');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('UNVERIFIED', 'SOURCE_MATCHED', 'REVIEWER_VERIFIED');

-- CreateEnum
CREATE TYPE "UploadIntentStatus" AS ENUM ('PENDING', 'FINALIZED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'NEEDS_REVIEW', 'ABSTAINED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisJobStage" AS ENUM ('QUEUED', 'VALIDATING_SNAPSHOT', 'PREPARING_ENGINES', 'RUNNING_ENGINES', 'FUSING_EVIDENCE', 'VALIDATING_RESULTS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AnalysisEngine" AS ENUM ('PRICE', 'DOCUMENT', 'GRAPH', 'TECHNICAL', 'COMPLETENESS', 'DATA_QUALITY', 'FUSION');

-- CreateEnum
CREATE TYPE "AnalysisEventStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'WARNING', 'ABSTAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "EngineResultStatus" AS ENUM ('SCORED', 'LOW_CONFIDENCE', 'ABSTAINED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "TenderPackage" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "procurementMethod" TEXT NOT NULL,
    "categoryCode" TEXT,
    "buyerInstitution" TEXT NOT NULL,
    "buyerUnit" TEXT,
    "regionCode" TEXT,
    "announcedValue" DECIMAL(20,2),
    "hpsTotal" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "bidDeadlineAt" TIMESTAMP(3) NOT NULL,
    "analysisCutoffAt" TIMESTAMP(3) NOT NULL,
    "workflowStage" "WorkflowStage" NOT NULL DEFAULT 'INGESTING',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAccess" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CaseRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "providerSourceId" TEXT,
    "legalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "legalForm" TEXT,
    "entityStatus" TEXT,
    "nibToken" TEXT,
    "addressNorm" TEXT,
    "regionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "status" "ParticipationStatus" NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "bidTotal" DECIMAL(20,2),
    "evaluationStatus" TEXT,
    "disqualificationCode" TEXT,
    "isWinner" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "vendorId" UUID,
    "type" "DocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "pageCount" INTEGER,
    "nativeTextAvailable" BOOLEAN,
    "ocrEngineVersion" TEXT,
    "parserVersion" TEXT,
    "classification" "DataClassification" NOT NULL,
    "legalBasis" "LegalBasisTag" NOT NULL,
    "retentionClass" "RetentionClass" NOT NULL,
    "ingestStatus" "IngestStatus" NOT NULL DEFAULT 'QUARANTINED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPassage" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "bbox" JSONB,
    "textRaw" TEXT,
    "textRedacted" TEXT,
    "textFingerprint" TEXT NOT NULL,
    "sectionLabel" TEXT,
    "containsRestrictedData" BOOLEAN NOT NULL DEFAULT false,
    "boilerplateProbability" DECIMAL(5,4),
    "embeddingModelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUrlOrEndpoint" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "rawPayloadHash" TEXT NOT NULL,
    "rawPayloadStorageKey" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "fieldCompleteness" DECIMAL(5,4) NOT NULL,
    "qualityFlags" JSONB NOT NULL DEFAULT '[]',
    "legalBasis" "LegalBasisTag" NOT NULL,
    "licenseOrTermsId" TEXT NOT NULL,
    "retentionClass" "RetentionClass" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "module" "FindingModule" NOT NULL,
    "moduleVersion" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "score" DECIMAL(6,5),
    "confidence" DECIMAL(6,5),
    "featureSnapshotHash" TEXT NOT NULL,
    "sourceCitations" JSONB NOT NULL DEFAULT '[]',
    "alternativeExplanations" JSONB NOT NULL DEFAULT '[]',
    "abstentionReason" TEXT,
    "engineResultId" UUID,
    "externalFindingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadIntent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "packageId" UUID,
    "documentId" UUID,
    "status" "UploadIntentStatus" NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "declaredMimeType" TEXT NOT NULL,
    "declaredByteSize" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "rejectionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalSnapshot" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "canonicalDocumentId" UUID NOT NULL,
    "canonicalSnapshotId" UUID NOT NULL,
    "retryOfId" UUID,
    "requestedById" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "AnalysisJobStage" NOT NULL DEFAULT 'QUEUED',
    "requestedEngines" "AnalysisEngine"[],
    "canonicalSnapshotHash" TEXT NOT NULL,
    "canonicalSnapshotLocation" TEXT NOT NULL,
    "inputContractVersion" TEXT NOT NULL,
    "outputContractVersion" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL,
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

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisProgressEvent" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "engine" "AnalysisEngine",
    "eventType" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" "AnalysisEventStatus" NOT NULL,
    "completedUnits" INTEGER,
    "totalUnits" INTEGER,
    "unitLabel" TEXT,
    "message" TEXT NOT NULL,
    "findingCount" INTEGER,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineResult" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "externalResultId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "engine" "AnalysisEngine" NOT NULL,
    "status" "EngineResultStatus" NOT NULL,
    "score" DECIMAL(6,5),
    "confidence" DECIMAL(6,5),
    "engineVersion" TEXT NOT NULL,
    "modelVersion" TEXT,
    "inputSnapshotHash" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceBrief" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedById" UUID,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDisposition" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "canonicalEntityType" TEXT NOT NULL,
    "canonicalEntityId" UUID NOT NULL,
    "classification" "DataClassification" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "packageId" UUID,
    "fromNodeId" UUID NOT NULL,
    "toNodeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "verificationLevel" "VerificationLevel" NOT NULL,
    "evidenceCitations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,
    "packageId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "TenderPackage_organizationId_workflowStage_idx" ON "TenderPackage"("organizationId", "workflowStage");

-- CreateIndex
CREATE INDEX "TenderPackage_analysisCutoffAt_idx" ON "TenderPackage"("analysisCutoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenderPackage_organizationId_sourceId_key" ON "TenderPackage"("organizationId", "sourceId");

-- CreateIndex
CREATE INDEX "CaseAccess_userId_idx" ON "CaseAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseAccess_packageId_userId_key" ON "CaseAccess"("packageId", "userId");

-- CreateIndex
CREATE INDEX "Vendor_providerSourceId_idx" ON "Vendor"("providerSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_organizationId_normalizedName_key" ON "Vendor"("organizationId", "normalizedName");

-- CreateIndex
CREATE INDEX "Participation_vendorId_submittedAt_idx" ON "Participation"("vendorId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_packageId_vendorId_key" ON "Participation"("packageId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_organizationId_packageId_type_idx" ON "Document"("organizationId", "packageId", "type");

-- CreateIndex
CREATE INDEX "Document_ingestStatus_idx" ON "Document"("ingestStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Document_packageId_sha256_key" ON "Document"("packageId", "sha256");

-- CreateIndex
CREATE INDEX "DocumentPassage_documentId_pageNumber_idx" ON "DocumentPassage"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "SourceRecord_organizationId_entityType_entityId_idx" ON "SourceRecord"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SourceRecord_sourceSystem_sourceRecordId_idx" ON "SourceRecord"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "Finding_packageId_module_status_idx" ON "Finding"("packageId", "module", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_engineResultId_externalFindingId_key" ON "Finding"("engineResultId", "externalFindingId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadIntent_documentId_key" ON "UploadIntent"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadIntent_objectKey_key" ON "UploadIntent"("objectKey");

-- CreateIndex
CREATE INDEX "UploadIntent_organizationId_status_createdAt_idx" ON "UploadIntent"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UploadIntent_requestedById_createdAt_idx" ON "UploadIntent"("requestedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSnapshot_documentId_key" ON "CanonicalSnapshot"("documentId");

-- CreateIndex
CREATE INDEX "CanonicalSnapshot_organizationId_createdAt_idx" ON "CanonicalSnapshot"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSnapshot_packageId_snapshotHash_key" ON "CanonicalSnapshot"("packageId", "snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisJob_retryOfId_key" ON "AnalysisJob"("retryOfId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisJob_runId_key" ON "AnalysisJob"("runId");

-- CreateIndex
CREATE INDEX "AnalysisJob_organizationId_status_availableAt_idx" ON "AnalysisJob"("organizationId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "AnalysisJob_packageId_createdAt_idx" ON "AnalysisJob"("packageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisJob_organizationId_idempotencyKey_key" ON "AnalysisJob"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AnalysisProgressEvent_jobId_occurredAt_idx" ON "AnalysisProgressEvent"("jobId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisProgressEvent_jobId_externalEventId_key" ON "AnalysisProgressEvent"("jobId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisProgressEvent_jobId_sequence_key" ON "AnalysisProgressEvent"("jobId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "EngineResult_externalResultId_key" ON "EngineResult"("externalResultId");

-- CreateIndex
CREATE INDEX "EngineResult_packageId_createdAt_idx" ON "EngineResult"("packageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EngineResult_jobId_engine_key" ON "EngineResult"("jobId", "engine");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceBrief_packageId_version_key" ON "EvidenceBrief"("packageId", "version");

-- CreateIndex
CREATE INDEX "ReviewDisposition_packageId_createdAt_idx" ON "ReviewDisposition"("packageId", "createdAt");

-- CreateIndex
CREATE INDEX "GraphNode_organizationId_type_idx" ON "GraphNode"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "GraphNode_organizationId_canonicalEntityType_canonicalEntit_key" ON "GraphNode"("organizationId", "canonicalEntityType", "canonicalEntityId");

-- CreateIndex
CREATE INDEX "GraphEdge_organizationId_type_idx" ON "GraphEdge"("organizationId", "type");

-- CreateIndex
CREATE INDEX "GraphEdge_fromNodeId_toNodeId_idx" ON "GraphEdge"("fromNodeId", "toNodeId");

-- CreateIndex
CREATE INDEX "GraphEdge_packageId_idx" ON "GraphEdge"("packageId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_occurredAt_idx" ON "AuditEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_packageId_occurredAt_idx" ON "AuditEvent"("packageId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderPackage" ADD CONSTRAINT "TenderPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAccess" ADD CONSTRAINT "CaseAccess_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAccess" ADD CONSTRAINT "CaseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPassage" ADD CONSTRAINT "DocumentPassage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_engineResultId_fkey" FOREIGN KEY ("engineResultId") REFERENCES "EngineResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSnapshot" ADD CONSTRAINT "CanonicalSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSnapshot" ADD CONSTRAINT "CanonicalSnapshot_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalSnapshot" ADD CONSTRAINT "CanonicalSnapshot_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_canonicalDocumentId_fkey" FOREIGN KEY ("canonicalDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_canonicalSnapshotId_fkey" FOREIGN KEY ("canonicalSnapshotId") REFERENCES "CanonicalSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_retryOfId_fkey" FOREIGN KEY ("retryOfId") REFERENCES "AnalysisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisProgressEvent" ADD CONSTRAINT "AnalysisProgressEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineResult" ADD CONSTRAINT "EngineResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineResult" ADD CONSTRAINT "EngineResult_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceBrief" ADD CONSTRAINT "EvidenceBrief_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceBrief" ADD CONSTRAINT "EvidenceBrief_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDisposition" ADD CONSTRAINT "ReviewDisposition_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDisposition" ADD CONSTRAINT "ReviewDisposition_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TenderPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
