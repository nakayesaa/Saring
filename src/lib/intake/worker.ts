import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT,
  INGESTION_CLAIM_CONTRACT,
  PARSER_RESULT_CONTRACT,
  validateClaimResponse,
} from "@/lib/intake/contracts";
import { getPrismaClient } from "@/lib/db/client";
import { createLease, issueLeaseToken } from "@/lib/intake/worker-lease";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const BUNDLE_URL_TTL_SECONDS = 15 * 60;

function storageObjectKey(location: string) {
  const parsed = new URL(location);
  if (parsed.protocol !== "supabase:" || parsed.hostname !== BUCKET) {
    throw new Error("Unsupported ingestion bundle location.");
  }
  return parsed.pathname.replace(/^\//, "");
}

export async function claimIngestionJob(workerId: string) {
  const now = new Date();
  const lease = createLease(workerId, now);
  const leaseToken = issueLeaseToken();
  const claimed = await getPrismaClient().$transaction(async (transaction) => {
    const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "IngestionJob"
      WHERE "availableAt" <= NOW()
        AND "attempt" < "maxAttempts"
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
    return transaction.ingestionJob.update({
      where: { id: candidate.id },
      data: {
        status: "CLAIMED",
        stage: "VALIDATING_BUNDLE",
        attempt: { increment: 1 },
        lease,
        leaseTokenHash: leaseToken.hash,
        lastProgressSequence: -1,
        resultCallbackId: null,
        startedAt: now,
        completedAt: null,
        error: Prisma.JsonNull,
      },
      include: {
        package: { select: { sourceId: true } },
        sourceDocument: {
          select: { mimeType: true, byteSize: true, originalFileName: true },
        },
      },
    });
  });
  if (!claimed) return null;

  const objectKey = storageObjectKey(claimed.inputBundleLocation);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(objectKey, BUNDLE_URL_TTL_SECONDS);
  if (error || !data) {
    await getPrismaClient().ingestionJob.updateMany({
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
    throw new Error("Unable to sign the ingestion bundle.");
  }

  return validateClaimResponse({
    schema_version: INGESTION_CLAIM_CONTRACT,
    job: {
      job_id: claimed.id,
      run_id: claimed.runId,
      organization_id: claimed.organizationId,
      package_id: claimed.package.sourceId,
      attempt: claimed.attempt,
      max_attempts: claimed.maxAttempts,
      requested_parser_version: claimed.requestedParserVersion,
      input_contract_version: claimed.inputContractVersion,
      claimed_at: lease.claimed_at,
      lease_expires_at: lease.expires_at,
    },
    lease_token: leaseToken.token,
    bundle: {
      download_url: data.signedUrl,
      expires_at: new Date(now.getTime() + BUNDLE_URL_TTL_SECONDS * 1000).toISOString(),
      sha256: claimed.inputBundleHash.toLowerCase(),
      size_bytes: Number(claimed.sourceDocument.byteSize),
      mime_type: "application/zip",
      original_file_name: claimed.sourceDocument.originalFileName,
    },
    expected_artifacts: [
      {
        kind: "PARSER_RESULT",
        schema_version: PARSER_RESULT_CONTRACT,
        media_type: "application/json",
      },
      {
        kind: "CANONICAL_SNAPSHOT",
        schema_version: CANONICAL_ANALYSIS_SNAPSHOT_CONTRACT,
        media_type: "application/json",
      },
    ],
    isolation: {
      evaluator_only_path_patterns: ["**/ground_truth/**", "**/evidence_brief/**"],
      non_runtime_path_patterns: ["**/official_anchor/**", "**/tools/**"],
      rule: "Partition these paths before parsing, feature generation, retrieval, or model execution.",
    },
  });
}
