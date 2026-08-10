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
