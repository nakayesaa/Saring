import {
  apiError,
  readJsonBody,
  requireWorkerRequest,
  validResourceId,
} from "@/lib/http/api";
import { recordAnalysisProgress, resolveWorkerActor } from "@/lib/analysis/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const unauthorized = requireWorkerRequest(request);
  if (unauthorized) return unauthorized;
  const { jobId } = await context.params;
  if (!validResourceId(jobId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid job ID." } }, { status: 400 });
  }
  try {
    const [actor, body] = await Promise.all([
      resolveWorkerActor(jobId),
      readJsonBody(request, 64 * 1024),
    ]);
    const result = await recordAnalysisProgress(actor, jobId, body);
    return Response.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    return apiError(error);
  }
}
