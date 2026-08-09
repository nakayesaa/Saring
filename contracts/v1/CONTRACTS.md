# SARING v1 contract specification

Status: **frozen for the first end-to-end vertical slice**.

The JSON schemas in this directory are normative. This document records the
meaning and cross-record invariants that JSON Schema cannot enforce alone.

## Pipeline ownership

| Boundary | Producer | Consumer |
|---|---|---|
| Canonical package | Python extraction/normalization worker after reviewer corrections | Price, document, graph, technical, completeness, and data-quality engines |
| Evidence locator | Parser or analytical engine | Findings UI, document viewer, graph viewer, and Evidence Brief |
| Engine result | One Python analytical module | Fusion, persistence, Processing UI, and Package Overview |
| Evidence Brief | Deterministic fusion/renderer; optionally constrained LLM | Reviewer workflow and audit trail |
| Analysis job | Next.js orchestration layer | Python analysis worker |
| Progress event | Python analysis worker | PostgreSQL/Supabase Realtime and Processing UI |
| Package bundle manifest | Authorized uploader or benchmark generator | Next.js intake and Python ingestion worker |
| Ingestion job | Next.js orchestration layer | Python parser/OCR worker |
| Ingestion claim response | Next.js orchestration layer | Python parser/OCR worker |
| Ingestion progress event | Python parser/OCR worker | Next.js lease and progress handler |
| Ingestion artifact prepare | Python worker request; Next.js response | Next.js artifact issuer; Python uploader |
| Ingestion result callback | Python parser/OCR worker | Next.js validator and terminal commit |
| Analysis claim response | Next.js orchestration layer | Python analysis worker |
| Analysis worker progress | Python analysis worker | Next.js lease and progress handler |
| Analysis artifact prepare | Python worker request; Next.js response | Next.js artifact issuer; Python uploader |
| Analysis result callback | Python analysis worker | Next.js validator, persistence, and terminal commit |

## Canonical package invariants

1. `package.analysis_cutoff_at` is the latest timestamp an analytical feature
   may use. Later records must be excluded, not silently rewritten.
2. `package.participant_count` must equal the number of reconciled participants.
3. Every participant `document_id` must resolve to a document in the same
   package and, when vendor-scoped, to the same vendor.
4. Every offered `item_id` must resolve to a package item.
5. Every historical event used by the graph must occur no later than the
   analysis cutoff.
6. Raw hashes and object locations are immutable. Reviewer corrections create
   new normalized values with correction provenance.
7. Winner, award, evaluation outcome, scenario label, contract, and payment
   data must not enter a pre-award feature snapshot.
8. `bundle_mode=SYNTHETIC` must remain visible in provenance even if the primary
   review screen does not display a synthetic badge.

## Evidence locator invariants

1. `source_hash` identifies the exact immutable source version.
2. Page numbers are one-based.
3. A `DOCUMENT_REGION` bounding box uses `[x1, y1, x2, y2]` in the coordinate
   system recorded by the parser version.
4. A locator must be resolvable by an authorized reviewer without embedding a
   public or signed storage URL in the contract.
5. Excerpts are display aids; the immutable source is authoritative.

## Engine result invariants

1. One result represents one engine, package, run, cutoff, and input snapshot.
2. `SCORED` requires a numeric score, confidence, at least one finding, and at
   least one locator.
3. Every finding locator ID must resolve inside `evidence_locators`.
4. `ABSTAINED` contributes no positive evidence and requires a reason.
5. `LOW_CONFIDENCE` remains visible and must not be silently upgraded by fusion.
6. One weak module cannot independently produce the highest package priority.
7. Cross-module corroboration is valid only for the same package/vendor/item
   context.
8. A worker failure is a job state, not an analytical finding status.

## Evidence Brief invariants

1. A brief is versioned and is never silently overwritten.
2. Scores, confidences, module statuses, and abstentions remain module-specific.
3. Every finding reference resolves to a persisted engine result and finding.
4. Every published finding is backed by at least one source citation.
5. `review_priority` is a review ordering signal, never fraud probability.
6. The LLM may render allowlisted structured facts only. It may not add or
   change numbers, entities, relationships, scores, or citations.
7. Failed narrative factuality validation uses a deterministic fallback or is
   rejected.
8. Restricted raw PDFs, credentials, signatures, NIK/NPWP, and unrelated
   personal data are not sent to an external LLM.

## Analysis job invariants

1. The idempotency key identifies one package snapshot, pipeline version, and
   requested engine set; retries must not create duplicate runs or findings.
2. A worker claims a queued job atomically and maintains a lease/heartbeat.
3. Expired leases may be reclaimed only while `attempt < max_attempts`.
4. Canonical input is immutable and identified by its SHA-256 hash.
5. Terminal states record `completed_at`; failures contain a sanitized error.

## Progress event invariants

1. Events are append-only and ordered by `sequence` within one run.
2. Duplicate `event_id` values are ignored idempotently.
3. Percentage is derived from completed and total units; it is not separately
   authored by UI code.
4. `completed_units` cannot exceed `total_units`.
5. Run-level events use `engine=null`; engine lifecycle events name an engine.
6. UI copy may be derived from stable `stage`; `message` is diagnostic context,
   not the source of workflow logic.

## Ingestion transport invariants

1. The raw `lease_token` is returned only to the claiming worker. Persistence
   stores its cryptographic hash, and a reclaim creates a new token.
2. Every progress, artifact-prepare, and result mutation must match the active
   `job_id`, `run_id`, `worker_id`, and lease token. Stale mutations fail closed.
3. Progress `event_id` and artifact `request_id` are idempotency keys. Replaying
   progress does not duplicate state; replaying artifact preparation preserves
   artifact IDs/object keys while refreshing only its ephemeral upload credentials.
4. Accepted progress or heartbeat events extend the lease and return the new
   `lease_expires_at`. Progress never commits a terminal job state.
5. The server generates artifact IDs and object keys. Workers may upload only
   to signed targets issued for the active job and declared artifact hashes.
6. Successful ingestion requires exactly one `PARSER_RESULT` and one
   `CANONICAL_SNAPSHOT`. Next.js verifies existence, size, hash, media type, and
   schema before committing `COMPLETED` or `NEEDS_REVIEW`.
7. `FAILED` contains no artifacts or parser summary and carries a sanitized,
   explicitly retryable or non-retryable error.
8. `snapshot_file` in parser-result v1 remains a portable local basename. The
   result callback is the authoritative mapping to remote artifact identity.
9. Signed download and upload URLs are ephemeral credentials: do not persist,
   log, include in events, or expose to the browser.
10. `UPLOADING_ARTIFACTS` is the last progress stage. Only a verified result
    callback may commit a terminal status.
11. Runtime validation additionally enforces `completed_units <= total_units`,
    `attempt <= max_attempts`, summary count consistency, raw artifact hashes,
    and equality between parser-result and callback semantic snapshot hashes.
12. `input_contract_version` advertises the manifest actually present in the
    claimed ZIP: golden fixtures may use `saring-package-bundle-manifest-1.0.0`;
    production intake uses `saring-runtime-bundle-manifest-1.0.0`. Workers must
    reject a bundle whose discovered manifest does not match the advertised version.
13. Progress stages are monotonic within an attempt. A worker cannot move a job
    from canonicalization or artifact upload back to parsing.

## Analysis transport invariants

The original claim response v1 omitted the semantic snapshot hash and is
superseded by `saring-analysis-job-claim-response-2.0.0`. Production analysis
workers must not consume claim v1.

1. The authoritative production input is exactly one immutable
   `saring-canonical-analysis-snapshot-1.0.0` artifact. Analysis workers do not
   download or parse the original bundle again.
2. The claim advertises the exact requested engine set. The worker returns
   exactly one `saring-engine-result-2.0.0` artifact per requested engine.
3. Every worker mutation matches the active `job_id`, `run_id`, `worker_id`,
   and opaque lease token. Raw lease tokens and signed URLs are never persisted
   in progress payloads or logs.
4. Progress is monotonic and extends the lease. It cannot commit a terminal job
   state; `UPLOADING_RESULTS` is its final stage.
5. Next.js generates artifact IDs and object keys. Before persistence it checks
   object existence, byte size, SHA-256, media type, schema, requested engine,
   run, package, cutoff, and canonical snapshot hash.
6. Only a verified result callback commits `COMPLETED`, `NEEDS_REVIEW`, or
   `ABSTAINED`. `FAILED` carries no artifacts and only a sanitized error.
7. Callback retries are idempotent. Reusing an event, request, or callback ID
   with different content fails closed; an expired/reclaimed lease rejects stale
   mutations.
8. Result summary counts are derived from the uploaded results and must match
   the callback. A `LOW_CONFIDENCE` result yields `NEEDS_REVIEW`; all-abstained
   or not-applicable results yield `ABSTAINED`.

## Versioning

The frozen constants are:

```text
saring-canonical-package-1.0.0
saring-evidence-locator-1.0.0
saring-engine-result-1.0.0
saring-evidence-brief-1.0.0
saring-analysis-job-1.0.0
saring-analysis-progress-event-1.0.0
saring-ingestion-job-claim-response-1.0.0
saring-ingestion-progress-event-1.0.0
saring-ingestion-artifact-prepare-1.0.0
saring-ingestion-result-callback-1.0.0
saring-analysis-job-claim-response-1.0.0
saring-analysis-worker-progress-event-1.0.0
saring-analysis-artifact-prepare-1.0.0
saring-analysis-result-callback-1.0.0
```

Unknown major versions fail closed. Breaking changes require a new directory
and migration path; v1 files are not edited in place after producers and
consumers depend on them.
