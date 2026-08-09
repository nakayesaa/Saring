import "server-only";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import evidenceLocatorSchema from "../../../contracts/v1/evidence-locator.schema.json";
import claimResponseSchema from "../../../contracts/v2/analysis-job-claim-response.schema.json";
import progressEventSchema from "../../../contracts/v1/analysis-worker-progress-event.schema.json";
import artifactPrepareSchema from "../../../contracts/v1/analysis-artifact-prepare.schema.json";
import resultCallbackSchema from "../../../contracts/v1/analysis-result-callback.schema.json";
import engineResultSchema from "../../../contracts/v2/engine-result.schema.json";
import { DomainError } from "@/lib/errors";
import type { AnalysisEngine } from "@/lib/analysis-progress";
import type { GeneralEngineResult } from "@/lib/analysis/contracts";

export const ANALYSIS_CLAIM_CONTRACT = "saring-analysis-job-claim-response-2.0.0";
export const ANALYSIS_WORKER_PROGRESS_CONTRACT = "saring-analysis-worker-progress-event-1.0.0";
export const ANALYSIS_ARTIFACT_PREPARE_CONTRACT = "saring-analysis-artifact-prepare-1.0.0";
export const ANALYSIS_RESULT_CALLBACK_CONTRACT = "saring-analysis-result-callback-1.0.0";

export type AnalysisWorkerStage =
  | "VALIDATING_SNAPSHOT"
  | "PREPARING_ENGINES"
  | "RUNNING_PRICE_ENGINE"
  | "RUNNING_DOCUMENT_ENGINE"
  | "RUNNING_GRAPH_ENGINE"
  | "RUNNING_TECHNICAL_CHECK"
  | "RUNNING_COMPLETENESS_CHECK"
  | "RUNNING_DATA_QUALITY_CHECK"
  | "FUSING_EVIDENCE"
  | "VALIDATING_RESULTS"
  | "UPLOADING_RESULTS";

export type AnalysisWorkerProgress = {
  schema_version: typeof ANALYSIS_WORKER_PROGRESS_CONTRACT;
  event_id: string;
  sequence: number;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  event_type: "HEARTBEAT" | "STAGE_STARTED" | "PROGRESS" | "ENGINE_STARTED" | "ENGINE_COMPLETED" | "ENGINE_ABSTAINED" | "ENGINE_FAILED";
  engine: AnalysisEngine | null;
  stage: AnalysisWorkerStage;
  completed_units: number | null;
  total_units: number | null;
  unit_label: string | null;
  message: string | null;
  finding_count: number | null;
  occurred_at: string;
};

export type AnalysisArtifactDescriptor = {
  kind: "ENGINE_RESULT";
  engine: AnalysisEngine;
  sha256: string;
  size_bytes: number;
  schema_version: "saring-engine-result-2.0.0";
  media_type: "application/json";
};

export type AnalysisArtifactPrepare = {
  schema_version: typeof ANALYSIS_ARTIFACT_PREPARE_CONTRACT;
  request_id: string;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  artifacts: AnalysisArtifactDescriptor[];
};

export type AnalysisResultCallback = {
  schema_version: typeof ANALYSIS_RESULT_CALLBACK_CONTRACT;
  callback_id: string;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  status: "COMPLETED" | "NEEDS_REVIEW" | "ABSTAINED" | "FAILED";
  artifacts: Array<AnalysisArtifactDescriptor & { artifact_id: string; object_key: string }>;
  summary: null | {
    engine_count: number;
    scored_count: number;
    low_confidence_count: number;
    abstained_count: number;
    not_applicable_count: number;
    finding_count: number;
  };
  error: null | { code: string; message: string; retryable: boolean };
  completed_at: string;
};

const ajv = addFormats(new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true, strictRequired: false }));
for (const schema of [
  evidenceLocatorSchema,
  engineResultSchema,
  claimResponseSchema,
  progressEventSchema,
  artifactPrepareSchema,
  resultCallbackSchema,
]) {
  ajv.addSchema(schema);
}

function issues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 12).map((error) =>
    `${error.instancePath || "/"} ${error.message ?? error.keyword}`,
  );
}

function parse<T>(schemaId: string, value: unknown, code: string): T {
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema is not registered: ${schemaId}`);
  if (!validate(value)) {
    throw new DomainError(code, `Contract validation failed: ${issues(validate.errors).join("; ")}`, 422);
  }
  return value as T;
}

export function parseAnalysisWorkerProgress(value: unknown) {
  return parse<AnalysisWorkerProgress>(progressEventSchema.$id, value, "INVALID_ANALYSIS_PROGRESS");
}

export function parseAnalysisArtifactPrepare(value: unknown) {
  return parse<AnalysisArtifactPrepare>(artifactPrepareSchema.$id, value, "INVALID_ANALYSIS_ARTIFACT_PREPARE");
}

export function parseAnalysisResultCallback(value: unknown) {
  return parse<AnalysisResultCallback>(resultCallbackSchema.$id, value, "INVALID_ANALYSIS_RESULT_CALLBACK");
}

export function parseEngineResultV2(value: unknown) {
  const result = parse<GeneralEngineResult>(engineResultSchema.$id, value, "INVALID_ENGINE_RESULT");
  const locatorIds = new Set(result.evidence_locators.map(({ locator_id }) => locator_id));
  const missing = result.findings.flatMap((finding) =>
    finding.evidence_locator_ids.filter((id) => !locatorIds.has(id)),
  );
  if (missing.length) {
    throw new DomainError("INVALID_ENGINE_RESULT", "A finding references an unknown evidence locator.", 422);
  }
  return result;
}

export function validateAnalysisClaimResponse<T>(value: T) {
  return parse<T>(claimResponseSchema.$id, value, "INVALID_ANALYSIS_CLAIM_RESPONSE");
}

export function validateAnalysisProgressAck<T>(value: T) {
  return parse<T>(`${progressEventSchema.$id}#/$defs/ack`, value, "INVALID_ANALYSIS_PROGRESS_ACK");
}

export function validateAnalysisArtifactResponse<T>(value: T) {
  return parse<T>(`${artifactPrepareSchema.$id}#/$defs/response`, value, "INVALID_ANALYSIS_ARTIFACT_RESPONSE");
}

export function validateAnalysisResultAck<T>(value: T) {
  return parse<T>(`${resultCallbackSchema.$id}#/$defs/ack`, value, "INVALID_ANALYSIS_RESULT_ACK");
}
