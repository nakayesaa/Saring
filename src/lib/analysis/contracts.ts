import type {
  AnalysisEngine,
  AnalysisProgressEvent,
} from "@/lib/analysis-progress";
import type { EngineResult } from "@/lib/price-engine/contracts";

export const requestedAnalysisEngines = [
  "PRICE",
  "DOCUMENT",
  "GRAPH",
  "TECHNICAL",
  "COMPLETENESS",
  "DATA_QUALITY",
] as const satisfies readonly AnalysisEngine[];

export type AnalysisJobContract = {
  schema_version: "saring-analysis-job-1.0.0";
  job_id: string;
  run_id: string;
  organization_id: string;
  package_id: string;
  job_kind: "ANALYSIS";
  status: "QUEUED" | "CLAIMED" | "RUNNING" | "COMPLETED" | "NEEDS_REVIEW" | "ABSTAINED" | "FAILED" | "CANCELLED";
  stage: "QUEUED" | "VALIDATING_SNAPSHOT" | "PREPARING_ENGINES" | "RUNNING_ENGINES" | "FUSING_EVIDENCE" | "VALIDATING_RESULTS" | "COMPLETE";
  requested_engines: AnalysisEngine[];
  canonical_snapshot_hash: string;
  canonical_snapshot_location: string;
  input_contract_version: "saring-canonical-package-1.0.0";
  output_contract_version: "saring-engine-result-1.0.0";
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

export type GeneralEngineResult = Omit<EngineResult, "engine"> & {
  engine: AnalysisEngine;
};

export type EngineDispatchMessage =
  | { kind: "progress"; delayMs: number; payload: AnalysisProgressEvent }
  | { kind: "result"; delayMs: number; payload: GeneralEngineResult };
