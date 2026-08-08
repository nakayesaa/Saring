import "server-only";

import { buildPriceEngineInput, contentHash } from "@/lib/price-engine/adapter";
import type {
  EngineFinding,
  EngineResult,
  PriceEngineDetail,
  PriceEvidenceResponse,
} from "@/lib/price-engine/contracts";
import {
  FixturePriceEngineExecutor,
  type PriceEngineExecutor,
} from "@/lib/price-engine/executor";
import {
  FixturePriceAnalysisRepository,
  type PriceAnalysisRepository,
} from "@/lib/price-engine/repository";
import { parsePriceEvidenceResponse } from "@/lib/price-engine/validation";

const ENGINE_VERSION = "price-engine-1.0.0";
const COMPARATOR_SNAPSHOT = "comparators-fixture-2025-09-18";

export class PriceAnalysisNotFoundError extends Error {
  constructor(readonly packageId: string) {
    super(`Package not found: ${packageId}`);
    this.name = "PriceAnalysisNotFoundError";
  }
}

function findingFor(detail: PriceEngineDetail): EngineFinding | null {
  if (!detail.assessment) return null;
  const alternatives = detail.alternative_explanations.map(({ label }) => label);
  const positionLabel = {
    BELOW_Q10: "di bawah Q10",
    WITHIN_INTERVAL: "di dalam interval pembanding",
    ABOVE_Q90: "di atas Q90",
  }[detail.assessment.position];
  return {
    finding_id: `FINDING:${detail.target_id}`,
    finding_type: "PRICE_INTERVAL_POSITION",
    scope: "ITEM",
    subject_ids: [
      detail.item_id,
      detail.participation_id,
      ...(detail.vendor_id ? [detail.vendor_id] : []),
    ],
    score: detail.assessment.review_priority_score,
    confidence: detail.confidence.overall,
    summary: `Harga penawaran berada ${positionLabel}.`,
    evidence_locator_ids: detail.evidence_locator_ids,
    alternative_explanations: alternatives,
    metrics: {
      detail_id: detail.detail_id,
      target_id: detail.target_id,
      cohort_level: detail.cohort?.cohort_level ?? null,
      comparator_count: detail.cohort?.comparator_count ?? 0,
      currency: detail.interval?.currency ?? detail.quote.currency,
      q10: detail.interval?.q10 ?? null,
      q50: detail.interval?.q50 ?? null,
      q90: detail.interval?.q90 ?? null,
      quoted_unit_price: detail.quote.quoted_unit_price,
      position: detail.assessment.position,
      relative_deviation_above_q90: detail.assessment.relative_deviation_above_q90,
      estimated_exposure_requiring_verification:
        detail.assessment.estimated_exposure_requiring_verification,
    },
  };
}

function resultStatus(details: PriceEngineDetail[]): EngineResult["status"] {
  if (details.some(({ status }) => status === "SCORED")) return "SCORED";
  if (details.some(({ status }) => status === "LOW_CONFIDENCE")) return "LOW_CONFIDENCE";
  if (details.every(({ status }) => status === "NOT_APPLICABLE")) return "NOT_APPLICABLE";
  return "ABSTAINED";
}

function serializeEngineResult(
  inputHash: string,
  generatedAt: string,
  details: PriceEngineDetail[],
  evidenceLocators: EngineResult["evidence_locators"],
): EngineResult {
  const findings = details.flatMap((detail) => {
    const finding = findingFor(detail);
    return finding ? [finding] : [];
  });
  const status = resultStatus(details);
  const ranked = [...findings].sort(
    (left, right) => (right.score ?? -1) - (left.score ?? -1) || right.confidence - left.confidence,
  );
  const top = ranked[0];
  const abstentionReasons = [
    ...new Set(details.flatMap((detail) => detail.abstention?.reason_code ?? [])),
  ];
  const alternatives = [
    ...new Set(details.flatMap((detail) => detail.alternative_explanations.map(({ label }) => label))),
  ];
  const first = details[0];

  return {
    schema_version: "saring-engine-result-1.0.0",
    result_id: `RESULT:${first.run_id}:PRICE`,
    run_id: first.run_id,
    package_id: first.package_id,
    analysis_cutoff_at: first.analysis_cutoff,
    engine: "PRICE",
    engine_version: first.engine_version,
    model_version: first.model_artifact_id,
    status,
    score: status === "ABSTAINED" || status === "NOT_APPLICABLE" ? null : (top?.score ?? null),
    confidence: status === "ABSTAINED" || status === "NOT_APPLICABLE" ? null : (top?.confidence ?? null),
    summary: status === "SCORED"
      ? `${findings.length} penawaran memiliki posisi harga yang dapat ditelusuri terhadap interval pembanding.`
      : "Price Engine tidak menghasilkan score karena persyaratan bukti tidak terpenuhi.",
    findings: status === "ABSTAINED" || status === "NOT_APPLICABLE" ? [] : findings,
    evidence_locators: evidenceLocators,
    alternative_explanations: alternatives,
    abstention_reason: status === "ABSTAINED" || status === "NOT_APPLICABLE"
      ? abstentionReasons.join(", ") || status
      : null,
    input_snapshot_hash: inputHash,
    created_at: generatedAt,
  };
}

export class PriceAnalysisService {
  constructor(
    private readonly repository: PriceAnalysisRepository,
    private readonly executor: PriceEngineExecutor,
  ) {}

  async analyzePackage(packageId: string): Promise<PriceEvidenceResponse> {
    const canonical = await this.repository.getCanonicalPackage(packageId);
    if (!canonical) throw new PriceAnalysisNotFoundError(packageId);
    const runId = `AR:${contentHash({ packageId, engine: ENGINE_VERSION }).slice(0, 24)}`;
    const input = buildPriceEngineInput(canonical, {
      runId,
      engineVersion: ENGINE_VERSION,
      comparatorSnapshotId: COMPARATOR_SNAPSHOT,
      evidenceLocatorIdsFor: (identity) => this.repository.evidenceLocatorIdsFor(identity),
    });
    const output = await this.executor.analyze(input);
    const locatorIds = output.details.flatMap(({ evidence_locator_ids }) => evidence_locator_ids);
    const locators = await this.repository.resolveEvidenceLocators(packageId, locatorIds);
    const engineResult = serializeEngineResult(
      input.canonical_input_hash,
      output.generated_at,
      output.details,
      locators,
    );
    return parsePriceEvidenceResponse({
      schema_version: "saring-price-evidence-response-1.0.0",
      generated_at: output.generated_at,
      engine_result: engineResult,
      details: output.details,
    });
  }
}

let service: PriceAnalysisService | undefined;

export function getPriceAnalysisService() {
  service ??= new PriceAnalysisService(
    new FixturePriceAnalysisRepository(),
    new FixturePriceEngineExecutor(() => new Date("2025-09-19T11:00:30.000Z")),
  );
  return service;
}

export interface PriceEvidenceQuery {
  getByPackageId(packageId: string): Promise<PriceEvidenceResponse>;
}

class FixturePriceEvidenceQuery implements PriceEvidenceQuery {
  async getByPackageId(packageId: string) {
    return getPriceAnalysisService().analyzePackage(packageId);
  }
}

let evidenceQuery: PriceEvidenceQuery | undefined;

export function getPriceEvidenceQuery() {
  evidenceQuery ??= new FixturePriceEvidenceQuery();
  return evidenceQuery;
}
