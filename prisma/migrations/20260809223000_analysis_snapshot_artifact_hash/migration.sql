-- Freeze the exact canonical-snapshot artifact bytes separately from the
-- semantic canonical snapshot hash. Legacy analysis rows remain nullable and
-- are intentionally ineligible for the v2 worker claim path.
ALTER TABLE "AnalysisJob"
  ADD COLUMN "canonicalSnapshotArtifactHash" TEXT;
