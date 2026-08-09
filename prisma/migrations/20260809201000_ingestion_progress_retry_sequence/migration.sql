-- Progress sequence is scoped to the active claim attempt. The job row is
-- locked while accepting progress and lastProgressSequence is reset on claim,
-- so database-wide uniqueness across all attempts incorrectly rejects a valid
-- retry beginning at sequence zero.
DROP INDEX "IngestionProgressEvent_jobId_sequence_key";

CREATE INDEX "IngestionProgressEvent_jobId_sequence_idx"
  ON "IngestionProgressEvent"("jobId", "sequence");
