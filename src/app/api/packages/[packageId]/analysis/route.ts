import { after } from "next/server";
import { z } from "zod";
import { requestedAnalysisEngines } from "@/lib/analysis/contracts";
import {
  createAnalysisJob,
  dispatchAnalysisJob,
  getLatestAnalysisJob,
} from "@/lib/analysis/service";
import {
  apiError,
  readJsonBody,
  rejectCrossOriginMutation,
  requireTenantApiSession,
  validResourceId,
} from "@/lib/http/api";

const engineSchema = z.enum(requestedAnalysisEngines);
const requestSchema = z.strictObject({
  requested_engines: z.array(engineSchema).min(1).max(requestedAnalysisEngines.length).optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: RouteContext<"/api/packages/[packageId]/analysis">,
) {
  const auth = await requireTenantApiSession("package:view");
  if ("response" in auth) return auth.response;
  const { packageId } = await context.params;
  if (!validResourceId(packageId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid package ID." } }, { status: 400 });
  }
  try {
    const state = await getLatestAnalysisJob(auth.principal, packageId);
    return Response.json(state, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/packages/[packageId]/analysis">,
) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireTenantApiSession("package:manage");
  if ("response" in auth) return auth.response;
  const { packageId } = await context.params;
  if (!validResourceId(packageId)) {
    return Response.json({ error: { code: "INVALID_ID", message: "Invalid package ID." } }, { status: 400 });
  }
  try {
    const body = requestSchema.parse(await readJsonBody(request, 4096));
    const submission = await createAnalysisJob(
      auth.principal,
      packageId,
      body.requested_engines ?? requestedAnalysisEngines,
    );
    if (submission.created) {
      const actor = {
        authUserId: auth.principal.authUserId,
        organizationId: auth.principal.organizationId,
        profileId: auth.principal.profileId,
      };
      after(() => dispatchAnalysisJob(actor, submission.job));
    }
    return Response.json(
      {
        job: submission.job,
        created: submission.created,
        links: {
          status: `/api/packages/${encodeURIComponent(packageId)}/analysis`,
          processing: `/packages/${encodeURIComponent(packageId)}/processing`,
        },
      },
      { status: submission.created ? 202 : 200, headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: { code: "INVALID_REQUEST", message: "Invalid analysis request." } }, { status: 400 });
    }
    return apiError(error);
  }
}
