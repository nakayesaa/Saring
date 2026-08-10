import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemas = [
  ["v1", "evidence-locator"],
  ["v2", "engine-result"],
  ["v2", "analysis-job"],
  ["v2", "analysis-job-claim-response"],
  ["v1", "analysis-worker-progress-event"],
  ["v1", "analysis-artifact-prepare"],
  ["v1", "analysis-result-callback"],
];
const fixture = (name) => json(`fixtures/analysis-transport/${name}.json`);

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const ajv = addFormats(new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: true, strictRequired: false }));
for (const [version, name] of schemas) {
  ajv.addSchema(await json(`contracts/${version}/${name}.schema.json`));
}

const schemaId = (name, fragment = "") =>
  `https://saring.local/contracts/${name === "analysis-job-claim-response" ? "v2" : "v1"}/${name}.schema.json${fragment}`;
const cases = [
  ["analysis-job-claim-response", "", "positive-claim-response", true],
  ["analysis-job-claim-response", "", "positive-claim-with-auxiliary", true],
  ["analysis-job-claim-response", "", "invalid-claim-response", false],
  ["analysis-worker-progress-event", "", "positive-progress-event", true],
  ["analysis-worker-progress-event", "", "invalid-progress-event", false],
  ["analysis-worker-progress-event", "", "invalid-progress-engine-stage", false],
  ["analysis-worker-progress-event", "#/$defs/ack", "positive-progress-ack", true],
  ["analysis-artifact-prepare", "", "positive-artifact-prepare", true],
  ["analysis-artifact-prepare", "", "invalid-artifact-prepare", false],
  ["analysis-artifact-prepare", "#/$defs/response", "positive-artifact-prepare-response", true],
  ["analysis-result-callback", "", "positive-result-callback", true],
  ["analysis-result-callback", "", "invalid-result-callback", false],
  ["analysis-result-callback", "#/$defs/ack", "positive-result-ack", true],
];

for (const [schema, fragment, fixtureName, expected] of cases) {
  const validate = ajv.getSchema(schemaId(schema, fragment));
  if (!validate) throw new Error(`Schema not registered: ${schema}${fragment}`);
  const valid = validate(await fixture(fixtureName));
  if (valid !== expected) {
    throw new Error(`${fixtureName} expected valid=${expected}: ${ajv.errorsText(validate.errors)}`);
  }
}

const validateEngineResult = ajv.getSchema("https://saring.local/contracts/v2/engine-result.schema.json");
if (!validateEngineResult) throw new Error("Engine result v2 schema is not registered.");
if (!validateEngineResult(await fixture("positive-document-engine-result"))) {
  throw new Error(`positive-document-engine-result is invalid: ${ajv.errorsText(validateEngineResult.errors)}`);
}

const claim = await fixture("positive-claim-response");
const engineResult = await fixture("positive-document-engine-result");
if (claim.job.canonical_snapshot_hash === claim.snapshot.sha256) {
  throw new Error("Claim fixture must distinguish semantic and raw artifact hashes.");
}
if (engineResult.input_snapshot_hash !== claim.job.canonical_snapshot_hash) {
  throw new Error("Engine result must use the semantic canonical snapshot hash.");
}
const resultBytes = await readFile(path.join(root, "fixtures/analysis-transport/positive-document-engine-result.json"));
const resultHash = createHash("sha256").update(resultBytes).digest("hex");
const prepared = await fixture("positive-artifact-prepare");
if (prepared.artifacts[0].sha256 !== resultHash || prepared.artifacts[0].size_bytes !== resultBytes.byteLength) {
  throw new Error("Prepared artifact identity must match the exact engine-result fixture bytes.");
}

console.log(`Validated ${schemas.length} analysis schemas and ${cases.length + 1} transport fixtures.`);
