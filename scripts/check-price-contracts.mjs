import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const contractFiles = [
  "contracts/v1/package-bundle-manifest.schema.json",
  "contracts/v1/ingestion-job.schema.json",
  "contracts/v1/evidence-locator.schema.json",
  "contracts/v1/engine-result.schema.json",
  "contracts/v1/canonical-package.schema.json",
  "contracts/v1/price-observation.schema.json",
  "contracts/v1/price-training-manifest.schema.json",
  "contracts/v1/price-model-artifact.schema.json",
  "contracts/v1/price-engine-input.schema.json",
  "contracts/v1/price-engine-detail.schema.json",
  "contracts/v1/price-engine-output.schema.json",
  "contracts/v1/price-evidence-response.schema.json",
];

async function json(file) {
  return JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertValid(validate, value, label) {
  if (!validate(value)) {
    throw new Error(`${label} is invalid:\n${JSON.stringify(validate.errors, null, 2)}`);
  }
}

const schemas = await Promise.all(contractFiles.map(json));
const ajv = addFormats(new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true, strictRequired: false }));
schemas.forEach((schema) => ajv.addSchema(schema));
schemas.forEach((schema) => {
  if (!ajv.getSchema(schema.$id)) throw new Error(`Schema did not compile: ${schema.$id}`);
});

const canonical = await json("fixtures/price-engine/golden-canonical-package.json");
const input = await json("fixtures/price-engine/golden-input.json");
const output = await json("fixtures/price-engine/golden-output.json");
const abstained = await json("fixtures/price-engine/abstained-output.json");
const invalid = await json("fixtures/price-engine/invalid-input.json");

const validateCanonical = ajv.getSchema("https://saring.local/contracts/v1/canonical-package.schema.json");
const validateInput = ajv.getSchema("https://saring.local/contracts/v1/price-engine-input.schema.json");
const validateOutput = ajv.getSchema("https://saring.local/contracts/v1/price-engine-output.schema.json");
const validateBundleManifest = ajv.getSchema("https://saring.local/contracts/v1/package-bundle-manifest.schema.json");
const validateIngestionJob = ajv.getSchema("https://saring.local/contracts/v1/ingestion-job.schema.json");
if (!validateCanonical || !validateInput || !validateOutput || !validateBundleManifest || !validateIngestionJob) {
  throw new Error("Required schemas were not registered.");
}

const exampleHash = "a".repeat(64);
assertValid(validateBundleManifest, {
  bundle_id: "BUNDLE-001",
  tender_source_id: "PACKAGE-001",
  created_at: "2026-08-09T12:00:00+07:00",
  analysis_cutoff_at: "2026-08-08T18:00:00+07:00",
  provided_by_role: "Authorized reviewer",
  legal_basis_tag: "AUTHORIZED_PROCUREMENT",
  participant_count: 1,
  bundle_mode: "LIVE_AUTHORIZED",
  confidentiality_class: "RESTRICTED",
  expected_files: [{ relative_path: "package_PACKAGE-001/package.json", size_bytes: 42, sha256: exampleHash }],
}, "package bundle manifest");
assertValid(validateIngestionJob, {
  schema_version: "saring-ingestion-job-1.0.0",
  job_id: "JOB-001",
  run_id: "RUN-001",
  organization_id: "ORG-001",
  package_id: "PACKAGE-001",
  job_kind: "INGESTION",
  status: "QUEUED",
  stage: "QUEUED",
  input_bundle_hash: exampleHash,
  input_bundle_location: "supabase://evidence/org/quarantine/bundle.zip",
  input_contract_version: "saring-package-bundle-manifest-1.0.0",
  output_contract_version: "saring-canonical-package-1.0.0",
  requested_parser_version: "saring-parser-1.0.0",
  idempotency_key: "idempotency-key-001",
  attempt: 0,
  max_attempts: 3,
  lease: null,
  error: null,
  created_at: "2026-08-09T12:00:00+07:00",
  available_at: "2026-08-09T12:00:00+07:00",
  started_at: null,
  completed_at: null,
}, "ingestion job");

assertValid(validateCanonical, canonical, "golden canonical package");
assertValid(validateInput, input, "golden Price Engine input");
assertValid(validateOutput, output, "golden Price Engine output");
assertValid(validateOutput, abstained, "abstained Price Engine output");
if (validateInput(invalid)) throw new Error("invalid Price Engine fixture was unexpectedly accepted");

const canonicalHash = createHash("sha256").update(stableJson(canonical)).digest("hex");
if (canonicalHash !== input.canonical_input_hash) {
  throw new Error("golden input does not reference the golden canonical package hash");
}

console.log(`Validated ${schemas.length} schemas, 2 ingestion contracts, and 5 Price Engine fixtures.`);
