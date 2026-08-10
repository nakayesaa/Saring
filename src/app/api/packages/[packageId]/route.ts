import { z } from "zod";
import { deleteStoredPackage } from "@/lib/intake/delete-package";
import {
  apiError,
  readJsonBody,
  rejectCrossOriginMutation,
  requireTenantApiSession,
  validResourceId,
} from "@/lib/http/api";

const deleteSchema = z.strictObject({ confirmation: z.string().min(1).max(128) });

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ packageId: string }> },
) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireTenantApiSession("package:delete");
  if ("response" in auth) return auth.response;

  const { packageId } = await context.params;
  if (!validResourceId(packageId)) {
    return Response.json(
      { error: { code: "INVALID_ID", message: "ID package tidak valid." } },
      { status: 400 },
    );
  }

  try {
    const body = deleteSchema.parse(await readJsonBody(request, 1024));
    if (body.confirmation !== packageId) {
      return Response.json(
        { error: { code: "CONFIRMATION_MISMATCH", message: "Konfirmasi ID package tidak cocok." } },
        { status: 400 },
      );
    }
    const deleted = await deleteStoredPackage(auth.principal, packageId);
    return Response.json({ deleted }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: { code: "INVALID_REQUEST", message: "Permintaan penghapusan tidak valid." } },
        { status: 400 },
      );
    }
    return apiError(error);
  }
}
