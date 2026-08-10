# Live analysis UI integration log — 2026-08-10

## Added

- Dynamic Evidence Brief generated from the latest persisted analysis run.
- Actual database-backed package listing and review queue.
- Package-scoped Price, Document, and Graph result navigation.
- Graph network visualization sourced only from persisted Graph Engine findings.
- Reviewer-oriented Indonesian presentation for engine summaries, findings, evidence, and alternative explanations.
- Explicit Price calculation context: unit price, Q50, Q90, quantity, and total difference requiring verification.

## Removed or disabled

- Golden-case fallback from Findings, Price, Graph, Processing, Readiness, and Evidence Brief routes.
- Placeholder workspace metrics and fixture rows that could be mistaken for live analysis.
- Global fixture views for Documents, Vendors, and Relationship Graph; these pages now clearly direct users to package-scoped live evidence until aggregate repositories exist.

## Interpretation safeguards

- `Score` is presented as pattern strength.
- `Confidence` is presented as evidence sufficiency and remains visible.
- Price exposure is described as a review calculation, not state loss.
- Repeated co-bidding is described as a review signal, not proof of collusion.
- Synthetic inputs remain explicitly disclosed.

## Verification performed

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Full persisted workflow observed with 13 findings, 46 source locators, and no abstention for the synthetic benchmark package.
