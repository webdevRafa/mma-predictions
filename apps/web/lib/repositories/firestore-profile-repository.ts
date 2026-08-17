import "server-only";

import { normalizeHandle } from "@fightlobby/domain";
import {
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { parseFirestoreProfile } from "./firestore-profile-parser";
import type { ProfileRepository } from "./profile-repository";

function parseProfile(snapshot: QueryDocumentSnapshot<DocumentData>) {
  return parseFirestoreProfile(snapshot.id, snapshot.data());
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
    return parseFirestoreProfile(profile.id, profile.data());
  }
}
