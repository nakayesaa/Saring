import { z } from "zod";
import {
  auxiliaryInputKinds,
  registerAnalysisAuxiliaryInputs,
} from "@/lib/analysis/auxiliary-inputs";
import {
  apiError,
  readJsonBody,
  rejectCrossOriginMutation,
  requireTenantApiSession,
  validDatabaseId,
} from "@/lib/http/api";

const requestSchema = z.strictObject({
  inputs: z.array(z.strictObject({
    kind: z.enum(auxiliaryInputKinds),
    payload: z.unknown(),
  })).min(1).max(3),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireTenantApiSession("package:manage");
  if ("response" in auth) return auth.response;
  const { jobId } = await context.params;
  if (!validDatabaseId(jobId)) {
    return Response.json(
      { error: { code: "INVALID_ID", message: "Invalid analysis job ID." } },
      { status: 400 },
    );
  }
  try {
    const body = requestSchema.parse(await readJsonBody(request, 64 * 1024 * 1024));
    const result = await registerAnalysisAuxiliaryInputs(auth.principal, jobId, body.inputs);
    return Response.json(result, {
      status: 201,
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: { code: "INVALID_REQUEST", message: "Invalid auxiliary input request." } },
        { status: 400 },
      );
    }
    return apiError(error);
  }
}
