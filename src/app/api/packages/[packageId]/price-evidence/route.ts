import {
  apiError,
  requireApiSession,
  validResourceId,
} from "@/lib/http/api";
import { getPriceEvidenceQuery } from "@/lib/price-engine/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const auth = await requireApiSession();
  if ("response" in auth) return auth.response;
  const { packageId } = await context.params;
  if (!validResourceId(packageId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid package ID." } }, { status: 400 });
  }
  try {
    const evidence = await getPriceEvidenceQuery().getByPackageId(packageId);
    return Response.json(evidence, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
