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

## Versioning

The frozen constants are:

```text
saring-canonical-package-1.0.0
saring-evidence-locator-1.0.0
saring-engine-result-1.0.0
saring-evidence-brief-1.0.0
saring-analysis-job-1.0.0
saring-analysis-progress-event-1.0.0
```

Unknown major versions fail closed. Breaking changes require a new directory
and migration path; v1 files are not edited in place after producers and
consumers depend on them.
