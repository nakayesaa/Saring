# SARING v2 analysis contracts

Status: **frozen for the production analysis-worker boundary**.

The normative files are `analysis-job.schema.json` and
`engine-result.schema.json`. Version 2 does not mutate the legacy v1 files.

## Locked flow

```text
Next.js AnalysisJob
  -> Python claims a leased job
  -> Python downloads and verifies the canonical snapshot JSON
  -> Python runs only the requested engines
  -> Python prepares and uploads one EngineResult v2 per engine
  -> Python submits artifact references and summary
  -> Next.js verifies artifacts, persists results/findings, then commits terminal status
```

## Cross-record invariants

1. Job input is `saring-canonical-analysis-snapshot-1.0.0`; output is
   `saring-engine-result-2.0.0`.
2. Every result matches job `run_id`, package, analysis cutoff, requested engine,
   and lowercase canonical snapshot SHA-256.
3. Claim response v2 separates two identities: `snapshot.sha256` hashes the
   exact downloaded bytes, while `job.canonical_snapshot_hash` hashes canonical
   JSON semantics. They are expected to differ. Engine
   `input_snapshot_hash` uses the semantic hash.
4. `SCORED` and `LOW_CONFIDENCE` require score and confidence. A valid scored
   no-alert result may contain zero findings; every finding that does exist must
   reference at least one locator contained in the same result.
5. `ABSTAINED` and `NOT_APPLICABLE` contain no findings, locators, or score and
   require an explicit reason.
6. Results are persisted once per job and engine. A byte-different replay is a
   conflict, not an overwrite.
7. Findings are decision support, not fraud verdicts. Alternative explanations
   and evidence locators remain visible for human review.

Unknown major versions fail closed.
