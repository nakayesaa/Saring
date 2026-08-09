import "server-only";

import { DomainError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "evidence";
const ARTIFACT_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export type PreparedAnalysisArtifact = {
  id: string;
  engine: "PRICE" | "DOCUMENT" | "GRAPH" | "TECHNICAL" | "COMPLETENESS" | "DATA_QUALITY" | "FUSION";
  objectKey: string;
  sha256: string;
  byteSize: bigint;
  schemaVersion: string;
  mimeType: string;
};

export async function issueAnalysisArtifactUploadTargets(artifacts: PreparedAnalysisArtifact[]) {
  const expiresAt = new Date(Date.now() + ARTIFACT_UPLOAD_TTL_MS).toISOString();
  return Promise.all(artifacts.map(async (artifact) => {
    const { data, error } = await createSupabaseAdminClient()
      .storage.from(BUCKET)
      .createSignedUploadUrl(artifact.objectKey, { upsert: true });
    if (error || !data) {
      throw new DomainError("ARTIFACT_STORAGE_UNAVAILABLE", "Unable to prepare analysis artifact upload.", 503);
    }
    return {
      artifact_id: artifact.id,
      kind: "ENGINE_RESULT" as const,
      engine: artifact.engine,
      object_key: artifact.objectKey,
      sha256: artifact.sha256,
      size_bytes: Number(artifact.byteSize),
      schema_version: artifact.schemaVersion,
      media_type: artifact.mimeType,
      upload: {
        url: data.signedUrl,
        method: "PUT" as const,
        headers: {
          "content-type": artifact.mimeType,
          "cache-control": "max-age=3600",
        },
        expires_at: expiresAt,
      },
    };
  }));
}
