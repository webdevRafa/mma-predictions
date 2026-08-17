import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";

function serializable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, serializable(item)]),
    );
  return value;
}

export interface AdminAuditInput {
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export function adminAuditData(input: AdminAuditInput) {
  return {
    category: "admin",
    actorUid: input.actorUid,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    ...(input.before !== undefined
      ? { before: serializable(input.before) }
      : {}),
    ...(input.after !== undefined ? { after: serializable(input.after) } : {}),
    ...(input.metadata !== undefined
      ? { metadata: serializable(input.metadata) }
      : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
}

export async function writeAdminAudit(
  firestore: Firestore,
  input: AdminAuditInput,
) {
  const reference = firestore.collection("auditLogs").doc();
  await reference.set({ id: reference.id, ...adminAuditData(input) });
  return reference.id;
}
