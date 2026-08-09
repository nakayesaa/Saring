import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaNames = [
  "ingestion-job-claim-response",
  "ingestion-progress-event",
  "ingestion-artifact-prepare",
  "ingestion-result-callback",
  "parser-result",
  "canonical-analysis-snapshot",
];
const fixture = (name) => json(`fixtures/ingestion-transport/${name}.json`);
const schemaId = (name) => {
  const [base, fragment] = name.split("#", 2);
  return `https://saring.local/contracts/v1/${base}.schema.json${fragment ? `#${fragment}` : ""}`;
};

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: true, strictRequired: false }));
for (const name of schemaNames) {
  ajv.addSchema(await json(`contracts/v1/${name}.schema.json`));
}

const cases = [
  ["ingestion-job-claim-response", "positive-claim-response", true],
  ["ingestion-job-claim-response", "positive-production-claim-response", true],
  ["ingestion-job-claim-response", "invalid-claim-response", false],
  ["ingestion-progress-event", "positive-progress-event", true],
  ["ingestion-progress-event", "invalid-progress-event", false],
  ["ingestion-progress-event#/$defs/ack", "positive-progress-ack", true],
  ["ingestion-artifact-prepare", "positive-artifact-prepare", true],
  ["ingestion-artifact-prepare", "invalid-artifact-prepare", false],
  ["ingestion-artifact-prepare#/$defs/response", "positive-artifact-prepare-response", true],
  ["ingestion-result-callback", "positive-result-callback", true],
  ["ingestion-result-callback", "invalid-result-callback", false],
  ["ingestion-result-callback#/$defs/ack", "positive-result-ack", true],
];

for (const [schema, fixtureName, expected] of cases) {
  const validate = ajv.getSchema(schemaId(schema));
  if (!validate) throw new Error(`Schema not registered: ${schema}`);
  const valid = validate(await fixture(fixtureName));
  if (valid !== expected) {
    throw new Error(`${fixtureName} expected valid=${expected}: ${ajv.errorsText(validate.errors)}`);
  }
}

console.log(`Validated ${schemaNames.length} ingestion transport schemas and ${cases.length} fixtures.`);
