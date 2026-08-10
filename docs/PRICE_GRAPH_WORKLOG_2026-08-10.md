# Price and Graph Engine Worklog — 2026-08-10

This log tracks unattended Price/Graph integration work. The user may override any
decision recorded here. No remote push or destructive database mutation is authorized.

## Starting point

- Local checkpoint: `7f0d565` (`Integrate production price and graph auxiliary inputs`).
- Merge checkpoint: `8fe0211` (merged `origin/main` commit `e392500`).
- Web verification: contracts, Prisma validation/client generation, ESLint, TypeScript,
  and production build passed.
- Python verification: Ruff passed for `src tests`; pytest passed 69/69 when given a
  workspace-local temporary directory.
- Supabase audit: two synthetic tender packages, zero persisted participation rows,
  zero graph nodes, and zero graph edges. Historical rows and price comparators currently
  live inside canonical snapshot JSON.

## Guardrails

- Synthetic inputs may verify functionality but not fraud accuracy.
- Results are review-priority evidence, not findings of fraud or collusion.
- LLM text, if added later, may explain deterministic evidence but must not invent edges.
- Do not push commits, delete data, or overwrite teammate changes without explicit approval.

## Activity log

### 1. Runtime audit — complete

- Goal: identify running services, latest analysis jobs, and a safe package for an
  end-to-end Price/Graph execution.
- Web health passed on `http://localhost:3000`; only one previous analysis job existed
  and it requested `DOCUMENT` only.
- Direct job submission returned HTTP 401 because `DEMO_BYPASS_AUTH` was `false` and
  no authenticated browser session was connected.
- Reversible local-demo decision: set `DEMO_BYPASS_AUTH=true` and restart only the
  verified Next.js process for this repository. Restore to `false` before deployment.
- A temporary local-demo identity mapping was used only to submit the job through the
  normal application service because the placeholder demo identity has no workspace
  membership. The source mapping was immediately restored; no membership was invented.
- Created analysis job `6d41e795-e8f7-4247-8bf9-e62c35732b9f` for source package
  `PKG-NLI-TEST-0001`, requesting `DOCUMENT`, `GRAPH`, and `PRICE`.

### 2. End-to-end analysis — complete

- Job `6d41e795-e8f7-4247-8bf9-e62c35732b9f` completed as `NEEDS_REVIEW`.
  - Document: `SCORED`, one finding.
  - Price: `LOW_CONFIDENCE`, one synthetic benchmark finding.
  - Graph: `ABSTAINED`; ten historical rows did not meet the reference-cohort gate.
- Job `87dbff6a-09e6-47ba-b9a2-6a38f241716a` tested the larger synthetic benchmark.
  - Document: `SCORED`, two findings.
  - Price: `LOW_CONFIDENCE`, ten synthetic benchmark findings.
  - Graph: `LOW_CONFIDENCE`, one `REPEATED_CO_BIDDING` finding for
    `SYN-V007` and `SYN-V011` (six co-bids versus threshold four; confidence 0.25).
- This demonstrates both intended graph branches: evidence-backed scoring when the
  cohort is sufficient and fail-closed abstention when it is not.
- Restored `DEMO_BYPASS_AUTH=false` after job submission.

### 3. Graph visualization — complete

- Added `GraphNetworkPanel`, derived exclusively from persisted Graph Engine findings.
- No finding means no edge is drawn; the panel shows the engine summary instead.
- Edge thickness represents engine score. The UI explicitly says it is not legal
  evidence strength or collusion probability.
- `npm run check` passed after the implementation.
- The optimized Next.js production build passed.
- Checkpoint commit message: `Visualize persisted graph engine findings`.

### Final local state

- Web returned to port 3000 with `DEMO_BYPASS_AUTH=false`.
- Branch is three commits ahead of `origin/main`; nothing was pushed.
- Database additions are limited to the two normal analysis jobs and their persisted
  progress, artifacts, EngineResults, and findings.

## Override points

- Stop before remote push: always.
- Stop before any destructive or bulk Supabase operation: always.
- Current implementation priority: end-to-end execution, then EngineResult-backed graph
  visualization.

### 4. Paper-aligned production baseline - complete

- Replaced production Price decisions with `saring-price-engine-2.0.0`: strictly
  comparable Indonesian cohorts, cutoff/provenance and commercial-basis gates, Tukey
  1.5-IQR plus a 0.5x/2x median-ratio guard, and explicit review-only wording.
- Replaced production Graph decisions with `saring-graph-engine-2.0.0`: controlled
  category/method/region opportunity sets, activity-normalized lift, Jaccard similarity,
  a one-sided binomial screen, and Benjamini-Hochberg FDR control.
- Disabled the worker's legacy synthetic Price/Graph fallback. Missing production
  auxiliary snapshots now yield `ABSTAINED`, not a demo-generated risk finding.
- Updated the Price and Graph rule specifications with active versus deferred rules and
  the paper-backed interpretation boundary. These engines identify review signals; they
  do not classify a vendor as fraudulent.
- Verification: Ruff passed; the complete Python suite passed 71/71 using a
  workspace-local pytest temporary directory.

### 5. Remote deployment paradigm - complete locally

- Added independent authenticated FastAPI services for Price and Graph, each exposing
  `/healthz` and contract-validated `POST /v1/analyze`.
- The analysis worker now calls configured `PRICE_ENGINE_URL` and `GRAPH_ENGINE_URL`
  using a separate bearer credential. Production worker code no longer imports or runs
  either analytical core directly.
- Added versioned API request schemas to both repositories and made each service reject
  an undeployed requested engine version.
- Added Hugging Face Docker Space templates for each engine: port 7860, UID 1000,
  pinned dependencies, distinct ASGI entrypoints, and a safe PowerShell exporter that
  creates self-contained Space repositories.
- Reserved `Authorization: Bearer <HF_SPACE_TOKEN>` for Hugging Face private/protected
  Space access and moved application authentication to `X-Saring-Engine-Token`, avoiding
  credential-header collision.
- Added the normative 2021-2026 paper registry. Older research notes are explicitly
  non-normative for v2.
- Verified both services simultaneously on ports 7861/7862 and obtained `SCORED`
  responses through the real HTTP client for Price and Graph. Ruff passed and the full
  Python suite passed 75/75.
- Docker CLI is unavailable on this machine, so no local Docker image-build claim is
  made. Both generated Hugging Face Space contexts passed structural verification.

### 6. Synthetic benchmark policy correction - complete

- Corrected an overly restrictive implementation decision: synthetic provenance no
  longer causes Price or Graph to abstain. Synthetic inputs are analyzed with the same
  paper-grounded rules and disclosed through `metrics.synthetic_input=true`.
- The restriction now applies only to external-validity claims: synthetic data cannot
  establish Indonesian precision, recall, prevalence, or a legal fraud conclusion.
- Added a deterministic canonical-snapshot adapter for synthetic uploaded bundles. It
  constructs versioned Price/observation and Graph opportunity inputs without reading
  evaluator labels, so auxiliary JSON does not need to be registered manually for the
  checked-in golden bundle.
- Added a second Graph pattern for high-coherence repeated co-bidding. It preserves the
  activity-normalized FDR screen while allowing a clearly disclosed high-coherence
  signal when frequent actors make independent-lift alone uninformative.
- Golden HTTP smoke result: Price `SCORED` with 9 findings; Graph `SCORED` with one
  `SYN-V007`/`SYN-V011` finding.
- Ruff passed and the complete Python suite passed 77/77.
# UI provenance cleanup (2026-08-10)

- Evidence Brief now projects the latest persisted analysis results for the requested package; the `AR-2026-001` golden brief is no longer reachable from the workspace route.
- Removed golden-result fallbacks from findings, Price, Graph, processing, and readiness routes. Missing/incomplete runs now remain unavailable instead of silently showing demo output.
- Packages and Review queue now query persisted workspace packages.
- Global Documents, Vendors & actors, and Relationship graph fixtures were disabled; these pages explicitly direct reviewers to package-scoped actual evidence until aggregate repositories are implemented.
- Verification: `npm run typecheck`, `npm run lint`, and `npm run build` passed.
