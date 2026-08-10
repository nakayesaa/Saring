import type {
  AnalysisEngine,
  AnalysisProgressEvent,
} from "@/lib/analysis-progress";
import type { EngineResult } from "@/lib/price-engine/contracts";

export const ANALYSIS_JOB_CONTRACT = "saring-analysis-job-2.0.0";
export const ENGINE_RESULT_CONTRACT = "saring-engine-result-2.0.0";
export const ANALYSIS_PIPELINE_VERSION = "saring-analysis-pipeline-2.2.0";
export const CANONICAL_ANALYSIS_INPUT_CONTRACT = "saring-canonical-analysis-snapshot-1.0.0";

export const requestedAnalysisEngines = [
  "PRICE",
  "DOCUMENT",
  "GRAPH",
  "TECHNICAL",
  "COMPLETENESS",
  "DATA_QUALITY",
] as const satisfies readonly AnalysisEngine[];

export const workerAnalysisEngines = ["DOCUMENT"] as const satisfies readonly AnalysisEngine[];

export type AnalysisJobContract = {
  schema_version: typeof ANALYSIS_JOB_CONTRACT;
  job_id: string;
  run_id: string;
  organization_id: string;
  package_id: string;
  job_kind: "ANALYSIS";
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "NEEDS_REVIEW" | "ABSTAINED" | "FAILED" | "CANCELLED";
  stage: "QUEUED" | "VALIDATING_SNAPSHOT" | "PREPARING_ENGINES" | "RUNNING_ENGINES" | "FUSING_EVIDENCE" | "VALIDATING_RESULTS" | "UPLOADING_RESULTS" | "COMPLETE";
  requested_engines: AnalysisEngine[];
  canonical_snapshot_hash: string;
  canonical_snapshot_location: string;
  input_contract_version: typeof CANONICAL_ANALYSIS_INPUT_CONTRACT;
  output_contract_version: typeof ENGINE_RESULT_CONTRACT;
  pipeline_version: typeof ANALYSIS_PIPELINE_VERSION;
  idempotency_key: string;
  attempt: number;
  max_attempts: number;
  lease: null | {
    worker_id: string;
    claimed_at: string;
    heartbeat_at: string;
    expires_at: string;
  };
  error: null | { code: string; message: string; retryable: boolean };
  created_at: string;
  available_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type GeneralEngineResult = Omit<EngineResult, "schema_version" | "engine"> & {
  schema_version: typeof ENGINE_RESULT_CONTRACT;
  engine: AnalysisEngine;
};

export type EngineDispatchMessage =
  | { kind: "progress"; delayMs: number; payload: AnalysisProgressEvent }
  | { kind: "result"; delayMs: number; payload: GeneralEngineResult };
