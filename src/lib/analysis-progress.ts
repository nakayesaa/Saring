export type AnalysisEngine =
  | "PRICE"
  | "DOCUMENT"
  | "GRAPH"
  | "TECHNICAL"
  | "COMPLETENESS"
  | "DATA_QUALITY"
  | "FUSION";

export type AnalysisProgressStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "WARNING"
  | "ABSTAINED"
  | "FAILED";

export type AnalysisProgressEvent = {
  schema_version: "saring-analysis-progress-event-1.0.0";
  event_id: string;
  sequence: number;
  job_id: string;
  run_id: string;
  package_id: string;
  engine: AnalysisEngine | null;
  event_type:
    | "RUN_QUEUED"
    | "RUN_STARTED"
    | "ENGINE_QUEUED"
    | "ENGINE_STARTED"
    | "STAGE_STARTED"
    | "PROGRESS"
    | "ENGINE_COMPLETED"
    | "ENGINE_WARNING"
    | "ENGINE_ABSTAINED"
    | "ENGINE_FAILED"
    | "FUSION_STARTED"
    | "RUN_COMPLETED"
    | "RUN_FAILED";
  stage: string;
  status: AnalysisProgressStatus;
  completed_units: number | null;
  total_units: number | null;
  unit_label: string | null;
  message: string;
  finding_count: number | null;
  occurred_at: string;
};

export type TimedAnalysisProgressEvent = {
  delayMs: number;
  event: AnalysisProgressEvent;
};

export type AnalysisProcessingViewModel = {
  packageId: string;
  packageName: string;
  runId: string;
  jobId: string;
  analysisCutoffAt: string;
  requestedEngines: AnalysisEngine[];
  timeline: TimedAnalysisProgressEvent[];
};

export function sequenceAnalysisTimeline(
  timeline: TimedAnalysisProgressEvent[],
  runId: string,
) {
  return [...timeline]
    .sort((left, right) => left.delayMs - right.delayMs)
    .map(({ delayMs, event }, index) => {
      const sequence = index + 1;
      return {
        delayMs,
        event: {
          ...event,
          event_id: `EVT:${runId}:${sequence}`,
          sequence,
        },
      };
    });
}

export const primaryAnalysisEngines = [
  { key: "PRICE", number: "01", title: "Price intelligence", description: "Conditional price ranges, comparable cohorts, and explainable deviations." },
  { key: "DOCUMENT", number: "02", title: "Analisis bukti dokumen", description: "Kemiripan teks non-template, kontradiksi fakta lintas dokumen, dan locator sumber." },
  { key: "GRAPH", number: "03", title: "Relationship graph analysis", description: "Dated co-bidding, concentration, and transparent historical motifs." },
] as const satisfies readonly { key: AnalysisEngine; number: string; title: string; description: string }[];

export const supportingAnalysisEngines = [
  { key: "TECHNICAL", title: "Technical matching" },
  { key: "COMPLETENESS", title: "Document completeness" },
  { key: "DATA_QUALITY", title: "Data quality" },
] as const satisfies readonly { key: AnalysisEngine; title: string }[];

type EventInput = Omit<
  AnalysisProgressEvent,
  "schema_version" | "event_id" | "sequence" | "job_id" | "run_id" | "package_id" | "occurred_at"
>;

export function buildGoldenAnalysisProgress(input: {
  packageId: string;
  packageName: string;
  analysisCutoffAt: string;
  runId?: string;
  jobId?: string;
  baseTime?: string;
}): AnalysisProcessingViewModel {
  const runId = input.runId ?? "AR-2026-001";
  const jobId = input.jobId ?? "JOB-AR-2026-001";
  const baseTime = Date.parse(input.baseTime ?? "2026-08-07T03:30:00.000Z");
  let sequence = 0;

  function at(delayMs: number, event: EventInput): TimedAnalysisProgressEvent {
    sequence += 1;
    return {
      delayMs,
      event: {
        schema_version: "saring-analysis-progress-event-1.0.0",
        event_id: `EVT-${runId}-${String(sequence).padStart(3, "0")}`,
        sequence,
        job_id: jobId,
        run_id: runId,
        package_id: input.packageId,
        occurred_at: new Date(baseTime + delayMs).toISOString(),
        ...event,
      },
    };
  }

  const timeline = sequenceAnalysisTimeline([
    at(350, runEvent("RUN_STARTED", "SNAPSHOT_VALIDATION", "RUNNING", "Canonical snapshot locked and validated.")),

    at(800, engineEvent("PRICE", "ENGINE_STARTED", "NORMALIZING_OFFERS", "RUNNING", 0, 15, "offers", "Normalizing 15 commercial offers.")),
    at(1700, engineEvent("PRICE", "PROGRESS", "NORMALIZING_OFFERS", "RUNNING", 9, 15, "offers", "Resolving product, warranty, tax, and service context.")),
    at(3000, engineEvent("PRICE", "PROGRESS", "BUILDING_COMPARABLE_COHORT", "RUNNING", 15, 15, "offers", "Building a specification-matched comparator cohort.")),
    at(4700, engineEvent("PRICE", "STAGE_STARTED", "ESTIMATING_PRICE_RANGE", "RUNNING", 15, 15, "offers", "Estimating the conditional Q10/Q50/Q90 range.")),
    at(6300, engineEvent("PRICE", "PROGRESS", "SCORING_PRICE_DEVIATIONS", "RUNNING", 15, 15, "offers", "Evaluating HPS and vendor price deviations.")),
    at(7600, engineEvent("PRICE", "ENGINE_COMPLETED", "COMPLETE", "COMPLETED", 15, 15, "offers", "15 offers analyzed · 3 cited findings.", 3)),

    at(950, engineEvent("DOCUMENT", "ENGINE_STARTED", "EXTRACTING_PASSAGES", "RUNNING", 0, 98, "records", "Preparing page-level document passages.")),
    at(2200, engineEvent("DOCUMENT", "PROGRESS", "EXCLUDING_TEMPLATES", "RUNNING", 28, 98, "records", "Excluding official templates and mandatory clauses.")),
    at(3900, engineEvent("DOCUMENT", "PROGRESS", "COMPARING_PASSAGES", "RUNNING", 57, 98, "records", "Comparing non-template passages across vendors.")),
    at(6100, engineEvent("DOCUMENT", "PROGRESS", "COMPARING_PASSAGES", "RUNNING", 84, 98, "records", "Checking rare errors and near-duplicate structure.")),
    at(7800, engineEvent("DOCUMENT", "PROGRESS", "VALIDATING_DOCUMENT_LOCATORS", "RUNNING", 96, 98, "records", "Validating page and source locators.")),
    at(8800, engineEvent("DOCUMENT", "ENGINE_COMPLETED", "COMPLETE", "COMPLETED", 98, 98, "records", "98 records compared · 2 cited matches.", 2)),

    at(1100, engineEvent("GRAPH", "ENGINE_STARTED", "RESOLVING_ENTITIES", "RUNNING", 0, 112, "packages", "Resolving package, vendor, buyer, and unit identities.")),
    at(2700, engineEvent("GRAPH", "PROGRESS", "LOADING_HISTORICAL_EDGES", "RUNNING", 34, 112, "packages", "Loading dated participation history.")),
    at(4500, engineEvent("GRAPH", "PROGRESS", "ENFORCING_ANALYSIS_CUTOFF", "RUNNING", 68, 112, "packages", "Excluding graph events after the analysis cutoff.")),
    at(6700, engineEvent("GRAPH", "PROGRESS", "EVALUATING_GRAPH_MOTIFS", "RUNNING", 101, 112, "packages", "Evaluating repeated co-bidding and award concentration.")),
    at(9000, engineEvent("GRAPH", "ENGINE_COMPLETED", "COMPLETE", "COMPLETED", 112, 112, "packages", "112 historical packages · 1 cited pattern.", 1)),

    at(2400, engineEvent("TECHNICAL", "ENGINE_STARTED", "TECHNICAL_MATCHING", "RUNNING", 0, 15, "offers", "Matching submitted specifications to requirements.")),
    at(5100, engineEvent("TECHNICAL", "ENGINE_COMPLETED", "COMPLETE", "COMPLETED", 15, 15, "offers", "Technical requirements checked.", 0)),
    at(2900, engineEvent("COMPLETENESS", "ENGINE_STARTED", "CHECKING_DOCUMENT_COMPLETENESS", "RUNNING", 0, 98, "records", "Reconciling required and available documents.")),
    at(5600, engineEvent("COMPLETENESS", "ENGINE_WARNING", "COMPLETE", "WARNING", 98, 98, "records", "One low-confidence field remains explicitly qualified.", 0)),
    at(3300, engineEvent("DATA_QUALITY", "ENGINE_STARTED", "CHECKING_DATA_QUALITY", "RUNNING", 0, 98, "records", "Checking provenance, confidence, and cutoff consistency.")),
    at(5900, engineEvent("DATA_QUALITY", "ENGINE_COMPLETED", "COMPLETE", "COMPLETED", 98, 98, "records", "Data-quality gates completed.", 0)),

    at(9300, runEvent("FUSION_STARTED", "FUSING_EVIDENCE", "RUNNING", "Fusing valid evidence while excluding abstained signals.")),
    at(10100, runEvent("STAGE_STARTED", "VALIDATING_RESULTS", "RUNNING", "Validating citations, alternative explanations, and module boundaries.")),
    at(11200, runEvent("RUN_COMPLETED", "COMPLETE", "COMPLETED", "Analysis complete. Six findings are ready for human review.")),
  ], runId);

  return {
    packageId: input.packageId,
    packageName: input.packageName,
    runId,
    jobId,
    analysisCutoffAt: input.analysisCutoffAt,
    requestedEngines: [...primaryAnalysisEngines.map(({ key }) => key), ...supportingAnalysisEngines.map(({ key }) => key)],
    timeline,
  };
}

function runEvent(
  event_type: AnalysisProgressEvent["event_type"],
  stage: string,
  status: AnalysisProgressStatus,
  message: string,
): EventInput {
  return {
    engine: null,
    event_type,
    stage,
    status,
    completed_units: null,
    total_units: null,
    unit_label: null,
    message,
    finding_count: null,
  };
}

function engineEvent(
  engine: AnalysisEngine,
  event_type: AnalysisProgressEvent["event_type"],
  stage: string,
  status: AnalysisProgressStatus,
  completed_units: number,
  total_units: number,
  unit_label: string,
  message: string,
  finding_count: number | null = null,
): EventInput {
  return {
    engine,
    event_type,
    stage,
    status,
    completed_units,
    total_units,
    unit_label,
    message,
    finding_count,
  };
}
