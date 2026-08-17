import { publicProfileSchema, type PublicProfile } from "@fightlobby/domain";
import { Timestamp } from "firebase-admin/firestore";

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
}

export function parseFirestoreProfile(
  documentId: string,
  value: unknown,
): PublicProfile {
  if (!value || typeof value !== "object") {
    throw new Error(`Profile ${documentId} is not a valid object`);
  }
  const raw = value as Record<string, unknown>;

  return publicProfileSchema.parse({
    uid: typeof raw.uid === "string" ? raw.uid : documentId,
    handle: raw.handle,
    handleNormalized: raw.handleNormalized,
    handleHistory: raw.handleHistory,
    displayName: raw.displayName,
    avatar: raw.avatar,
    joinedAt: timestampToIso(raw.joinedAt),
    stats: raw.stats,
    rankSummary: raw.rankSummary,
    badges: raw.badges,
    profileVisibility: raw.profileVisibility,
    updatedAt: timestampToIso(raw.updatedAt),
  });
}
