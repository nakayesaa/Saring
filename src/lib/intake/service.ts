import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { recordAuditEvent } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertBundleIsSafe } from "@/lib/intake/malware-scanner";
import {
  CANONICAL_PACKAGE_CONTRACT,
  DEFAULT_PARSER_VERSION,
} from "@/lib/intake/contracts";
import { validateHybridBundle, type ValidatedHybridBundle } from "@/lib/intake/hybrid-validation";
import {
  acceptedBundleMetadata,
  validateCanonicalBundle,
} from "@/lib/intake/validation";

const BUCKET = "evidence";
const UPLOAD_TTL_MS = 10 * 60 * 1000;
const UPLOAD_RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOAD_INTENTS_PER_WINDOW = 10;

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type UploadIntentInput = {
  fileName: string;
  byteSize: number;
  mimeType: string;
};

export type UploadIntentResponse = {
  uploadId: string;
  bucket: typeof BUCKET;
  objectKey: string;
  token: string;
  expiresAt: string;
};

function safeOriginalFileName(value: string) {
  return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240);
}

export async function createUploadIntent(
  principal: WorkspacePrincipal,
  input: UploadIntentInput,
): Promise<UploadIntentResponse> {
  if (!acceptedBundleMetadata(input.fileName, input.byteSize, input.mimeType)) {
    throw new DomainError(
      "INVALID_UPLOAD_METADATA",
      "Choose a canonical JSON or ZIP bundle no larger than 50 MiB.",
      422,
    );
  }

  const recentIntentCount = await withTenantContext(principal, (transaction) =>
    transaction.uploadIntent.count({
      where: {
        requestedById: principal.profileId,
        createdAt: { gte: new Date(Date.now() - UPLOAD_RATE_WINDOW_MS) },
      },
    }),
  );
  if (recentIntentCount >= MAX_UPLOAD_INTENTS_PER_WINDOW) {
    throw new DomainError(
      "UPLOAD_RATE_LIMITED",
      "Too many upload sessions were created. Try again in a few minutes.",
      429,
    );
  }

  const uploadId = randomUUID();
  const extension = input.fileName.toLowerCase().endsWith(".zip") ? "zip" : "json";
  const objectKey = `${principal.organizationId}/quarantine/${uploadId}/bundle.${extension}`;
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);

  await withTenantContext(principal, (transaction) =>
    transaction.uploadIntent.create({
      data: {
        id: uploadId,
        organizationId: principal.organizationId,
        requestedById: principal.profileId,
        objectKey,
        originalFileName: safeOriginalFileName(input.fileName),
        declaredMimeType: input.mimeType.toLowerCase(),
        declaredByteSize: BigInt(input.byteSize),
        expiresAt,
      },
    }),
  );

  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(objectKey, { upsert: false });
  if (error || !data) {
    await withTenantContext(principal, (transaction) =>
      transaction.uploadIntent.delete({ where: { id: uploadId } }),
    );
    throw new DomainError("STORAGE_UNAVAILABLE", "Unable to prepare the private upload.", 503);
  }

  return { uploadId, bucket: BUCKET, objectKey, token: data.token, expiresAt: expiresAt.toISOString() };
}

async function rejectIntent(principal: WorkspacePrincipal, uploadId: string, objectKey: string, code: string) {
  await Promise.allSettled([
    createSupabaseAdminClient().storage.from(BUCKET).remove([objectKey]),
    withTenantContext(principal, (transaction) =>
      transaction.uploadIntent.updateMany({
        where: { id: uploadId, organizationId: principal.organizationId, status: "PENDING" },
        data: { status: "REJECTED", rejectionCode: code },
      }),
    ),
  ]);
}

function ingestionIdempotencyKey(organizationId: string, bundleHash: string) {
  return createHash("sha256")
    .update(`${organizationId}:${bundleHash}:${DEFAULT_PARSER_VERSION}`)
    .digest("hex");
}

function rawBundlePolicy(bundle: ValidatedHybridBundle) {
  const synthetic = bundle.manifest.bundle_mode === "SYNTHETIC";
  return {
    classification: synthetic ? "SYNTHETIC" as const : "RESTRICTED" as const,
    legalBasis: synthetic ? "SYNTHETIC" as const :
      bundle.legalBasisTag === "PUBLIC_INFORMATION" ? "PUBLIC_INFORMATION" as const :
        "AUTHORIZED_PROCUREMENT" as const,
    retentionClass: synthetic ? "TEMPORARY_ENRICHMENT" as const : "PROCUREMENT_CASE" as const,
  };
}

async function finalizeHybridUpload(
  principal: WorkspacePrincipal,
  uploadId: string,
  objectKey: string,
  originalFileName: string,
  bundle: ValidatedHybridBundle,
) {
  const policy = rawBundlePolicy(bundle);
  const documentId = randomUUID();
  const ingestionJobId = randomUUID();
  const runId = `IR:${randomUUID()}`;
  const idempotencyKey = ingestionIdempotencyKey(principal.organizationId, bundle.fileHash);
  const bidDeadline = new Date(bundle.package.bid_deadline_at);

  return withTenantContext(principal, async (transaction) => {
    const duplicate = await transaction.tenderPackage.findUnique({
      where: {
        organizationId_sourceId: {
          organizationId: principal.organizationId,
          sourceId: bundle.sourceId,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new DomainError(
        "PACKAGE_ALREADY_EXISTS",
        "A package with this source ID already exists in the workspace.",
        409,
      );
    }

    const procurementPackage = await transaction.tenderPackage.create({
      data: {
        organizationId: principal.organizationId,
        sourceId: bundle.sourceId,
        name: bundle.package.name,
        fiscalYear: bidDeadline.getUTCFullYear(),
        procurementMethod: bundle.package.procurement_method,
        buyerInstitution: bundle.package.buyer,
        currency: bundle.package.currency,
        bidDeadlineAt: bidDeadline,
        analysisCutoffAt: new Date(bundle.package.analysis_cutoff_at),
        workflowStage: "INGESTING",
        isSynthetic: bundle.manifest.bundle_mode === "SYNTHETIC",
      },
    });
    const document = await transaction.document.create({
      data: {
        id: documentId,
        organizationId: principal.organizationId,
        packageId: procurementPackage.id,
        type: "MANIFEST",
        originalFileName,
        storageKey: objectKey,
        sha256: bundle.fileHash,
        mimeType: bundle.mimeType,
        byteSize: BigInt(bundle.byteSize),
        classification: policy.classification,
        legalBasis: policy.legalBasis,
        retentionClass: policy.retentionClass,
        ingestStatus: "VALIDATED",
        metadata: {
          bundleId: bundle.manifest.bundle_id,
          bundleMode: bundle.manifest.bundle_mode,
          manifestCreatedAt: bundle.manifest.created_at,
          participantCount: bundle.package.participant_count,
          expectedFileCount: bundle.expectedFileCount,
          archivePrefix: bundle.archivePrefix,
          evaluatorAssetsPresent: bundle.evaluatorAssetsPresent,
          inputContractVersion: bundle.inputContractVersion,
        },
      },
    });
    const ingestionJob = await transaction.ingestionJob.create({
      data: {
        id: ingestionJobId,
        organizationId: principal.organizationId,
        packageId: procurementPackage.id,
        sourceDocumentId: document.id,
        requestedById: principal.profileId,
        runId,
        inputBundleHash: bundle.fileHash,
        inputBundleLocation: `supabase://evidence/${objectKey}`,
        inputContractVersion: bundle.inputContractVersion,
        outputContractVersion: CANONICAL_PACKAGE_CONTRACT,
        requestedParserVersion: DEFAULT_PARSER_VERSION,
        idempotencyKey,
      },
    });
    await transaction.sourceRecord.create({
      data: {
        organizationId: principal.organizationId,
        entityType: "TenderPackage",
        entityId: procurementPackage.id,
        sourceSystem: "SARING_HYBRID_BUNDLE",
        sourceRecordId: bundle.manifest.bundle_id,
        sourceUrlOrEndpoint: `supabase-storage:${BUCKET}/${objectKey}`,
        retrievedAt: new Date(),
        effectiveFrom: new Date(bundle.package.announcement_at ?? bundle.package.bid_deadline_at),
        rawPayloadHash: bundle.fileHash,
        rawPayloadStorageKey: objectKey,
        parserVersion: "UNPARSED",
        fieldCompleteness: 0,
        qualityFlags: [
          "RAW_HYBRID_BUNDLE",
          ...(bundle.evaluatorAssetsPresent ? ["EVALUATOR_ASSETS_REQUIRE_ISOLATION"] : []),
        ],
        legalBasis: policy.legalBasis,
        licenseOrTermsId: "PACKAGE_BUNDLE_UPLOAD",
        retentionClass: policy.retentionClass,
      },
    });
    await transaction.uploadIntent.update({
      where: { id: uploadId },
      data: {
        status: "FINALIZED",
        packageId: procurementPackage.id,
        documentId: document.id,
        finalizedAt: new Date(),
      },
    });
    await recordAuditEvent(transaction, {
      organizationId: principal.organizationId,
      actorUserId: principal.profileId,
      packageId: procurementPackage.id,
      action: "RAW_PACKAGE_BUNDLE_QUEUED",
      targetType: "IngestionJob",
      targetId: ingestionJob.id,
      metadata: {
        sha256: bundle.fileHash,
        byteSize: bundle.byteSize,
        bundleId: bundle.manifest.bundle_id,
        evaluatorAssetsPresent: bundle.evaluatorAssetsPresent,
      },
    });
    return {
      packageId: procurementPackage.sourceId,
      uploadId,
      ingestionJobId: ingestionJob.id,
      status: "QUEUED_FOR_INGESTION" as const,
    };
  });
}

export async function finalizeUploadIntent(
  principal: WorkspacePrincipal,
  uploadId: string,
) {
  const intent = await withTenantContext(principal, (transaction) =>
    transaction.uploadIntent.findFirst({
      where: { id: uploadId, organizationId: principal.organizationId, requestedById: principal.profileId },
      include: { package: { select: { sourceId: true } } },
    }),
  );
  if (!intent) throw new DomainError("UPLOAD_NOT_FOUND", "Upload intent was not found.", 404);
  if (intent.status === "FINALIZED" && intent.package) {
    return { packageId: intent.package.sourceId, uploadId, status: "FINALIZED" as const };
  }
  if (intent.status !== "PENDING") {
    throw new DomainError("UPLOAD_NOT_FINALIZABLE", "This upload can no longer be finalized.", 409);
  }
  if (intent.expiresAt.getTime() <= Date.now()) {
    await rejectIntent(principal, uploadId, intent.objectKey, "UPLOAD_EXPIRED");
    throw new DomainError("UPLOAD_EXPIRED", "The upload session expired. Choose the file again.", 410);
  }

  const { data, error } = await createSupabaseAdminClient().storage.from(BUCKET).download(intent.objectKey);
  if (error || !data) {
    throw new DomainError("UPLOAD_INCOMPLETE", "The file has not finished uploading.", 409);
  }

  try {
    const bytes = await data.arrayBuffer();
    if (bytes.byteLength !== Number(intent.declaredByteSize)) {
      throw new DomainError("UPLOAD_SIZE_MISMATCH", "Uploaded bytes do not match the declared file size.", 422);
    }
    let hybridBundle: ValidatedHybridBundle | null = null;
    if (intent.originalFileName.toLowerCase().endsWith(".zip")) {
      try {
        hybridBundle = await validateHybridBundle(bytes);
      } catch (error) {
        if (!(error instanceof DomainError && error.code === "NOT_HYBRID_BUNDLE")) throw error;
      }
    }
    if (hybridBundle) {
      await assertBundleIsSafe({
        bytes,
        fileName: intent.originalFileName,
        mimeType: hybridBundle.mimeType,
        sha256: hybridBundle.fileHash,
        bundleMode: hybridBundle.manifest.bundle_mode,
      });
      return await finalizeHybridUpload(
        principal,
        uploadId,
        intent.objectKey,
        intent.originalFileName,
        hybridBundle,
      );
    }

    const bundle = await validateCanonicalBundle(bytes, intent.originalFileName);
    const canonical = bundle.snapshot;
    await assertBundleIsSafe({
      bytes,
      fileName: intent.originalFileName,
      mimeType: bundle.mimeType,
      sha256: bundle.fileHash,
      bundleMode: canonical.package.bundle_mode,
    });
    const provenance = canonical.provenance[0];
    const completenessValues = Object.values(canonical.quality.completeness_by_module);
    const fieldCompleteness = completenessValues.reduce((sum, value) => sum + value, 0) /
      Math.max(1, completenessValues.length);
    const documentId = randomUUID();

    const result = await withTenantContext(principal, async (transaction) => {
      const duplicate = await transaction.tenderPackage.findUnique({
        where: {
          organizationId_sourceId: {
            organizationId: principal.organizationId,
            sourceId: canonical.package.source_id,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new DomainError(
          "PACKAGE_ALREADY_EXISTS",
          "A package with this canonical source ID already exists in the workspace.",
          409,
        );
      }

      const procurementPackage = await transaction.tenderPackage.create({
        data: {
          organizationId: principal.organizationId,
          sourceId: canonical.package.source_id,
          name: canonical.package.name,
          fiscalYear: canonical.package.fiscal_year,
          procurementMethod: canonical.package.procurement_method,
          categoryCode: canonical.package.category_code,
          buyerInstitution: canonical.package.buyer.institution_name,
          buyerUnit: canonical.package.buyer.unit_name,
          regionCode: canonical.package.region_code,
          hpsTotal: canonical.package.hps_total,
          currency: canonical.package.currency,
          bidDeadlineAt: new Date(canonical.package.bid_deadline_at),
          analysisCutoffAt: new Date(canonical.package.analysis_cutoff_at),
          workflowStage: "READY_FOR_ANALYSIS",
          isSynthetic: canonical.package.bundle_mode === "SYNTHETIC",
        },
      });
      const document = await transaction.document.create({
        data: {
          id: documentId,
          organizationId: principal.organizationId,
          packageId: procurementPackage.id,
          type: "PACKAGE_METADATA",
          originalFileName: intent.originalFileName,
          storageKey: intent.objectKey,
          sha256: bundle.fileHash,
          mimeType: bundle.mimeType,
          byteSize: BigInt(bundle.byteSize),
          classification: canonical.package.bundle_mode === "SYNTHETIC" ? "SYNTHETIC" : "RESTRICTED",
          legalBasis: provenance.legal_basis_tag,
          retentionClass: provenance.retention_class,
          ingestStatus: "VALIDATED",
          parserVersion: provenance.parser_version,
          metadata: {
            canonicalSchemaVersion: canonical.schema_version,
            canonicalPackageId: canonical.package.package_id,
            canonicalSnapshotHash: bundle.snapshotHash,
            participantCount: canonical.package.participant_count,
            documentCount: canonical.documents.length,
            quality: canonical.quality,
          },
        },
      });
      await transaction.canonicalSnapshot.create({
        data: {
          organizationId: principal.organizationId,
          packageId: procurementPackage.id,
          documentId: document.id,
          contractVersion: canonical.schema_version,
          snapshotHash: bundle.snapshotHash,
          payload: jsonValue(canonical),
        },
      });
      for (const participant of canonical.participants) {
        const vendor = await transaction.vendor.upsert({
          where: {
            organizationId_normalizedName: {
              organizationId: principal.organizationId,
              normalizedName: participant.vendor.normalized_name,
            },
          },
          create: {
            organizationId: principal.organizationId,
            providerSourceId: participant.vendor.source_id,
            legalName: participant.vendor.legal_name,
            normalizedName: participant.vendor.normalized_name,
          },
          update: {
            providerSourceId: participant.vendor.source_id,
            legalName: participant.vendor.legal_name,
          },
        });
        await transaction.participation.create({
          data: {
            packageId: procurementPackage.id,
            vendorId: vendor.id,
            status: participant.status as "REGISTERED" | "SUBMITTED" | "WITHDRAWN" | "DISQUALIFIED" | "EVALUATED" | "AWARDED",
            submittedAt: participant.submitted_at ? new Date(participant.submitted_at) : null,
            bidTotal: participant.bid_total,
          },
        });
      }
      await transaction.sourceRecord.create({
        data: {
          organizationId: principal.organizationId,
          entityType: "TenderPackage",
          entityId: procurementPackage.id,
          sourceSystem: provenance.source_system,
          sourceRecordId: provenance.source_record_id,
          sourceUrlOrEndpoint: `supabase-storage:${BUCKET}/${intent.objectKey}`,
          retrievedAt: new Date(provenance.retrieved_at),
          effectiveFrom: provenance.effective_at ? new Date(provenance.effective_at) : null,
          rawPayloadHash: bundle.fileHash,
          rawPayloadStorageKey: intent.objectKey,
          parserVersion: provenance.parser_version,
          fieldCompleteness,
          qualityFlags: canonical.quality.quality_flags,
          legalBasis: provenance.legal_basis_tag,
          licenseOrTermsId: "CANONICAL_PACKAGE_UPLOAD",
          retentionClass: provenance.retention_class,
        },
      });
      await transaction.uploadIntent.update({
        where: { id: uploadId },
        data: {
          status: "FINALIZED",
          packageId: procurementPackage.id,
          documentId: document.id,
          finalizedAt: new Date(),
        },
      });
      await recordAuditEvent(transaction, {
        organizationId: principal.organizationId,
        actorUserId: principal.profileId,
        packageId: procurementPackage.id,
        action: "PACKAGE_BUNDLE_FINALIZED",
        targetType: "Document",
        targetId: document.id,
        metadata: { sha256: bundle.fileHash, byteSize: bundle.byteSize, mimeType: bundle.mimeType },
      });
      return { packageId: procurementPackage.sourceId, uploadId, status: "FINALIZED" as const };
    });
    return result;
  } catch (error) {
    await rejectIntent(
      principal,
      uploadId,
      intent.objectKey,
      error instanceof DomainError ? error.code : "FINALIZATION_FAILED",
    );
    throw error;
  }
}

export async function getPersistedCanonicalPackage(
  principal: WorkspacePrincipal,
  packageSourceId: string,
) {
  return withTenantContext(principal, async (transaction) => {
    const procurementPackage = await transaction.tenderPackage.findUnique({
      where: {
        organizationId_sourceId: {
          organizationId: principal.organizationId,
          sourceId: packageSourceId,
        },
      },
      include: {
        canonicalSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const snapshot = procurementPackage?.canonicalSnapshots[0];
    if (!procurementPackage || !snapshot) {
      throw new DomainError("PACKAGE_NOT_FOUND", "Package not found.", 404);
    }
    return {
      package: procurementPackage,
      contractVersion: snapshot.contractVersion,
      snapshot: snapshot.payload as unknown,
    };
  });
}
