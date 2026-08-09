import { z } from "zod";
import { apiError, readJsonBody, requireWorkerRequest } from "@/lib/http/api";
import { claimIngestionJob } from "@/lib/intake/worker";

const inputSchema = z.strictObject({
  worker_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
});

export async function POST(request: Request) {
  const unauthorized = requireWorkerRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const { worker_id } = inputSchema.parse(await readJsonBody(request, 4096));
    const claimed = await claimIngestionJob(worker_id);
    if (!claimed) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    return Response.json(claimed, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: { code: "INVALID_CLAIM_REQUEST", message: "Worker claim metadata is invalid." } },
        { status: 400 },
      );
    }
    return apiError(error);
  }
}
