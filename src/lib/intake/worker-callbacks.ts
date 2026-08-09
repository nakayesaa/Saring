import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getPrismaClient } from "@/lib/db/client";
import { DomainError } from "@/lib/errors";
import {
  type ArtifactDescriptor,
  type IngestionResultCallback,
  INGESTION_ARTIFACT_PREPARE_CONTRACT,
  INGESTION_PROGRESS_CONTRACT,
  INGESTION_RESULT_CONTRACT,
  parseArtifactPrepare,
  parseCanonicalAnalysisSnapshot,
  parseIngestionProgress,
  parseIngestionResult,
  parseParserResult,
  validateArtifactPrepareResponse,
  validateProgressAck,
  validateResultAck,
} from "@/lib/intake/contracts";
import {
  assertActiveLease,
  hashPayload,
  lockIngestionJob,
  renewLease,
  RESULT_VERIFICATION_LEASE_MS,
} from "@/lib/intake/worker-lease";
import {
  downloadVerifiedJsonArtifact,
  issueArtifactUploadTargets,
  type PreparedArtifactRecord,
} from "@/lib/intake/worker-storage";

const TERMINAL_STATUSES = ["COMPLETED", "NEEDS_REVIEW", "FAILED"];
const STAGE_ORDER: Record<string, number> = {
  VALIDATING_BUNDLE: 0,
  PARSING: 1,
  PARSING_STRUCTURED: 1,
  OCR: 2,
  EXTRACTING: 2,
  PARSING_DOCUMENTS: 2,
  CANONICALIZING: 3,
  UPLOADING_ARTIFACTS: 4,
};

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function progressAck(eventId: string, leaseExpiresAt: string) {
  return validateProgressAck({
    schema_version: INGESTION_PROGRESS_CONTRACT,
    event_id: eventId,
    accepted: true,
    lease_expires_at: leaseExpiresAt,
  });
}

function resultAck(callbackId: string, status: IngestionResultCallback["status"]) {
  return validateResultAck({
    schema_version: INGESTION_RESULT_CONTRACT,
    callback_id: callbackId,
    accepted: true,
    status,
  });
}

export async function recordIngestionProgress(jobId: string, value: unknown) {
  const event = parseIngestionProgress(value);
  if (event.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }
  if (
    event.completed_units !== null &&
    event.total_units !== null &&
    event.completed_units > event.total_units
  ) {
    throw new DomainError("INVALID_PROGRESS_COUNT", "Completed units cannot exceed total units.", 422);
  }

  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockIngestionJob(transaction, jobId);
    assertActiveLease(job, event, now);
    const lease = renewLease(job, now);
    const { lease_token: _leaseToken, ...persistedEvent } = event;
    void _leaseToken;
    const payloadHash = hashPayload(persistedEvent);
    const duplicate = await transaction.ingestionProgressEvent.findUnique({
      where: { jobId_externalEventId: { jobId, externalEventId: event.event_id } },
    });
    if (duplicate) {
      if (duplicate.payloadHash !== payloadHash) {
        throw new DomainError("EVENT_ID_CONFLICT", "Progress event ID was reused with different content.", 409);
      }
      await transaction.ingestionJob.update({ where: { id: jobId }, data: { lease } });
      return progressAck(event.event_id, lease.expires_at);
    }
    if (event.sequence !== job.lastProgressSequence + 1) {
      throw new DomainError("PROGRESS_SEQUENCE_CONFLICT", "Progress events must arrive in sequence.", 409);
    }
    if ((STAGE_ORDER[event.stage] ?? -1) < (STAGE_ORDER[job.stage] ?? -1)) {
      throw new DomainError("PROGRESS_STAGE_REGRESSION", "Progress cannot move to an earlier stage.", 409);
    }

    await transaction.ingestionProgressEvent.create({
      data: {
        jobId,
        externalEventId: event.event_id,
        sequence: event.sequence,
        eventType: event.event_type,
        stage: event.stage,
        completedUnits: event.completed_units,
        totalUnits: event.total_units,
        unitLabel: event.unit_label,
        message: event.message,
        payloadHash,
        payload: jsonValue(persistedEvent),
        occurredAt: new Date(event.occurred_at),
      },
    });
    await transaction.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        stage: event.stage,
        lease,
        lastProgressSequence: event.sequence,
      },
    });
    return progressAck(event.event_id, lease.expires_at);
  });
}

function artifactFileName(kind: ArtifactDescriptor["kind"]) {
  return kind === "PARSER_RESULT" ? "parser-result.json" : "canonical-snapshot.json";
}

function artifactMatches(record: PreparedArtifactRecord, descriptor: ArtifactDescriptor) {
  return record.kind === descriptor.kind &&
    record.sha256 === descriptor.sha256 &&
    Number(record.byteSize) === descriptor.size_bytes &&
    record.schemaVersion === descriptor.schema_version &&
    record.mimeType === descriptor.media_type;
}

export async function prepareIngestionArtifacts(jobId: string, value: unknown) {
  const request = parseArtifactPrepare(value);
  if (request.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }

  const prepared = await getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockIngestionJob(transaction, jobId);
    assertActiveLease(job, request, now);
    const existing = await transaction.ingestionArtifact.findMany({
      where: { jobId, attempt: job.attempt },
      orderBy: { kind: "asc" },
    });
    let artifacts: PreparedArtifactRecord[];
    if (existing.length) {
      if (
        existing.length !== request.artifacts.length ||
        request.artifacts.some((descriptor) => {
          const artifact = existing.find((item) => item.kind === descriptor.kind);
          return !artifact || !artifactMatches(artifact, descriptor);
        })
      ) {
        throw new DomainError(
          "ARTIFACT_PREPARE_CONFLICT",
          "This attempt already declared a different artifact set.",
          409,
        );
      }
      artifacts = existing;
    } else {
      artifacts = [];
      for (const descriptor of request.artifacts) {
        const artifactId = randomUUID();
        artifacts.push(await transaction.ingestionArtifact.create({
          data: {
            id: artifactId,
            jobId,
            attempt: job.attempt,
            kind: descriptor.kind,
            objectKey: `${job.organizationId}/derived/${job.packageId}/ingestion/${job.id}/attempt-${job.attempt}/${artifactFileName(descriptor.kind)}`,
            sha256: descriptor.sha256,
            byteSize: BigInt(descriptor.size_bytes),
            schemaVersion: descriptor.schema_version,
            mimeType: descriptor.media_type,
            prepareRequestId: request.request_id,
          },
        }));
      }
    }
    const lease = renewLease(job, now);
    await transaction.ingestionJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", stage: "UPLOADING_ARTIFACTS", lease },
    });
    return { artifacts, leaseExpiresAt: lease.expires_at };
  });

  const uploadTargets = await issueArtifactUploadTargets(prepared.artifacts);
  return validateArtifactPrepareResponse({
    schema_version: INGESTION_ARTIFACT_PREPARE_CONTRACT,
    request_id: request.request_id,
    job_id: request.job_id,
    run_id: request.run_id,
    lease_expires_at: prepared.leaseExpiresAt,
    artifacts: uploadTargets,
  });
}

function assertArtifactReferences(
  records: PreparedArtifactRecord[],
  callback: IngestionResultCallback,
) {
  if (records.length !== callback.artifacts.length) {
    throw new DomainError("ARTIFACT_SET_MISMATCH", "Result artifacts do not match the prepared set.", 409);
  }
  for (const reference of callback.artifacts) {
    const record = records.find((item) => item.id === reference.artifact_id);
    if (
      !record ||
      record.objectKey !== reference.object_key ||
      !artifactMatches(record, reference)
    ) {
      throw new DomainError("ARTIFACT_REFERENCE_INVALID", "Result contains an invalid artifact reference.", 409);
    }
  }
}

function assertResultConsistency(
  callback: IngestionResultCallback,
  packageSourceId: string,
  expectedBundleId: string | null,
  parserResult: ReturnType<typeof parseParserResult>,
  snapshot: ReturnType<typeof parseCanonicalAnalysisSnapshot>,
) {
  const summary = callback.summary;
  if (!summary) throw new DomainError("RESULT_SUMMARY_MISSING", "Parser summary is required.", 422);
  if (parserResult.package_id !== packageSourceId || snapshot.package_id !== packageSourceId) {
    throw new DomainError("RESULT_PACKAGE_MISMATCH", "Result package identity does not match the job.", 409);
  }
  if (expectedBundleId && parserResult.bundle_id !== expectedBundleId) {
    throw new DomainError("RESULT_BUNDLE_MISMATCH", "Parser bundle identity does not match the source.", 409);
  }
  if (parserResult.snapshot_file !== "canonical-snapshot.json") {
    throw new DomainError("SNAPSHOT_REFERENCE_INVALID", "Parser result must use the canonical snapshot basename.", 422);
  }
  if (parserResult.snapshot_hash !== summary.snapshot_hash) {
    throw new DomainError("SNAPSHOT_HASH_MISMATCH", "Parser and callback snapshot hashes do not match.", 422);
  }
  const expectedStatus = parserResult.status === "PARSED" ? "COMPLETED" : "NEEDS_REVIEW";
  if (callback.status !== expectedStatus || summary.parser_status !== parserResult.status) {
    throw new DomainError("PARSER_STATUS_MISMATCH", "Parser and terminal statuses do not match.", 422);
  }
  const parsed = parserResult.document_outcomes.filter((item) => item.status === "PARSED").length;
  const needsReview = parserResult.document_outcomes.length - parsed;
  if (
    summary.document_count !== parserResult.document_outcomes.length ||
    summary.parsed_document_count !== parsed ||
    summary.needs_review_document_count !== needsReview ||
    summary.issue_count !== parserResult.issues.length
  ) {
    throw new DomainError("RESULT_SUMMARY_MISMATCH", "Parser summary counts are inconsistent.", 422);
  }
}

async function recordFailedResult(jobId: string, callback: IngestionResultCallback) {
  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockIngestionJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, {
        permitExpired: true,
        permittedStatuses: TERMINAL_STATUSES,
      });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return resultAck(callback.callback_id, callback.status);
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    await transaction.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        resultCallbackId: callback.callback_id,
        completedAt: now,
        error: jsonValue(callback.error),
      },
    });
    await transaction.document.update({
      where: { id: job.sourceDocumentId },
      data: { ingestStatus: "NEEDS_REVIEW" },
    });
    await recordAuditEvent(transaction, {
      organizationId: job.organizationId,
      packageId: job.packageId,
      action: "PACKAGE_INGESTION_FAILED",
      targetType: "IngestionJob",
      targetId: job.id,
      metadata: jsonValue({ code: callback.error?.code, retryable: callback.error?.retryable }),
    });
    return resultAck(callback.callback_id, callback.status);
  });
}

export async function recordIngestionResult(jobId: string, value: unknown) {
  const callback = parseIngestionResult(value);
  if (callback.job_id !== jobId) {
    throw new DomainError("JOB_IDENTITY_MISMATCH", "Path and payload job IDs do not match.", 409);
  }
  if (callback.status === "FAILED") return recordFailedResult(jobId, callback);

  const context = await getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockIngestionJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, {
        permitExpired: true,
        permittedStatuses: TERMINAL_STATUSES,
      });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return { duplicate: true as const, job, artifacts: [] };
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    const artifacts = await transaction.ingestionArtifact.findMany({
      where: { jobId, attempt: job.attempt, status: "PREPARED" },
    });
    assertArtifactReferences(artifacts, callback);
    const lease = renewLease(job, now, RESULT_VERIFICATION_LEASE_MS);
    await transaction.ingestionJob.update({ where: { id: jobId }, data: { lease } });
    return { duplicate: false as const, job: { ...job, lease }, artifacts };
  });
  if (context.duplicate) return resultAck(callback.callback_id, callback.status);

  const parserArtifact = context.artifacts.find((item) => item.kind === "PARSER_RESULT");
  const snapshotArtifact = context.artifacts.find((item) => item.kind === "CANONICAL_SNAPSHOT");
  if (!parserArtifact || !snapshotArtifact) {
    throw new DomainError("ARTIFACT_SET_MISMATCH", "Both parser artifacts are required.", 409);
  }
  const parserResult = parseParserResult(await downloadVerifiedJsonArtifact(parserArtifact));
  const snapshot = parseCanonicalAnalysisSnapshot(await downloadVerifiedJsonArtifact(snapshotArtifact));
  const metadata = context.job.sourceDocumentId
    ? await getPrismaClient().document.findUnique({
      where: { id: context.job.sourceDocumentId },
      select: { metadata: true },
    })
    : null;
  const bundleId = metadata?.metadata && typeof metadata.metadata === "object" && !Array.isArray(metadata.metadata)
    ? (metadata.metadata as Record<string, unknown>).bundleId
    : null;
  assertResultConsistency(
    callback,
    context.job.package.sourceId,
    typeof bundleId === "string" ? bundleId : null,
    parserResult,
    snapshot,
  );

  return getPrismaClient().$transaction(async (transaction) => {
    const now = new Date();
    const job = await lockIngestionJob(transaction, jobId);
    if (TERMINAL_STATUSES.includes(job.status)) {
      assertActiveLease(job, callback, now, {
        permitExpired: true,
        permittedStatuses: TERMINAL_STATUSES,
      });
      if (job.resultCallbackId === callback.callback_id && job.status === callback.status) {
        return resultAck(callback.callback_id, callback.status);
      }
      throw new DomainError("TERMINAL_RESULT_CONFLICT", "A different terminal result already exists.", 409);
    }
    assertActiveLease(job, callback, now);
    const activeArtifacts = await transaction.ingestionArtifact.findMany({
      where: { jobId, attempt: job.attempt, status: "PREPARED" },
    });
    assertArtifactReferences(activeArtifacts, callback);

    await transaction.canonicalSnapshot.upsert({
      where: { documentId: job.sourceDocumentId },
      create: {
        organizationId: job.organizationId,
        packageId: job.packageId,
        documentId: job.sourceDocumentId,
        contractVersion: snapshot.schema_version,
        snapshotHash: callback.summary!.snapshot_hash,
        payload: jsonValue(snapshot),
      },
      update: {
        contractVersion: snapshot.schema_version,
        snapshotHash: callback.summary!.snapshot_hash,
        payload: jsonValue(snapshot),
      },
    });
    await transaction.ingestionArtifact.updateMany({
      where: { jobId, attempt: job.attempt },
      data: { status: "VERIFIED", verifiedAt: now },
    });
    await transaction.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: callback.status,
        stage: "COMPLETE",
        resultCallbackId: callback.callback_id,
        completedAt: now,
        error: Prisma.JsonNull,
      },
    });
    await transaction.document.update({
      where: { id: job.sourceDocumentId },
      data: {
        ingestStatus: callback.status === "COMPLETED" ? "PARSED" : "NEEDS_REVIEW",
        parserVersion: parserResult.parser_version,
      },
    });
    await transaction.tenderPackage.update({
      where: { id: job.packageId },
      data: { workflowStage: "READY_FOR_ANALYSIS" },
    });
    await transaction.sourceRecord.updateMany({
      where: {
        organizationId: job.organizationId,
        entityType: "TenderPackage",
        entityId: job.packageId,
        rawPayloadHash: job.inputBundleHash,
      },
      data: {
        parserVersion: parserResult.parser_version,
        fieldCompleteness: callback.summary!.document_count
          ? callback.summary!.parsed_document_count / callback.summary!.document_count
          : 0,
        qualityFlags: jsonValue(parserResult.issues.map((issue) => issue.code)),
      },
    });
    await recordAuditEvent(transaction, {
      organizationId: job.organizationId,
      packageId: job.packageId,
      action: "PACKAGE_INGESTION_COMPLETED",
      targetType: "IngestionJob",
      targetId: job.id,
      metadata: jsonValue({
        status: callback.status,
        snapshotHash: callback.summary!.snapshot_hash,
        parserVersion: parserResult.parser_version,
        issueCount: callback.summary!.issue_count,
      }),
    });
    return resultAck(callback.callback_id, callback.status);
  });
}
