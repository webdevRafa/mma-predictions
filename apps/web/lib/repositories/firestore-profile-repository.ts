import "server-only";

import {
  normalizeHandle,
  publicProfileSchema,
  type PublicProfile,
} from "@fightlobby/domain";
import {
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import type { ProfileRepository } from "./profile-repository";

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  return value;
}

function parseProfile(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): PublicProfile {
  const value: unknown = snapshot.data();
  if (!value || typeof value !== "object") {
    throw new Error(`Profile ${snapshot.id} is not a valid object`);
  }
  const raw = value as Record<string, unknown>;
  return publicProfileSchema.parse({
    ...raw,
    joinedAt: timestampToIso(raw.joinedAt),
    updatedAt: timestampToIso(raw.updatedAt),
  });
}

export class FirestoreProfileRepository implements ProfileRepository {
  constructor(private readonly firestore: Firestore) {}

  async listProfiles() {
    const snapshot = await this.firestore
      .collection("profiles")
      .where("profileVisibility", "in", ["public", "limited"])
      .where("stats.gradedPicks", ">=", 5)
      .orderBy("stats.gradedPicks", "desc")
      .limit(250)
      .get();
    return snapshot.docs.map(parseProfile);
  }

  async getByHandle(handle: string) {
    const normalized = normalizeHandle(handle);
    const direct = await this.firestore
      .collection("profiles")
      .where("handleNormalized", "==", normalized)
      .limit(1)
      .get();
    if (direct.docs[0]) return parseProfile(direct.docs[0]);

    const reservation = await this.firestore
      .collection("handles")
      .doc(normalized)
      .get();
    const uid: unknown = reservation.get("uid");
    if (typeof uid !== "string") return null;
    const profile = await this.firestore.collection("profiles").doc(uid).get();
    if (!profile.exists) return null;
    const value: unknown = profile.data();
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    return publicProfileSchema.parse({
      ...raw,
      joinedAt: timestampToIso(profile.get("joinedAt")),
      updatedAt: timestampToIso(profile.get("updatedAt")),
    });
  }
}
