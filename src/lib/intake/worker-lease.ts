import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";

export const LEASE_TTL_MS = 10 * 60 * 1000;
export const RESULT_VERIFICATION_LEASE_MS = 30 * 60 * 1000;

type Lease = {
  worker_id: string;
  claimed_at: string;
  heartbeat_at: string;
  expires_at: string;
};

type LeasedJob = {
  id: string;
  runId: string;
  status: string;
  lease: unknown;
  leaseTokenHash: string | null;
};

export type WorkerMutationIdentity = {
  job_id: string;
  run_id: string;
  worker_id: string;
  lease_token: string;
};

export function issueLeaseToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashLeaseToken(token) };
}

export function hashLeaseToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createLease(workerId: string, now: Date, ttlMs = LEASE_TTL_MS): Lease {
  const timestamp = now.toISOString();
  return {
    worker_id: workerId,
    claimed_at: timestamp,
    heartbeat_at: timestamp,
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

export function renewLease(job: LeasedJob, now: Date, ttlMs = LEASE_TTL_MS): Lease {
  const lease = readLease(job.lease);
  return {
    ...lease,
    heartbeat_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
  };
}

export function assertActiveLease(
  job: LeasedJob,
  identity: WorkerMutationIdentity,
  now: Date,
  options: { permitExpired?: boolean; permittedStatuses?: string[] } = {},
) {
  if (job.id !== identity.job_id || job.runId !== identity.run_id) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Worker job identity does not match.", 409);
  }
  if (!job.leaseTokenHash || !matchesLeaseToken(job.leaseTokenHash, identity.lease_token)) {
    throw new DomainError("STALE_LEASE_TOKEN", "The worker lease is stale or invalid.", 409);
  }
  const lease = readLease(job.lease);
  if (lease.worker_id !== identity.worker_id) {
    throw new DomainError("LEASE_WORKER_MISMATCH", "The job is leased by a different worker.", 409);
  }
  if (!options.permitExpired && new Date(lease.expires_at).getTime() <= now.getTime()) {
    throw new DomainError("LEASE_EXPIRED", "The worker lease has expired and must be reclaimed.", 409);
  }
  if (!(options.permittedStatuses ?? ["CLAIMED", "RUNNING"]).includes(job.status)) {
    throw new DomainError("JOB_NOT_ACTIVE", "The worker job is not active.", 409);
  }
  return lease;
}

export async function lockIngestionJob(transaction: Prisma.TransactionClient, jobId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "IngestionJob" WHERE id = ${jobId}::uuid FOR UPDATE
  `;
  if (!rows[0]) throw new DomainError("INGESTION_JOB_NOT_FOUND", "Ingestion job not found.", 404);
  const job = await transaction.ingestionJob.findUnique({
    where: { id: jobId },
    include: { package: { select: { sourceId: true } } },
  });
  if (!job) throw new DomainError("INGESTION_JOB_NOT_FOUND", "Ingestion job not found.", 404);
  return job;
}

export function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(sortJson(value))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

function matchesLeaseToken(expectedHash: string, token: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const observed = Buffer.from(hashLeaseToken(token), "hex");
  return expected.length === observed.length && timingSafeEqual(expected, observed);
}

function readLease(value: unknown): Lease {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("LEASE_STATE_INVALID", "The persisted worker lease is invalid.", 409);
  }
  const lease = value as Partial<Lease>;
  if (
    typeof lease.worker_id !== "string" ||
    typeof lease.claimed_at !== "string" ||
    typeof lease.heartbeat_at !== "string" ||
    typeof lease.expires_at !== "string" ||
    !Number.isFinite(new Date(lease.expires_at).getTime())
  ) {
    throw new DomainError("LEASE_STATE_INVALID", "The persisted worker lease is invalid.", 409);
  }
  return lease as Lease;
}
