import "server-only";

import type { WorkspacePrincipal } from "@/lib/auth/principal";
import { withTenantContext } from "@/lib/db/tenant";
import { DomainError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const ACTIVE_INGESTION_STATUSES = ["QUEUED", "CLAIMED", "RUNNING"] as const;
const ACTIVE_ANALYSIS_STATUSES = ["QUEUED", "CLAIMED", "RUNNING"] as const;

export type DeletedPackageSummary = {
  packageId: string;
  packageName: string;
  storageObjectsRequested: number;
  storageCleanupComplete: boolean;
};

export async function deleteStoredPackage(
  principal: WorkspacePrincipal,
  packageSourceId: string,
): Promise<DeletedPackageSummary> {
  const deletion = await withTenantContext(principal, async (transaction) => {
    const packageRecord = await transaction.tenderPackage.findFirst({
      where: { organizationId: principal.organizationId, sourceId: packageSourceId },
      select: {
        id: true,
        sourceId: true,
        name: true,
        documents: { select: { id: true, storageKey: true } },
        uploadIntents: { select: { id: true, objectKey: true } },
        ingestionJobs: {
          select: {
            status: true,
            artifacts: { select: { objectKey: true } },
          },
        },
        analysisJobs: {
          select: {
            status: true,
            artifacts: { select: { objectKey: true } },
            auxiliaryInputs: { select: { objectKey: true } },
          },
        },
      },
    });
    if (!packageRecord) {
      throw new DomainError("PACKAGE_NOT_FOUND", "Package tidak ditemukan di workspace aktif.", 404);
    }

    const ingestionActive = packageRecord.ingestionJobs.some((job) =>
      ACTIVE_INGESTION_STATUSES.includes(job.status as typeof ACTIVE_INGESTION_STATUSES[number]),
    );
    const analysisActive = packageRecord.analysisJobs.some((job) =>
      ACTIVE_ANALYSIS_STATUSES.includes(job.status as typeof ACTIVE_ANALYSIS_STATUSES[number]),
    );
    if (ingestionActive || analysisActive) {
      throw new DomainError(
        "PACKAGE_JOB_ACTIVE",
        "Package tidak dapat dihapus ketika ingestion atau analysis masih berjalan.",
        409,
      );
    }

    const documentIds = packageRecord.documents.map((document) => document.id);
    const entityIds = [packageRecord.id, ...documentIds];
    const sourceRecords = await transaction.sourceRecord.findMany({
      where: { organizationId: principal.organizationId, entityId: { in: entityIds } },
      select: { rawPayloadStorageKey: true },
    });
    const documentUploadIntents = documentIds.length
      ? await transaction.uploadIntent.findMany({
          where: {
            organizationId: principal.organizationId,
            documentId: { in: documentIds },
          },
          select: { id: true, objectKey: true },
        })
      : [];

    const storageKeys = new Set<string>([
      ...packageRecord.documents.map((document) => document.storageKey),
      ...packageRecord.uploadIntents.map((intent) => intent.objectKey),
      ...documentUploadIntents.map((intent) => intent.objectKey),
      ...sourceRecords.map((source) => source.rawPayloadStorageKey),
      ...packageRecord.ingestionJobs.flatMap((job) =>
        job.artifacts.map((artifact) => artifact.objectKey),
      ),
      ...packageRecord.analysisJobs.flatMap((job) => [
        ...job.artifacts.map((artifact) => artifact.objectKey),
        ...job.auxiliaryInputs.map((input) => input.objectKey),
      ]),
    ]);

    await transaction.auditEvent.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.profileId,
        packageId: packageRecord.id,
        action: "PACKAGE_DELETED",
        targetType: "TenderPackage",
        targetId: packageRecord.id,
        metadata: {
          source_id: packageRecord.sourceId,
          package_name: packageRecord.name,
          storage_object_count: storageKeys.size,
        },
      },
    });

    if (entityIds.length) {
      await transaction.sourceRecord.deleteMany({
        where: { organizationId: principal.organizationId, entityId: { in: entityIds } },
      });
    }
    await transaction.graphEdge.deleteMany({
      where: { organizationId: principal.organizationId, packageId: packageRecord.id },
    });
    await transaction.uploadIntent.deleteMany({
      where: {
        organizationId: principal.organizationId,
        OR: [
          { packageId: packageRecord.id },
          ...(documentIds.length ? [{ documentId: { in: documentIds } }] : []),
        ],
      },
    });

    // Delete jobs before their canonical document/snapshot references.
    await transaction.analysisJob.deleteMany({ where: { packageId: packageRecord.id } });
    await transaction.ingestionJob.deleteMany({ where: { packageId: packageRecord.id } });
    await transaction.canonicalSnapshot.deleteMany({ where: { packageId: packageRecord.id } });
    await transaction.tenderPackage.delete({ where: { id: packageRecord.id } });

    return {
      packageId: packageRecord.sourceId,
      packageName: packageRecord.name,
      storageKeys: [...storageKeys],
    };
  });

  let storageCleanupComplete = true;
  try {
    const storage = createSupabaseAdminClient().storage.from(BUCKET);
    for (let index = 0; index < deletion.storageKeys.length; index += 100) {
      const batch = deletion.storageKeys.slice(index, index + 100);
      if (!batch.length) continue;
      const { error } = await storage.remove(batch);
      if (error) {
        storageCleanupComplete = false;
        console.error("Package database deletion succeeded but storage cleanup failed", {
          packageId: deletion.packageId,
          batchSize: batch.length,
          message: error.message,
        });
      }
    }
  } catch (error) {
    storageCleanupComplete = false;
    console.error("Package database deletion succeeded but storage cleanup could not start", {
      packageId: deletion.packageId,
      message: error instanceof Error ? error.message : "Unknown storage error",
    });
  }

  return {
    packageId: deletion.packageId,
    packageName: deletion.packageName,
    storageObjectsRequested: deletion.storageKeys.length,
    storageCleanupComplete,
  };
}
