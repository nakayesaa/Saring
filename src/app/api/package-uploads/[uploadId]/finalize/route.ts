import {
  apiError,
  rejectCrossOriginMutation,
  requireTenantApiSession,
  validResourceId,
} from "@/lib/http/api";
import { finalizeUploadIntent } from "@/lib/intake/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireTenantApiSession("document:upload");
  if ("response" in auth) return auth.response;
  const { uploadId } = await context.params;
  if (!validResourceId(uploadId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid upload ID." } }, { status: 400 });
  }
  try {
    const result = await finalizeUploadIntent(auth.principal, uploadId);
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
