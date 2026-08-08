import "server-only";

import { createHmac } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

function privacyHash(value: string | null | undefined) {
  const secret = process.env.AUDIT_HASH_SECRET;
  if (!value || !secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function recordAuditEvent(
  transaction: Prisma.TransactionClient,
  event: {
    organizationId: string;
    actorUserId?: string;
    packageId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  return transaction.auditEvent.create({
    data: {
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      packageId: event.packageId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata ?? {},
      ipHash: privacyHash(event.ipAddress),
      userAgentHash: privacyHash(event.userAgent),
    },
  });
}
