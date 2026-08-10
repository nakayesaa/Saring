CREATE TYPE "AnalysisAuxiliaryInputKind" AS ENUM (
  'PRICE_ENGINE_INPUT',
  'PRICE_OBSERVATION_SNAPSHOT',
  'GRAPH_ENGINE_INPUT'
);

CREATE TABLE "AnalysisAuxiliaryInput" (
  "id" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "kind" "AnalysisAuxiliaryInputKind" NOT NULL,
  "engine" "AnalysisEngine" NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/json',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisAuxiliaryInput_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisAuxiliaryInput_objectKey_key"
  ON "AnalysisAuxiliaryInput"("objectKey");
CREATE UNIQUE INDEX "AnalysisAuxiliaryInput_jobId_kind_key"
  ON "AnalysisAuxiliaryInput"("jobId", "kind");
CREATE INDEX "AnalysisAuxiliaryInput_jobId_engine_idx"
  ON "AnalysisAuxiliaryInput"("jobId", "engine");

ALTER TABLE "AnalysisAuxiliaryInput"
  ADD CONSTRAINT "AnalysisAuxiliaryInput_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
