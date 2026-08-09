# Analysis Worker handoff

Source of truth: `saring-web/contracts`. The Python repository consumes exact
copies and must not independently change the schemas.

## HTTP boundary

All requests use `Authorization: Bearer <ANALYSIS_CALLBACK_TOKEN>` and JSON.

| Action | Endpoint | Contract |
|---|---|---|
| Claim | `POST /api/worker/analysis-jobs/claim` | request `{ "worker_id": "..." }`; response `saring-analysis-job-claim-response-2.0.0`; `204` means no work |
| Progress/heartbeat | `POST /api/worker/analysis-jobs/{job_id}/progress` | `saring-analysis-worker-progress-event-1.0.0` |
| Prepare result uploads | `POST /api/worker/analysis-jobs/{job_id}/artifacts/prepare` | `saring-analysis-artifact-prepare-1.0.0` |
| Terminal result | `POST /api/worker/analysis-jobs/{job_id}/results` | `saring-analysis-result-callback-1.0.0` |

## Required worker flow

1. Claim one job and keep the raw lease token in memory only.
2. Stream-download the signed canonical snapshot; verify the exact bytes against
   `snapshot.size_bytes` and raw artifact `snapshot.sha256` before JSON parsing.
3. Validate `saring-canonical-analysis-snapshot-1.0.0`, compute its canonical
   JSON semantic hash, and compare that value with
   `job.canonical_snapshot_hash`. Do not download or reparse the original ZIP.
4. Run exactly `requested_engines`. The current web production request contains
   `DOCUMENT`; Price and Graph will use the same transport when their workers
   are ready.
5. Send ordered progress/heartbeat events beginning at
   `next_progress_sequence`. Use the engine-specific stage declared in schema.
6. Serialize one `saring-engine-result-2.0.0` JSON file per requested engine;
   `input_snapshot_hash` is the semantic `job.canonical_snapshot_hash`, never
   the raw artifact hash.
   Compute hash and byte size from the exact bytes that will be uploaded.
7. Prepare artifacts, upload to the server-issued signed targets, then submit a
   terminal callback referencing those exact artifacts.
8. Treat the terminal callback acknowledgement as completion. Progress alone
   never completes a job.

## Retry and security rules

- Reuse the same event/request/callback ID only when retrying byte-identical
  content. A changed replay is a conflict.
- Accepted heartbeat/progress extends the lease. Stop on stale lease, reclaimed
  token, identity mismatch, or artifact verification failure.
- Web and Storage clients must be separate so the callback bearer token is never
  sent to a signed Storage URL.
- Python receives no Supabase or database credentials. Never log lease tokens,
  signed URLs, restricted source content, or raw callback authorization.
- `FAILED` contains no result artifacts. Use a stable sanitized error code and
  an explicit `retryable` flag.

## Contract fixtures

`contracts/fixtures/analysis-transport` contains positive and deliberately
invalid claim/progress/prepare/result payloads plus a complete Document Engine
v2 output. Its SHA-256 and byte size match the positive prepare and callback
fixtures. Contract tests must validate both positive and negative cases.
