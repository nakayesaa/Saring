import { z } from "zod";
import {
  apiError,
  readJsonBody,
  rejectCrossOriginMutation,
  requireTenantApiSession,
} from "@/lib/http/api";
import { createUploadIntent } from "@/lib/intake/service";
import { MAX_UPLOAD_BYTES } from "@/lib/intake/validation";

const inputSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(240),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireTenantApiSession("document:upload");
  if ("response" in auth) return auth.response;
  try {
    const input = inputSchema.parse(await readJsonBody(request, 4096));
    const intent = await createUploadIntent(auth.principal, input);
    return Response.json(intent, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: { code: "INVALID_UPLOAD_METADATA", message: "Upload metadata is invalid." } },
        { status: 400 },
      );
    }
    return apiError(error);
  }
}
