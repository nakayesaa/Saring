import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { getWorkspaceSession } from "@/lib/auth/session";
import { assertPermission, type Permission } from "@/lib/auth/permissions";
import { resolveWorkspacePrincipal } from "@/lib/auth/principal";
import { DomainError } from "@/lib/errors";
import { getAnalysisCallbackToken } from "@/lib/env";
import {
  ContractValidationError,
} from "@/lib/price-engine/validation";
import { PriceAnalysisNotFoundError } from "@/lib/price-engine/service";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class RequestPayloadTooLargeError extends Error {
  constructor() {
    super("Request payload exceeds the allowed size.");
    this.name = "RequestPayloadTooLargeError";
  }
}

export function validResourceId(value: string) {
  return ID_PATTERN.test(value);
}

export async function requireApiSession() {
  const session = await getWorkspaceSession();
  if (!session) {
    return { response: Response.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, { status: 401 }) } as const;
  }
  return { session } as const;
}

export async function requireTenantApiSession(permission?: Permission) {
  const auth = await requireApiSession();
  if ("response" in auth) return { response: auth.response } as const;
  try {
    const principal = await resolveWorkspacePrincipal(auth.session);
    if (permission) assertPermission(principal.role, permission);
    return { principal } as const;
  } catch (error) {
    if (error instanceof DomainError) {
      return { response: Response.json({ error: { code: error.code, message: error.message } }, { status: error.status }) } as const;
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { response: Response.json({ error: { code: "FORBIDDEN", message: "You do not have permission for this action." } }, { status: 403 }) } as const;
    }
    throw error;
  }
}

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json(
      { error: { code: "INVALID_ORIGIN", message: "Cross-origin mutation rejected." } },
      { status: 403 },
    );
  }
  return null;
}

export function requireWorkerRequest(request: Request) {
  const expected = getAnalysisCallbackToken();
  if (!expected) {
    return Response.json(
      { error: { code: "WORKER_CALLBACK_DISABLED", message: "Worker callbacks are not configured." } },
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  if (!provided || !timingSafeEqual(expectedHash, providedHash)) {
    return Response.json(
      { error: { code: "INVALID_WORKER_CREDENTIAL", message: "Worker authentication failed." } },
      { status: 401 },
    );
  }
  return null;
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new RequestPayloadTooLargeError();

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new RequestPayloadTooLargeError();
  }
  return JSON.parse(body) as unknown;
}

export function apiError(error: unknown) {
  if (error instanceof DomainError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof RequestPayloadTooLargeError) {
    return Response.json(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request is too large." } },
      { status: 413 },
    );
  }
  if (error instanceof PriceAnalysisNotFoundError) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Package not found." } }, { status: 404 });
  }
  if (error instanceof ContractValidationError) {
    return Response.json(
      { error: { code: error.code, message: "The analysis contract is invalid.", issues: error.issues } },
      { status: 422 },
    );
  }
  console.error("SARING API request failed", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Unable to process the analysis request." } },
    { status: 500 },
  );
}
