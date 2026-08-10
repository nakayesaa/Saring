# SARING JSON contracts

These schemas are the machine-readable integration boundary between Next.js,
PostgreSQL, fixtures, and the Python analysis worker. Markdown explains the
contracts; the `*.schema.json` files define them.

## Frozen contracts

| Contract | Schema version | Purpose |
|---|---|---|
| Canonical package | `saring-canonical-package-1.0.0` | Immutable, cutoff-safe engine input |
| Evidence locator | `saring-evidence-locator-1.0.0` | Reopen the exact source behind a claim |
| Engine result | `saring-engine-result-1.0.0` | Structured output from one analytical module |
| Evidence Brief | `saring-evidence-brief-1.0.0` | Versioned reviewer-facing evidence package |
| Analysis job | `saring-analysis-job-1.0.0` | Idempotent work request claimed by the Python worker |
| Progress event | `saring-analysis-progress-event-1.0.0` | Ordered engine/run updates that drive the Processing UI |
| Package bundle manifest | `saring-package-bundle-manifest-1.0.0` | Immutable raw hybrid upload inventory and cutoff identity |
| Ingestion job | `saring-ingestion-job-1.0.0` | Idempotent parser/OCR work request claimed by the Python worker |
| Parser result | `saring-parser-result-1.0.0` | Per-document parser/OCR outcomes and semantic snapshot identity |
| Canonical analysis snapshot | `saring-canonical-analysis-snapshot-1.0.0` | Validated parser output consumed by analytical engines and readiness UI |
| Ingestion claim response | `saring-ingestion-job-claim-response-1.0.0` | Leased job, signed bundle download, and expected artifacts |
| Ingestion progress event | `saring-ingestion-progress-event-1.0.0` | Idempotent heartbeat/progress mutation that renews the active lease |
| Ingestion artifact prepare | `saring-ingestion-artifact-prepare-1.0.0` | Request and server-issued signed upload targets for parser artifacts |
| Ingestion result callback | `saring-ingestion-result-callback-1.0.0` | Terminal artifact references, parser summary, or sanitized failure |
| Price observation | `saring-price-observation-1.0.0` | Versioned historical price/comparator record |
| Price training manifest | `saring-price-training-manifest-1.0.0` | Immutable dataset identity, cutoff, hash, and split policy |
| Price model artifact | `saring-price-model-artifact-1.0.0` | Runtime-compatible model bundle manifest |
| Price Engine input | `saring-price-engine-input-1.0.0` | Canonical participant-item targets sent to Price Engine |
| Price Engine detail | `saring-price-engine-detail-1.0.0` | Auditable result for one participant-item quote |
| Price Engine output | `saring-price-engine-output-1.0.0` | Batch output returned by the Python boundary |
| Price Engine API request | `saring-price-engine-api-request-1.0.0` | Authenticated remote Price service request |
| Graph Engine API request | `saring-graph-engine-api-request-1.0.0` | Authenticated remote Graph service request |
| Price Evidence response | `saring-price-evidence-response-1.0.0` | Shared result plus Price details consumed by web/PDF |
| Analysis job v2 | `saring-analysis-job-2.0.0` | Immutable canonical-snapshot analysis request and worker lifecycle |
| Engine result v2 | `saring-engine-result-2.0.0` | Production output from one requested analysis engine |
| Analysis claim response v2 | `saring-analysis-job-claim-response-2.0.0` | Lease, semantic snapshot identity, signed raw artifact, and expected results |
| Analysis worker progress | `saring-analysis-worker-progress-event-1.0.0` | Lease-renewing worker heartbeat and progress events |
| Analysis artifact prepare | `saring-analysis-artifact-prepare-1.0.0` | Server-issued upload targets for engine result artifacts |
| Analysis result callback | `saring-analysis-result-callback-1.0.0` | Verified terminal artifact references, summary, or sanitized failure |

All schemas use JSON Schema Draft 2020-12 and reject undeclared properties.
Production IDs should be UUIDs. Stable namespaced fixture IDs are also accepted
so the current golden, negative-control, and abstention fixtures can cross the
same boundary as production records.

## Compatibility policy

- Adding an optional field is backward-compatible and requires a patch version.
- Adding a required field, removing/renaming a field, changing meaning, or
  narrowing an accepted value requires a new major contract version.
- Producers must emit `schema_version`; consumers must reject unknown major
  versions instead of guessing.
- Raw source files remain immutable. Corrections create versioned canonical
  records and preserve source hashes and reviewer provenance.
- Every scored finding must contain at least one evidence locator.
- `ABSTAINED` results must contain an `abstention_reason` and must not contain a
  positive score.

## Source decisions

The contracts implement the current decisions in:

- `docs/SARING_MASTER_CONTEXT.md`
- `SARING_MVP_Kesimpulan_Final.md`
- `docs/saring-knowledge/source-package/schemas/01_canonical_schema_dictionary.md`
- `docs/saring-knowledge/source-package/evidence/01_package_bundle_contract.md`
- `docs/saring-knowledge/source-package/evidence/03_evidence_brief_contract.md`

Python should validate with `jsonschema`/Pydantic at job boundaries. TypeScript
should generate or maintain matching runtime validators from these schemas;
TypeScript types alone are not sufficient validation.

Run `npm run contracts:check` to compile the schema graph and validate the
positive and deliberately invalid Price Engine, ingestion, and analysis
transport fixtures. The analysis fixture set also includes a complete,
hash-addressable Document Engine v2 output.
