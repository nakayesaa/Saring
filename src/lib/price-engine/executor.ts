import "server-only";

import type {
  PriceEngineDetail,
  PriceEngineInput,
  PriceEngineOutput,
  PriceEngineTarget,
} from "@/lib/price-engine/contracts";
import { parsePriceEngineOutput } from "@/lib/price-engine/validation";

export interface PriceEngineExecutor {
  analyze(input: PriceEngineInput): Promise<PriceEngineOutput>;
}

const INTERVAL = { q10: 10_800_000, q50: 11_200_000, q90: 12_600_000 } as const;
const COMPARATORS = [10_950_000, 11_200_000, 12_150_000] as const;
const INCLUDED_OBSERVATIONS = Array.from(
  { length: 13 },
  (_, index) => `OBS-LAPTOP-${String(index + 1).padStart(3, "0")}`,
);

function comparatorReferences(): PriceEngineDetail["comparator_references"] {
  return COMPARATORS.map((price, index) => ({
    observation_id: INCLUDED_OBSERVATIONS[index],
    rank: index + 1,
    similarity_score: 0.98 - index * 0.03,
    normalized_unit_price: price,
    currency: "IDR",
    observed_at: `2025-0${6 + index}-15T10:00:00+07:00`,
    cohort_level: "STRICT_CONFIGURATION",
    material_differences: [],
    commercial_basis_differences: [],
    locator_id: `LOC-COMP-${String(index + 1).padStart(3, "0")}`,
  }));
}

function detailFor(input: PriceEngineInput, target: PriceEngineTarget): PriceEngineDetail {
  const unitDifference = Math.max(0, target.quoted_unit_price - INTERVAL.q90);
  const deviation = unitDifference / INTERVAL.q90;
  const position = target.quoted_unit_price < INTERVAL.q10
    ? "BELOW_Q10"
    : target.quoted_unit_price > INTERVAL.q90
      ? "ABOVE_Q90"
      : "WITHIN_INTERVAL";
  const cohortSufficiency = 13 / 30;
  const intervalSpecificity = 1 - (INTERVAL.q90 - INTERVAL.q10) / INTERVAL.q50;
  const confidence = cohortSufficiency * target.field_quality.overall * intervalSpecificity;
  const comparatorRefs = comparatorReferences();
  const alternativeExplanations = position === "ABOVE_Q90"
    ? [{
        code: "INSTALLATION_CONFIGURATION",
        label: "Konfigurasi atau layanan tambahan",
        basis: "Komponen konfigurasi dan instalasi belum seluruhnya diketahui.",
        locator_id: target.evidence_locator_ids[0] ?? null,
      }]
    : [];

  return {
    schema_version: "saring-price-engine-detail-1.0.0",
    detail_id: `DETAIL:${target.target_id}`,
    run_id: input.run_id,
    package_id: input.package_id,
    target_id: target.target_id,
    item_id: target.item_id,
    participation_id: target.participation_id,
    vendor_id: target.vendor_id,
    engine_version: input.requested_engine_version,
    model_artifact_id: "price-qreg-fixture-1.0.0",
    comparator_snapshot_id: input.comparator_snapshot_id,
    analysis_cutoff: input.analysis_cutoff,
    status: "SCORED",
    normalized_target: { description: target.description, ...target.normalized_product },
    cohort: {
      cohort_level: "STRICT_CONFIGURATION",
      comparator_count: 13,
      source_count: 3,
      seller_count: 9,
      region_count: 4,
      observation_date_min: "2025-06-15T10:00:00+07:00",
      observation_date_max: "2025-08-15T10:00:00+07:00",
      included_observation_ids: INCLUDED_OBSERVATIONS,
      excluded_count_by_reason: { COMMERCIAL_BASIS_MISMATCH: 2 },
      deduplication_policy_version: "price-dedup-1.0.0",
      retrieval_policy_version: "price-retrieval-1.0.0",
    },
    interval: {
      currency: target.currency,
      ...INTERVAL,
      method: "QUANTILE_REGRESSION",
      calibration_status: "CALIBRATED",
      calibration_scope: "LAPTOP_BUSINESS:STRICT_CONFIGURATION",
    },
    quote: {
      quoted_unit_price: target.quoted_unit_price,
      quantity: target.quantity,
      currency: target.currency,
      hps_unit_price: target.hps_unit_price,
    },
    assessment: {
      position,
      relative_deviation_above_q90: deviation,
      unit_difference_above_q90: unitDifference,
      estimated_exposure_requiring_verification: unitDifference * target.quantity,
      review_priority_score: Math.min(1, deviation),
    },
    confidence: {
      overall: confidence,
      cohort_sufficiency: cohortSufficiency,
      field_completeness: target.field_quality.overall,
      interval_specificity: intervalSpecificity,
      calibration_reliability: 1,
      limiting_factors: ["Synthetic fixture comparators; production market evidence is not connected."],
    },
    comparator_references: comparatorRefs,
    adjustments: [],
    exclusions: [
      { observation_id: "OBS-LAPTOP-014", reason_code: "COMMERCIAL_BASIS_MISMATCH", detail: "Warranty basis differs." },
      { observation_id: "OBS-LAPTOP-015", reason_code: "COMMERCIAL_BASIS_MISMATCH", detail: "Service bundle is unresolved." },
    ],
    data_quality_flags: ["SYNTHETIC_FIXTURE"],
    alternative_explanations: alternativeExplanations,
    evidence_locator_ids: [
      ...target.evidence_locator_ids,
      ...comparatorRefs.map(({ locator_id }) => locator_id),
    ],
    abstention: null,
  };
}

export class FixturePriceEngineExecutor implements PriceEngineExecutor {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async analyze(input: PriceEngineInput) {
    return parsePriceEngineOutput({
      schema_version: "saring-price-engine-output-1.0.0",
      run_id: input.run_id,
      package_id: input.package_id,
      generated_at: this.now().toISOString(),
      details: input.targets.map((target) => detailFor(input, target)),
    });
  }
}

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function validatedEngineUrl(value: string) {
  const url = new URL(value);
  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("PRICE_ENGINE_URL must use HTTPS outside local development.");
  }
  return url;
}

export class PythonPriceEngineExecutor implements PriceEngineExecutor {
  constructor(
    private readonly endpoint: URL,
    private readonly token: string,
  ) {}

  async analyze(input: PriceEngineInput) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`Price Engine request failed with status ${response.status}.`);
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("Price Engine response exceeds the allowed size.");
    }
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("Price Engine response exceeds the allowed size.");
    }
    return parsePriceEngineOutput(JSON.parse(body) as unknown);
  }
}

export function createPythonPriceEngineExecutor() {
  const endpoint = process.env.PRICE_ENGINE_URL?.trim();
  const token = process.env.PRICE_ENGINE_TOKEN?.trim();
  if (!endpoint || !token) {
    throw new Error("PRICE_ENGINE_URL and PRICE_ENGINE_TOKEN are required for the Python transport.");
  }
  return new PythonPriceEngineExecutor(validatedEngineUrl(endpoint), token);
}
