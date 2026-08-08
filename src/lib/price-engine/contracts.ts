export type Scalar = string | number | boolean | null;
export type TriState = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
export type ResolutionLevel =
  | "EXACT_SKU"
  | "STRICT_CONFIGURATION"
  | "RELAXED_CONFIGURATION"
  | "UNRESOLVED";

export type NormalizedProduct = {
  category_code: string;
  brand: string | null;
  model: string | null;
  part_number: string | null;
  condition: "NEW" | "USED" | "REFURBISHED" | "UNKNOWN";
  specifications: Record<string, Scalar>;
  configuration_fingerprint: string | null;
  resolution_level: ResolutionLevel;
};

export type CommercialBasis = {
  tax: TriState;
  shipping: TriState;
  installation: TriState;
  configuration_service: TriState;
  bundled_software_service: TriState;
  warranty_months: number | null;
  delivery_days: number | null;
  payment_terms_code: string | null;
};

export type PriceEngineTarget = {
  target_id: string;
  item_id: string;
  participation_id: string;
  participant_id: string;
  vendor_id: string | null;
  description: string;
  quoted_unit_price: number;
  quantity: number;
  unit: string;
  currency: string;
  procurement_date: string;
  region_code: string | null;
  normalized_product: NormalizedProduct;
  commercial_basis: CommercialBasis;
  hps_unit_price: number | null;
  field_quality: {
    overall: number;
    material_fields: Record<
      string,
      {
        confidence: number;
        status: "EXTRACTED" | "REVIEWED" | "MISSING" | "UNREADABLE";
        locator_id: string | null;
      }
    >;
  };
  evidence_locator_ids: string[];
};

export type PriceEngineInput = {
  schema_version: "saring-price-engine-input-1.0.0";
  run_id: string;
  package_id: string;
  analysis_cutoff: string;
  canonical_input_hash: string;
  requested_engine_version: string;
  comparator_snapshot_id: string;
  targets: PriceEngineTarget[];
};

export type EvidenceLocator = {
  schema_version: "saring-evidence-locator-1.0.0";
  locator_id: string;
  package_id: string;
  source_type:
    | "DOCUMENT_PAGE"
    | "DOCUMENT_REGION"
    | "JSON_PATH"
    | "TABLE_CELL"
    | "GRAPH_EDGE"
    | "DATABASE_RECORD"
    | "EXTERNAL_RECORD";
  source_hash: string;
  document_id?: string;
  page_number?: number;
  bbox?: [number, number, number, number];
  json_path?: string;
  table_name?: string;
  row_key?: string;
  column_name?: string;
  graph_edge_id?: string;
  record_type?: string;
  record_id?: string;
  source_system?: string;
  source_record_id?: string;
  excerpt?: string;
  label?: string;
};

export type EngineFinding = {
  finding_id: string;
  finding_type: string;
  scope: "PACKAGE" | "VENDOR" | "CROSS_VENDOR" | "ITEM";
  subject_ids: string[];
  score: number | null;
  confidence: number;
  summary: string;
  evidence_locator_ids: string[];
  alternative_explanations: string[];
  metrics?: Record<string, Scalar>;
};

export type EngineResult = {
  schema_version: "saring-engine-result-1.0.0";
  result_id: string;
  run_id: string;
  package_id: string;
  analysis_cutoff_at: string;
  engine: "PRICE";
  engine_version: string;
  model_version: string | null;
  status: "SCORED" | "LOW_CONFIDENCE" | "ABSTAINED" | "NOT_APPLICABLE";
  score: number | null;
  confidence: number | null;
  summary: string;
  findings: EngineFinding[];
  evidence_locators: EvidenceLocator[];
  alternative_explanations: string[];
  abstention_reason: string | null;
  input_snapshot_hash: string;
  created_at: string;
};

export type PriceEngineDetail = {
  schema_version: "saring-price-engine-detail-1.0.0";
  detail_id: string;
  run_id: string;
  package_id: string;
  target_id: string;
  item_id: string;
  participation_id: string;
  vendor_id: string | null;
  engine_version: string;
  model_artifact_id: string;
  comparator_snapshot_id: string;
  analysis_cutoff: string;
  status: "SCORED" | "LOW_CONFIDENCE" | "ABSTAINED" | "NOT_APPLICABLE";
  normalized_target: NormalizedProduct & { description: string };
  cohort: {
    cohort_level: Exclude<ResolutionLevel, "UNRESOLVED">;
    comparator_count: number;
    source_count: number;
    seller_count: number;
    region_count: number;
    observation_date_min: string;
    observation_date_max: string;
    included_observation_ids: string[];
    excluded_count_by_reason: Record<string, number>;
    deduplication_policy_version: string;
    retrieval_policy_version: string;
  } | null;
  interval: {
    currency: string;
    q10: number;
    q50: number;
    q90: number;
    method: "QUANTILE_REGRESSION";
    calibration_status: "CALIBRATED" | "UNCALIBRATED";
    calibration_scope: string;
  } | null;
  quote: {
    quoted_unit_price: number;
    quantity: number;
    currency: string;
    hps_unit_price: number | null;
  };
  assessment: {
    position: "BELOW_Q10" | "WITHIN_INTERVAL" | "ABOVE_Q90";
    relative_deviation_above_q90: number;
    unit_difference_above_q90: number;
    estimated_exposure_requiring_verification: number;
    review_priority_score: number;
  } | null;
  confidence: {
    overall: number;
    cohort_sufficiency: number;
    field_completeness: number;
    interval_specificity: number;
    calibration_reliability: number;
    limiting_factors: string[];
  };
  comparator_references: Array<{
    observation_id: string;
    rank: number;
    similarity_score: number;
    normalized_unit_price: number;
    currency: string;
    observed_at: string;
    cohort_level: Exclude<ResolutionLevel, "UNRESOLVED">;
    material_differences: string[];
    commercial_basis_differences: string[];
    locator_id: string;
  }>;
  adjustments: Array<{ code: string; description: string; amount: number | null }>;
  exclusions: Array<{ observation_id: string; reason_code: string; detail: string }>;
  data_quality_flags: string[];
  alternative_explanations: Array<{
    code: string;
    label: string;
    basis: string;
    locator_id: string | null;
  }>;
  evidence_locator_ids: string[];
  abstention: {
    reason_code: string;
    message: string;
    missing_or_failed_requirements: string[];
    recoverable: boolean;
  } | null;
};

export type PriceEvidenceResponse = {
  schema_version: "saring-price-evidence-response-1.0.0";
  generated_at: string;
  engine_result: EngineResult;
  details: PriceEngineDetail[];
};

export type PriceEngineOutput = {
  schema_version: "saring-price-engine-output-1.0.0";
  run_id: string;
  package_id: string;
  generated_at: string;
  details: PriceEngineDetail[];
};
