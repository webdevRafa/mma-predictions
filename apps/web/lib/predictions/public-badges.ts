import {
  parseStoredPredictionPick,
  type PublicPredictionBadge,
} from "@fightlobby/domain";
import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function fighterLastName(value: unknown) {
  const fighter = record(value);
  const name = record(fighter.name);
  if (typeof name.last === "string" && name.last.trim())
    return name.last.trim();
  if (typeof name.full !== "string") return null;
  const parts = name.full.trim().split(/\s+/u).filter(Boolean);
  return parts.at(-1) ?? null;
}

function publicBadge(
  prediction: DocumentSnapshot,
  fight: DocumentSnapshot,
): PublicPredictionBadge | null {
  if (!prediction.exists || !fight.exists) return null;
  const status: unknown = prediction.get("status");
  if (!new Set(["locked", "graded", "void"]).has(String(status))) return null;
  const pick = parseStoredPredictionPick(prediction.get("pick"));
  if (!pick) return null;
  const fightData = record(fight.data());
  const fighter =
    pick.winnerFighterId === fightData.fighterAId
      ? fightData.fighterA
      : pick.winnerFighterId === fightData.fighterBId
        ? fightData.fighterB
        : null;
  const winnerLastName = fighterLastName(fighter);
  if (!winnerLastName) return null;
  return {
    winnerFighterId: pick.winnerFighterId,
    winnerLastName,
    method: pick.method,
  };
}

export async function getPublicPredictionBadges(
  firestore: Firestore,
  fightId: string,
  uidValues: readonly string[],
) {
  const uids = [...new Set(uidValues.filter(Boolean))];
  const badges = new Map<string, PublicPredictionBadge>();
  if (uids.length === 0) return badges;
  const fight = await firestore.collection("fights").doc(fightId).get();
  if (!fight.exists) return badges;

  for (let offset = 0; offset < uids.length; offset += 100) {
    const chunk = uids.slice(offset, offset + 100);
    const predictions = await firestore.getAll(
      ...chunk.map((uid) =>
        firestore.collection("predictions").doc(`${fightId}_${uid}`),
      ),
    );
    predictions.forEach((prediction, index) => {
      const badge = publicBadge(prediction, fight);
      const uid = chunk[index];
      if (badge && uid) badges.set(uid, badge);
    });
  }
  return badges;
}

export async function getPublicPredictionBadge(
  firestore: Firestore,
  fightId: string,
  uid: string,
) {
  return (await getPublicPredictionBadges(firestore, fightId, [uid])).get(uid);
}
