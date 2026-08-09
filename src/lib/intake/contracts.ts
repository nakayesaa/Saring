import "server-only";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import manifestSchema from "../../../contracts/v1/package-bundle-manifest.schema.json";
import ingestionJobSchema from "../../../contracts/v1/ingestion-job.schema.json";
import claimResponseSchema from "../../../contracts/v1/ingestion-job-claim-response.schema.json";
import progressEventSchema from "../../../contracts/v1/ingestion-progress-event.schema.json";
import artifactPrepareSchema from "../../../contracts/v1/ingestion-artifact-prepare.schema.json";
import resultCallbackSchema from "../../../contracts/v1/ingestion-result-callback.schema.json";
import parserResultSchema from "../../../contracts/v1/parser-result.schema.json";
import canonicalSnapshotSchema from "../../../contracts/v1/canonical-analysis-snapshot.schema.json";
import { DomainError } from "@/lib/errors";

export const PACKAGE_BUNDLE_CONTRACT = "saring-package-bundle-manifest-1.0.0";
export const RUNTIME_BUNDLE_CONTRACT = "saring-runtime-bundle-manifest-1.0.0";
export const INGESTION_JOB_CONTRACT = "saring-ingestion-job-1.0.0";
export const CANONICAL_PACKAGE_CONTRACT = "saring-canonical-package-1.0.0";
export const DEFAULT_PARSER_VERSION = "saring-parser-1.0.0";
export const INGESTION_CLAIM_CONTRACT = "saring-ingestion-job-claim-response-1.0.0";
export const INGESTION_PROGRESS_CONTRACT = "saring-ingestion-progress-event-1.0.0";
export const INGESTION_ARTIFACT_PREPARE_CONTRACT = "saring-ingestion-artifact-prepare-1.0.0";
export const INGESTION_RESULT_CONTRACT = "saring-ingestion-result-callback-1.0.0";
export const PARSER_RESULT_CONTRACT = "saring-parser-result-1.0.0";
export const CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT = "saring-canonical-analysis-snapshot-1.0.0";

export type IngestionArtifactKind = "PARSER_RESULT" | "CANONICAL_SNAPSHOT";

export type IngestionProgressEvent = {
  schema_version: typeof INGESTION_PROGRESS_CONTRACT;
  event_id: string;
  sequence: number;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  event_type: "HEARTBEAT" | "STAGE_STARTED" | "PROGRESS";
  stage: "VALIDATING_BUNDLE" | "PARSING_STRUCTURED" | "PARSING_DOCUMENTS" | "CANONICALIZING" | "UPLOADING_ARTIFACTS";
  completed_units: number | null;
  total_units: number | null;
  unit_label: string | null;
  message: string | null;
  occurred_at: string;
};

export type ArtifactDescriptor = {
  kind: IngestionArtifactKind;
  sha256: string;
  size_bytes: number;
  schema_version: typeof PARSER_RESULT_CONTRACT | typeof CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT;
  media_type: "application/json";
};

export type IngestionArtifactPrepare = {
  schema_version: typeof INGESTION_ARTIFACT_PREPARE_CONTRACT;
  request_id: string;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  artifacts: ArtifactDescriptor[];
};

export type IngestionResultCallback = {
  schema_version: typeof INGESTION_RESULT_CONTRACT;
  callback_id: string;
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
  status: "COMPLETED" | "NEEDS_REVIEW" | "FAILED";
  artifacts: Array<ArtifactDescriptor & { artifact_id: string; object_key: string }>;
  summary: null | {
    parser_status: "PARSED" | "NEEDS_REVIEW";
    document_count: number;
    parsed_document_count: number;
    needs_review_document_count: number;
    issue_count: number;
    snapshot_hash: string;
  };
  error: null | { code: string; message: string; retryable: boolean };
  completed_at: string;
};

export type ParserResult = {
  schema_version: typeof PARSER_RESULT_CONTRACT;
  package_id: string;
  bundle_id: string;
  status: "PARSED" | "NEEDS_REVIEW" | "FAILED";
  parser_version: string;
  document_outcomes: Array<{ status: "PARSED" | "NEEDS_REVIEW" | "UNREADABLE" | "REJECTED" }>;
  issues: Array<{ code: string; severity: "INFO" | "WARNING" | "ERROR"; subject_id: string | null; message: string }>;
  snapshot_hash: string;
  snapshot_file: string;
};

export type CanonicalAnalysisSnapshot = Record<string, unknown> & {
  schema_version: typeof CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT;
  package_id: string;
  snapshot_id: string;
  analysis_cutoff_at: string;
  parser_version: string;
  package: {
    name: string;
    buyer_name: string;
    procurement_method: string;
    bid_deadline_at: string;
    currency: string;
    bundle_mode: "LIVE_AUTHORIZED" | "RETROSPECTIVE" | "SYNTHETIC";
  };
  participants: Array<{ vendor_id: string; legal_name: string; submitted_at: string }>;
  items: Array<{
    item_id: string;
    category: string;
    description: string;
    quantity: number;
    unit: string;
    hps_unit_price: number;
    hps_total: number;
    tax_included: boolean;
  }>;
  bids: unknown[];
  price_comparators: unknown[];
  historical_participation: unknown[];
  documents: Array<{
    document_id: string;
    vendor_id: string;
    document_type: string;
    file_name: string;
    status: "PARSED" | "NEEDS_REVIEW" | "UNREADABLE";
    pages: unknown[];
  }>;
  quality: {
    document_completeness: number;
    parsed_documents: number;
    needs_review_documents: number;
    unreadable_documents: number;
    native_pages: number;
    ocr_pages: number;
    low_confidence_pages: number;
    unreadable_pages: number;
  };
  provenance: Array<{ file_id: string; source_hash: string; document_id: string | null }>;
};

export type PackageBundleManifest = {
  bundle_id: string;
  tender_source_id: string;
  anchor_reference_id?: string;
  created_at: string;
  analysis_cutoff_at: string;
  provided_by_role: string;
  legal_basis_tag: "PUBLIC_INFORMATION" | "AUTHORIZED_PROCUREMENT" | "CONSENT" | "DSA" | "SYNTHETIC" | "SYNTHETIC_WITH_PUBLIC_ANCHOR";
  participant_count: number;
  bundle_mode: "LIVE_AUTHORIZED" | "RETROSPECTIVE" | "SYNTHETIC";
  confidentiality_class: string;
  generator?: { file: string; version: string; seed: number };
  counts?: Record<string, number>;
  expected_files: Array<{ relative_path: string; size_bytes: number; sha256: string }>;
};

export type IngestionJobContract = {
  schema_version: typeof INGESTION_JOB_CONTRACT;
  job_id: string;
  run_id: string;
  organization_id: string;
  package_id: string;
  job_kind: "INGESTION";
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "NEEDS_REVIEW" | "FAILED" | "CANCELLED";
  stage: "QUEUED" | "VALIDATING_BUNDLE" | "PARSING" | "OCR" | "EXTRACTING" | "CANONICALIZING" | "COMPLETE";
  input_bundle_hash: string;
  input_bundle_location: string;
  input_contract_version: typeof PACKAGE_BUNDLE_CONTRACT | typeof RUNTIME_BUNDLE_CONTRACT;
  output_contract_version: typeof CANONICAL_PACKAGE_CONTRACT;
  requested_parser_version: string;
  idempotency_key: string;
  attempt: number;
  max_attempts: number;
  lease: null | { worker_id: string; claimed_at: string; heartbeat_at: string; expires_at: string };
  error: null | { code: string; message: string; retryable: boolean };
  created_at: string;
  available_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: true, strictRequired: false }));
ajv.addSchema(manifestSchema);
ajv.addSchema(ingestionJobSchema);
ajv.addSchema(claimResponseSchema);
ajv.addSchema(progressEventSchema);
ajv.addSchema(artifactPrepareSchema);
ajv.addSchema(resultCallbackSchema);
ajv.addSchema(parserResultSchema);
ajv.addSchema(canonicalSnapshotSchema);

function issues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 12).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`);
}

function parse<T>(schemaId: string, value: unknown, code: string): T {
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema is not registered: ${schemaId}`);
  if (!validate(value)) {
    throw new DomainError(code, `Contract validation failed: ${issues(validate.errors).join("; ")}`, 422);
  }
  return value as T;
}

export function parsePackageBundleManifest(value: unknown) {
  return parse<PackageBundleManifest>(manifestSchema.$id, value, "INVALID_BUNDLE_MANIFEST");
}

export function parseIngestionJob(value: unknown) {
  return parse<IngestionJobContract>(ingestionJobSchema.$id, value, "INVALID_INGESTION_JOB");
}

export function parseIngestionProgress(value: unknown) {
  return parse<IngestionProgressEvent>(progressEventSchema.$id, value, "INVALID_INGESTION_PROGRESS");
}

export function parseArtifactPrepare(value: unknown) {
  return parse<IngestionArtifactPrepare>(artifactPrepareSchema.$id, value, "INVALID_ARTIFACT_PREPARE");
}

export function parseIngestionResult(value: unknown) {
  return parse<IngestionResultCallback>(resultCallbackSchema.$id, value, "INVALID_INGESTION_RESULT");
}

export function parseParserResult(value: unknown) {
  return parse<ParserResult>(parserResultSchema.$id, value, "INVALID_PARSER_RESULT");
}

export function parseCanonicalAnalysisSnapshot(value: unknown) {
  return parse<CanonicalAnalysisSnapshot>(canonicalSnapshotSchema.$id, value, "INVALID_CANONICAL_SNAPSHOT");
}

export function validateClaimResponse<T>(value: T) {
  return parse<T>(claimResponseSchema.$id, value, "INVALID_CLAIM_RESPONSE");
}

export function validateProgressAck<T>(value: T) {
  return parse<T>(`${progressEventSchema.$id}#/$defs/ack`, value, "INVALID_PROGRESS_ACK");
}

export function validateArtifactPrepareResponse<T>(value: T) {
  return parse<T>(`${artifactPrepareSchema.$id}#/$defs/response`, value, "INVALID_ARTIFACT_RESPONSE");
}

export function validateResultAck<T>(value: T) {
  return parse<T>(`${resultCallbackSchema.$id}#/$defs/ack`, value, "INVALID_RESULT_ACK");
}
