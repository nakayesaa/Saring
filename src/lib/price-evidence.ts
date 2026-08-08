import type {
  EngineFinding,
  EvidenceLocator,
  PriceEngineDetail,
  PriceEvidenceResponse,
} from "@/lib/price-engine/contracts";

export type PriceEvidenceLocator = {
  locator_id: string;
  source_type: EvidenceLocator["source_type"];
  label: string;
  source: string;
  locator: string;
  excerpt: string;
};

export type PriceEvidenceFinding = {
  finding_id: string;
  finding_type: string;
  scope: "PACKAGE" | "ITEM";
  subject_ids: string[];
  title: string;
  summary: string;
  metric: string;
  confidence: number;
  alternative_explanations: string[];
  evidence_locators: PriceEvidenceLocator[];
};

export type PriceEvidenceViewModel = {
  projection_version: "saring-price-evidence-ui-1.0.0";
  source_contract_versions: ["saring-canonical-package-1.0.0", "saring-engine-result-1.0.0", "saring-evidence-locator-1.0.0"];
  package_id: string;
  package_name: string;
  run_id: string;
  result_id: string;
  analysis_cutoff_at: string;
  engine: "PRICE";
  engine_version: string;
  model_version: string;
  status: "SCORED";
  score: number;
  confidence: number;
  summary: string;
  item: {
    item_id: string;
    description: string;
    commercial_type: "COTS";
    category: string;
    quantity: number;
    unit: "unit";
    specifications: Array<{ label: string; value: string }>;
  };
  interval: {
    currency: "IDR";
    q10: number;
    q50: number;
    q90: number;
    hps_unit: number;
    quoted_unit: number;
    relative_deviation: number;
    exposure: number;
  };
  cohort: {
    observations_assessed: number;
    comparable_observations: number;
    comparability_review: number;
    basis: Array<{ label: string; value: string }>;
    review_items: Array<{ subject: string; reason: string }>;
  };
  findings: PriceEvidenceFinding[];
  limitations: string[];
  recommended_review_actions: string[];
};

function locatorSource(locator: EvidenceLocator) {
  if (locator.source_type.startsWith("DOCUMENT")) return locator.document_id ?? "Document";
  if (locator.source_type === "DATABASE_RECORD") return locator.record_type ?? "Database record";
  if (locator.source_type === "EXTERNAL_RECORD") return locator.source_system ?? "External record";
  return locator.table_name ?? "Canonical package";
}

function locatorPosition(locator: EvidenceLocator) {
  if (locator.json_path) return locator.json_path;
  if (locator.page_number) return `Halaman ${locator.page_number}`;
  if (locator.row_key) return `${locator.row_key} · ${locator.column_name ?? "record"}`;
  if (locator.record_id) return locator.record_id;
  if (locator.source_record_id) return locator.source_record_id;
  return locator.locator_id;
}

function findingMetric(detail: PriceEngineDetail) {
  if (!detail.assessment) return "Engine abstained";
  const percent = detail.assessment.relative_deviation_above_q90 * 100;
  return detail.assessment.position === "ABOVE_Q90"
    ? `+${percent.toFixed(1)}% di atas Q90`
    : "Di dalam interval pembanding";
}

function findingView(
  finding: EngineFinding,
  detail: PriceEngineDetail,
  locatorById: Map<string, EvidenceLocator>,
): PriceEvidenceFinding {
  return {
    finding_id: finding.finding_id,
    finding_type: finding.finding_type,
    scope: finding.scope === "PACKAGE" ? "PACKAGE" : "ITEM",
    subject_ids: finding.subject_ids,
    title: finding.summary,
    summary: finding.summary,
    metric: findingMetric(detail),
    confidence: finding.confidence,
    alternative_explanations: finding.alternative_explanations,
    evidence_locators: finding.evidence_locator_ids.flatMap((locatorId) => {
      const locator = locatorById.get(locatorId);
      return locator
        ? [{
            locator_id: locator.locator_id,
            source_type: locator.source_type,
            label: locator.label ?? "Evidence source",
            source: locatorSource(locator),
            locator: locatorPosition(locator),
            excerpt: locator.excerpt ?? "Buka sumber untuk melihat record immutable.",
          }]
        : [];
    }),
  };
}

function displaySpecifications(detail: PriceEngineDetail) {
  const entries = Object.entries(detail.normalized_target.specifications).slice(0, 4);
  return entries.map(([label, value]) => ({
    label: label.replaceAll("_", " "),
    value: value === null ? "Tidak tersedia" : String(value),
  }));
}

export function buildPriceEvidenceViewModel(
  response: PriceEvidenceResponse,
  packageName: string,
): PriceEvidenceViewModel {
  if (response.engine_result.status !== "SCORED") {
    throw new Error("The current Price Evidence screen requires a scored result.");
  }
  const primary = [...response.details]
    .filter((detail) => detail.status === "SCORED" && detail.interval && detail.assessment && detail.cohort)
    .sort((left, right) => (right.assessment?.review_priority_score ?? 0) - (left.assessment?.review_priority_score ?? 0))[0];
  if (!primary?.interval || !primary.assessment || !primary.cohort) {
    throw new Error("A scored Price Engine response must contain one complete detail.");
  }
  const findingByTarget = new Map(
    response.engine_result.findings.map((finding) => [finding.metrics?.target_id, finding]),
  );
  const locatorById = new Map(
    response.engine_result.evidence_locators.map((locator) => [locator.locator_id, locator]),
  );
  const findings = response.details.flatMap((detail) => {
    const finding = findingByTarget.get(detail.target_id);
    return finding ? [findingView(finding, detail, locatorById)] : [];
  });
  const exclusions = Object.values(primary.cohort.excluded_count_by_reason).reduce((sum, count) => sum + count, 0);
  const reviewItems = primary.exclusions.map((exclusion) => ({
    subject: exclusion.observation_id,
    reason: exclusion.detail,
  }));

  return {
    projection_version: "saring-price-evidence-ui-1.0.0",
    source_contract_versions: [
      "saring-canonical-package-1.0.0",
      "saring-engine-result-1.0.0",
      "saring-evidence-locator-1.0.0",
    ],
    package_id: response.engine_result.package_id,
    package_name: packageName,
    run_id: response.engine_result.run_id,
    result_id: response.engine_result.result_id,
    analysis_cutoff_at: response.engine_result.analysis_cutoff_at,
    engine: "PRICE",
    engine_version: response.engine_result.engine_version,
    model_version: response.engine_result.model_version ?? "deterministic-baseline",
    status: "SCORED",
    score: response.engine_result.score ?? 0,
    confidence: response.engine_result.confidence ?? 0,
    summary: response.engine_result.summary,
    item: {
      item_id: primary.item_id,
      description: primary.normalized_target.description,
      commercial_type: "COTS",
      category: primary.normalized_target.category_code,
      quantity: primary.quote.quantity,
      unit: "unit",
      specifications: displaySpecifications(primary),
    },
    interval: {
      currency: "IDR",
      q10: primary.interval.q10,
      q50: primary.interval.q50,
      q90: primary.interval.q90,
      hps_unit: primary.quote.hps_unit_price ?? 0,
      quoted_unit: primary.quote.quoted_unit_price,
      relative_deviation: primary.assessment.relative_deviation_above_q90,
      exposure: primary.assessment.estimated_exposure_requiring_verification,
    },
    cohort: {
      observations_assessed: primary.cohort.comparator_count + exclusions,
      comparable_observations: primary.cohort.comparator_count,
      comparability_review: exclusions,
      basis: [
        { label: "Cohort", value: primary.cohort.cohort_level },
        { label: "Spesifikasi", value: primary.normalized_target.configuration_fingerprint ?? "Belum resolved" },
        { label: "Snapshot", value: primary.comparator_snapshot_id },
        { label: "Kalibrasi", value: primary.interval.calibration_status },
      ],
      review_items: reviewItems,
    },
    findings,
    limitations: primary.confidence.limiting_factors,
    recommended_review_actions: primary.alternative_explanations.map(({ label }) => `Verifikasi ${label.toLowerCase()}.`),
  };
}
