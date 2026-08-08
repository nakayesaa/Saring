import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const contractFiles = [
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
if (!validateCanonical || !validateInput || !validateOutput) throw new Error("Required schemas were not registered.");

assertValid(validateCanonical, canonical, "golden canonical package");
assertValid(validateInput, input, "golden Price Engine input");
assertValid(validateOutput, output, "golden Price Engine output");
assertValid(validateOutput, abstained, "abstained Price Engine output");
if (validateInput(invalid)) throw new Error("invalid Price Engine fixture was unexpectedly accepted");

const canonicalHash = createHash("sha256").update(stableJson(canonical)).digest("hex");
if (canonicalHash !== input.canonical_input_hash) {
  throw new Error("golden input does not reference the golden canonical package hash");
}

console.log(`Validated ${schemas.length} schemas and 5 Price Engine fixtures.`);
