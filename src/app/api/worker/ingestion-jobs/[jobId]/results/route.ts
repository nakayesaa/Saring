import {
  apiError,
  readJsonBody,
  requireWorkerRequest,
  validDatabaseId,
} from "@/lib/http/api";
import { recordIngestionResult } from "@/lib/intake/worker-callbacks";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const unauthorized = requireWorkerRequest(request);
  if (unauthorized) return unauthorized;
  const { jobId } = await context.params;
  if (!validDatabaseId(jobId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid job ID." } }, { status: 400 });
  }
  try {
    const result = await recordIngestionResult(jobId, await readJsonBody(request, 128 * 1024));
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
