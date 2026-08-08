import "server-only";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import canonicalPackageSchema from "../../../contracts/v1/canonical-package.schema.json";
import analysisJobSchema from "../../../contracts/v1/analysis-job.schema.json";
import analysisProgressSchema from "../../../contracts/v1/analysis-progress-event.schema.json";
import engineResultSchema from "../../../contracts/v1/engine-result.schema.json";
import evidenceLocatorSchema from "../../../contracts/v1/evidence-locator.schema.json";
import priceDetailSchema from "../../../contracts/v1/price-engine-detail.schema.json";
import priceEvidenceSchema from "../../../contracts/v1/price-evidence-response.schema.json";
import priceInputSchema from "../../../contracts/v1/price-engine-input.schema.json";
import priceOutputSchema from "../../../contracts/v1/price-engine-output.schema.json";
import type {
  PriceEngineDetail,
  PriceEngineInput,
  PriceEngineOutput,
  PriceEvidenceResponse,
} from "@/lib/price-engine/contracts";
import type { AnalysisJobContract, GeneralEngineResult } from "@/lib/analysis/contracts";
import type { AnalysisProgressEvent } from "@/lib/analysis-progress";

const SCHEMA = {
  canonical: canonicalPackageSchema.$id,
  input: priceInputSchema.$id,
  detail: priceDetailSchema.$id,
  output: priceOutputSchema.$id,
  response: priceEvidenceSchema.$id,
  job: analysisJobSchema.$id,
  progress: analysisProgressSchema.$id,
  result: engineResultSchema.$id,
} as const;

const ajv = addFormats(
  new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true, strictRequired: false }),
);

for (const schema of [
  evidenceLocatorSchema,
  engineResultSchema,
  analysisJobSchema,
  analysisProgressSchema,
  canonicalPackageSchema,
  priceInputSchema,
  priceDetailSchema,
  priceOutputSchema,
  priceEvidenceSchema,
]) {
  ajv.addSchema(schema);
}

export class ContractValidationError extends Error {
  readonly code = "CONTRACT_VALIDATION_FAILED";

  constructor(
    readonly contract: string,
    readonly issues: string[],
  ) {
    super(`${contract} failed validation: ${issues.join("; ")}`);
    this.name = "ContractValidationError";
  }
}

function formatIssues(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 12).map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? error.keyword}`;
  });
}

function parse<T>(schemaId: string, value: unknown): T {
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new Error(`Schema is not registered: ${schemaId}`);
  if (!validate(value)) {
    throw new ContractValidationError(schemaId, formatIssues(validate.errors));
  }
  return value as T;
}

function closeEnough(actual: number, expected: number) {
  return Math.abs(actual - expected) <= Math.max(0.01, Math.abs(expected) * 1e-9);
}

function assertDetailMath(detail: PriceEngineDetail) {
  if (!detail.interval || !detail.assessment) return;
  const { q10, q50, q90 } = detail.interval;
  if (!(q10 <= q50 && q50 <= q90)) {
    throw new ContractValidationError(SCHEMA.detail, ["/interval must satisfy q10 <= q50 <= q90"]);
  }

  const unitDifference = Math.max(0, detail.quote.quoted_unit_price - q90);
  const deviation = unitDifference / q90;
  const exposure = unitDifference * detail.quote.quantity;
  const score = Math.min(1, deviation);
  const checks: Array<[string, number, number]> = [
    ["unit_difference_above_q90", detail.assessment.unit_difference_above_q90, unitDifference],
    ["relative_deviation_above_q90", detail.assessment.relative_deviation_above_q90, deviation],
    ["estimated_exposure_requiring_verification", detail.assessment.estimated_exposure_requiring_verification, exposure],
    ["review_priority_score", detail.assessment.review_priority_score, score],
  ];
  const issues = checks
    .filter(([, actual, expected]) => !closeEnough(actual, expected))
    .map(([field]) => `/assessment/${field} does not match the frozen formula`);
  if (issues.length) throw new ContractValidationError(SCHEMA.detail, issues);
}

export function parseCanonicalPackage<T>(value: unknown) {
  return parse<T>(SCHEMA.canonical, value);
}

export function parseAnalysisJob(value: unknown) {
  return parse<AnalysisJobContract>(SCHEMA.job, value);
}

export function parseAnalysisProgressEvent(value: unknown) {
  const event = parse<AnalysisProgressEvent>(SCHEMA.progress, value);
  if (
    event.completed_units !== null &&
    event.total_units !== null &&
    event.completed_units > event.total_units
  ) {
    throw new ContractValidationError(SCHEMA.progress, [
      "/completed_units cannot exceed /total_units",
    ]);
  }
  return event;
}

export function parseEngineResult(value: unknown) {
  const result = parse<GeneralEngineResult>(SCHEMA.result, value);
  const locatorIds = new Set(result.evidence_locators.map(({ locator_id }) => locator_id));
  const issues = result.findings.flatMap((finding) =>
    finding.evidence_locator_ids
      .filter((locatorId) => !locatorIds.has(locatorId))
      .map((locatorId) => `finding ${finding.finding_id} references unknown locator ${locatorId}`),
  );
  if (issues.length) throw new ContractValidationError(SCHEMA.result, issues);
  return result;
}

export function parsePriceEngineInput(value: unknown) {
  const input = parse<PriceEngineInput>(SCHEMA.input, value);
  const cutoff = Date.parse(input.analysis_cutoff);
  const ids = new Set<string>();
  const issues: string[] = [];
  input.targets.forEach((target, index) => {
    if (ids.has(target.target_id)) issues.push(`/targets/${index}/target_id must be unique`);
    ids.add(target.target_id);
    if (Date.parse(target.procurement_date) > cutoff) {
      issues.push(`/targets/${index}/procurement_date exceeds analysis_cutoff`);
    }
  });
  if (issues.length) throw new ContractValidationError(SCHEMA.input, issues);
  return input;
}

export function parsePriceEngineOutput(value: unknown) {
  const output = parse<PriceEngineOutput>(SCHEMA.output, value);
  const issues: string[] = [];
  for (const detail of output.details) {
    assertDetailMath(detail);
    if (detail.run_id !== output.run_id || detail.package_id !== output.package_id) {
      issues.push(`detail ${detail.detail_id} does not belong to the engine output`);
    }
  }
  if (issues.length) throw new ContractValidationError(SCHEMA.output, issues);
  return output;
}

export function parsePriceEvidenceResponse(value: unknown) {
  const response = parse<PriceEvidenceResponse>(SCHEMA.response, value);
  const result = response.engine_result;
  const locatorIds = new Set(result.evidence_locators.map(({ locator_id }) => locator_id));
  const issues: string[] = [];

  for (const finding of result.findings) {
    for (const locatorId of finding.evidence_locator_ids) {
      if (!locatorIds.has(locatorId)) issues.push(`finding ${finding.finding_id} references unknown locator ${locatorId}`);
    }
  }

  for (const detail of response.details) {
    assertDetailMath(detail);
    if (detail.run_id !== result.run_id || detail.package_id !== result.package_id) {
      issues.push(`detail ${detail.detail_id} does not belong to the engine result`);
    }
    if (detail.analysis_cutoff !== result.analysis_cutoff_at) {
      issues.push(`detail ${detail.detail_id} has a different analysis cutoff`);
    }
    for (const locatorId of detail.evidence_locator_ids) {
      if (!locatorIds.has(locatorId)) issues.push(`detail ${detail.detail_id} references unknown locator ${locatorId}`);
    }
  }

  if (issues.length) throw new ContractValidationError(SCHEMA.response, issues);
  return response;
}
