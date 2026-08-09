import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  ANALYSIS_PIPELINE_VERSION,
  CANONICAL_ANALYSIS_INPUT_CONTRACT,
  ENGINE_RESULT_CONTRACT,
} from "@/lib/analysis/contracts";
import {
  ANALYSIS_CLAIM_CONTRACT,
  validateAnalysisClaimResponse,
} from "@/lib/analysis/worker-contracts";
import { getPrismaClient } from "@/lib/db/client";
import { createLease, issueLeaseToken } from "@/lib/intake/worker-lease";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const SNAPSHOT_URL_TTL_SECONDS = 15 * 60;

function storageObjectKey(location: string) {
  const parsed = new URL(location);
  if (parsed.protocol !== "supabase:" || parsed.hostname !== BUCKET) {
    throw new Error("Unsupported canonical snapshot location.");
  }
  return parsed.pathname.replace(/^\//, "");
}

export async function claimAnalysisJob(workerId: string) {
  const now = new Date();
  const lease = createLease(workerId, now);
  const leaseToken = issueLeaseToken();
  const claimed = await getPrismaClient().$transaction(async (transaction) => {
    const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "AnalysisJob"
      WHERE "availableAt" <= NOW()
        AND "attempt" < "maxAttempts"
        AND "pipelineVersion" = ${ANALYSIS_PIPELINE_VERSION}
        AND "inputContractVersion" = ${CANONICAL_ANALYSIS_INPUT_CONTRACT}
        AND "outputContractVersion" = ${ENGINE_RESULT_CONTRACT}
        AND "canonicalSnapshotArtifactHash" IS NOT NULL
        AND (
          "status" = 'QUEUED'
          OR (
            "status" IN ('CLAIMED', 'RUNNING')
            AND ("lease"->>'expires_at')::timestamptz < NOW()
          )
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const candidate = candidates[0];
    if (!candidate) return null;
    return transaction.analysisJob.update({
      where: { id: candidate.id },
      data: {
        status: "CLAIMED",
        stage: "VALIDATING_SNAPSHOT",
        attempt: { increment: 1 },
        lease,
        leaseTokenHash: leaseToken.hash,
        resultCallbackId: null,
        startedAt: now,
        completedAt: null,
        error: Prisma.JsonNull,
      },
      include: {
        package: { select: { sourceId: true, analysisCutoffAt: true } },
      },
    });
  });
  if (!claimed) return null;

  const objectKey = storageObjectKey(claimed.canonicalSnapshotLocation);
  const artifact = await getPrismaClient().ingestionArtifact.findFirst({
    where: {
      objectKey,
      kind: "CANONICAL_SNAPSHOT",
      sha256: claimed.canonicalSnapshotArtifactHash!,
      schemaVersion: CANONICAL_ANALYSIS_INPUT_CONTRACT,
      status: "VERIFIED",
      job: {
        packageId: claimed.packageId,
        status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
      },
    },
  });
  const { data, error } = artifact
    ? await createSupabaseAdminClient().storage.from(BUCKET).createSignedUrl(objectKey, SNAPSHOT_URL_TTL_SECONDS)
    : { data: null, error: new Error("Snapshot artifact is not verified.") };
  if (error || !data || !artifact) {
    await getPrismaClient().analysisJob.updateMany({
      where: { id: claimed.id, status: "CLAIMED", leaseTokenHash: leaseToken.hash },
      data: {
        status: "QUEUED",
        stage: "QUEUED",
        attempt: { decrement: 1 },
        lease: Prisma.DbNull,
        leaseTokenHash: null,
        startedAt: null,
      },
    });
    throw new Error("Unable to sign the canonical analysis snapshot.");
  }

  return validateAnalysisClaimResponse({
    schema_version: ANALYSIS_CLAIM_CONTRACT,
    job: {
      job_id: claimed.id,
      run_id: claimed.runId,
      organization_id: claimed.organizationId,
      package_id: claimed.package.sourceId,
      attempt: claimed.attempt,
      max_attempts: claimed.maxAttempts,
      next_progress_sequence: claimed.lastProgressSequence + 1,
      requested_engines: claimed.requestedEngines,
      analysis_cutoff_at: claimed.package.analysisCutoffAt.toISOString(),
      canonical_snapshot_hash: claimed.canonicalSnapshotHash.toLowerCase(),
      input_contract_version: claimed.inputContractVersion,
      output_contract_version: claimed.outputContractVersion,
      pipeline_version: claimed.pipelineVersion,
      claimed_at: lease.claimed_at,
      lease_expires_at: lease.expires_at,
    },
    lease_token: leaseToken.token,
    snapshot: {
      download_url: data.signedUrl,
      expires_at: new Date(now.getTime() + SNAPSHOT_URL_TTL_SECONDS * 1000).toISOString(),
      sha256: artifact.sha256.toLowerCase(),
      size_bytes: Number(artifact.byteSize),
      schema_version: CANONICAL_ANALYSIS_INPUT_CONTRACT,
      media_type: "application/json",
    },
    expected_artifacts: claimed.requestedEngines.map((engine) => ({
      kind: "ENGINE_RESULT" as const,
      engine,
      schema_version: ENGINE_RESULT_CONTRACT,
      media_type: "application/json" as const,
    })),
  });
}
