import "server-only";

import {
  parseStoredPredictionPick,
  type PredictionPick,
} from "@fightlobby/domain";
import type {
  DocumentData,
  DocumentSnapshot,
  Firestore,
} from "firebase-admin/firestore";

import type {
  PredictionHistory,
  PredictionHistoryEntry,
  PredictionHistoryEvent,
  PredictionHistoryStatus,
} from "@/features/profiles/prediction-history-types";

import { serializeFirestoreValue } from "./firestore-serialization";
import type { PredictionHistoryRepository } from "./prediction-history-repository";

const HISTORY_LIMIT = 500;
const READ_BATCH_SIZE = 100;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function statusValue(value: unknown): PredictionHistoryStatus | null {
  return ["active", "locked", "graded", "void"].includes(String(value))
    ? (value as PredictionHistoryStatus)
    : null;
}

function fighterName(value: unknown) {
  return stringValue(record(record(value).name).full, "Unknown fighter");
}

function resultMethodLabel(method: unknown) {
  return (
    (
      {
        ko_tko: "KO/TKO",
        submission: "Submission",
        decision_unanimous: "Unanimous decision",
        decision_split: "Split decision",
        decision_majority: "Majority decision",
        dq: "Disqualification",
        draw: "Draw",
        no_contest: "No contest",
        overturned: "Result overturned",
        other: "Official result",
      } as Record<string, string>
    )[String(method)] ?? "Official result"
  );
}

function resultSummary(fight: Record<string, unknown>) {
  const result = record(fight.result);
  if (!result.method) return "Awaiting official result";
  const method = resultMethodLabel(result.method);
  const winnerId = stringValue(result.winnerFighterId);
  if (!winnerId) return method;
  const winnerName =
    winnerId === fight.fighterAId
      ? fighterName(fight.fighterA)
      : winnerId === fight.fighterBId
        ? fighterName(fight.fighterB)
        : "Winner";
  const round =
    typeof result.round === "number" &&
    ["ko_tko", "submission", "dq", "other"].includes(String(result.method))
      ? ` · Round ${result.round}`
      : "";
  return `${winnerName} · ${method}${round}`;
}

function winnerCorrect(
  selectedWinnerFighterId: string,
  fight: Record<string, unknown>,
) {
  const winnerFighterId = record(fight.result).winnerFighterId;
  return typeof winnerFighterId === "string"
    ? selectedWinnerFighterId === winnerFighterId
    : undefined;
}

async function readDocuments(
  firestore: Firestore,
  collectionName: string,
  ids: string[],
) {
  const snapshots = new Map<string, DocumentSnapshot<DocumentData>>();
  for (let index = 0; index < ids.length; index += READ_BATCH_SIZE) {
    const chunk = ids.slice(index, index + READ_BATCH_SIZE);
    const documents = await firestore.getAll(
      ...chunk.map((id) => firestore.collection(collectionName).doc(id)),
    );
    documents.forEach((document) => snapshots.set(document.id, document));
  }
  return snapshots;
}

interface RawHistoryPick {
  fightId: string;
  eventId: string;
  fightSlug?: string;
  fighterAName?: string;
  fighterBName?: string;
  selectedWinnerFighterId: string;
  selectedWinnerName?: string;
  pick: PredictionPick;
  status: PredictionHistoryStatus;
  points?: number;
  winnerCorrect?: boolean;
}

function parsePrivatePick(value: unknown): RawHistoryPick | null {
  const source = record(serializeFirestoreValue(value));
  const pick = parseStoredPredictionPick(source.pick);
  const fightId = stringValue(source.fightId);
  const eventId = stringValue(source.eventId);
  const status = statusValue(source.status);
  if (!pick || !fightId || !eventId || !status) return null;
  const grade = record(source.grade);
  return {
    fightId,
    eventId,
    selectedWinnerFighterId: pick.winnerFighterId,
    pick,
    status,
    ...(status === "graded" ? { points: numberValue(grade.points) } : {}),
    ...(typeof grade.winnerCorrect === "boolean"
      ? { winnerCorrect: grade.winnerCorrect }
      : {}),
  };
}

function parsePublicPick(value: unknown): RawHistoryPick | null {
  const source = record(serializeFirestoreValue(value));
  const fightId = stringValue(source.fightId);
  const eventId = stringValue(source.eventId);
  const selectedWinnerFighterId = stringValue(source.selectedWinnerFighterId);
  const pick = parseStoredPredictionPick({
    winnerFighterId: selectedWinnerFighterId,
    method: source.method,
    ...(source.detail !== undefined ? { detail: source.detail } : {}),
  });
  const status = statusValue(source.status);
  if (!fightId || !eventId || !pick || !status || status === "active")
    return null;
  return {
    fightId,
    eventId,
    ...(stringValue(source.fightSlug)
      ? { fightSlug: stringValue(source.fightSlug) }
      : {}),
    ...(stringValue(source.fighterAName)
      ? { fighterAName: stringValue(source.fighterAName) }
      : {}),
    ...(stringValue(source.fighterBName)
      ? { fighterBName: stringValue(source.fighterBName) }
      : {}),
    selectedWinnerFighterId,
    ...(stringValue(source.selectedWinnerName)
      ? { selectedWinnerName: stringValue(source.selectedWinnerName) }
      : {}),
    pick,
    status,
    ...(status === "graded" ? { points: numberValue(source.points) } : {}),
  };
}

export class FirestorePredictionHistoryRepository implements PredictionHistoryRepository {
  constructor(private readonly firestore: Firestore) {}

  async getPrivateHistory(uid: string) {
    const snapshot = await this.firestore
      .collection("predictions")
      .where("uid", "==", uid)
      .limit(HISTORY_LIMIT)
      .get();
    return this.hydrate(
      snapshot.docs.flatMap((document) => {
        const pick = parsePrivatePick(document.data());
        return pick ? [pick] : [];
      }),
    );
  }

  async getPublicHistory(uid: string) {
    const snapshot = await this.firestore
      .collection("profiles")
      .doc(uid)
      .collection("publicPicks")
      .limit(HISTORY_LIMIT)
      .get();
    return this.hydrate(
      snapshot.docs.flatMap((document) => {
        const pick = parsePublicPick(document.data());
        return pick ? [pick] : [];
      }),
    );
  }

  private async hydrate(
    rawPicks: RawHistoryPick[],
  ): Promise<PredictionHistory> {
    if (rawPicks.length === 0) return { events: [], entries: [] };
    const fightIds = [...new Set(rawPicks.map((pick) => pick.fightId))];
    const eventIds = [...new Set(rawPicks.map((pick) => pick.eventId))];
    const [fightDocuments, eventDocuments] = await Promise.all([
      readDocuments(this.firestore, "fights", fightIds),
      readDocuments(this.firestore, "events", eventIds),
    ]);

    const eventMap = new Map<string, PredictionHistoryEvent>();
    eventDocuments.forEach((document, id) => {
      if (!document.exists) return;
      const source = record(serializeFirestoreValue(document.data()));
      const startsAt = stringValue(source.startsAt);
      const name = stringValue(source.name, "UFC event");
      eventMap.set(id, {
        id,
        name,
        shortName: stringValue(source.shortName, name),
        slug: stringValue(source.slug),
        startsAt,
        status: stringValue(source.status, "scheduled"),
      });
    });

    const entries = rawPicks.flatMap<PredictionHistoryEntry>((rawPick) => {
      const fightDocument = fightDocuments.get(rawPick.fightId);
      const event = eventMap.get(rawPick.eventId);
      if (!fightDocument?.exists || !event) return [];
      const fight = record(serializeFirestoreValue(fightDocument.data()));
      const fighterAName = rawPick.fighterAName ?? fighterName(fight.fighterA);
      const fighterBName = rawPick.fighterBName ?? fighterName(fight.fighterB);
      const selectedWinnerName =
        rawPick.selectedWinnerName ??
        (rawPick.selectedWinnerFighterId === fight.fighterAId
          ? fighterAName
          : rawPick.selectedWinnerFighterId === fight.fighterBId
            ? fighterBName
            : "Unknown fighter");
      const correct =
        rawPick.winnerCorrect ??
        winnerCorrect(rawPick.selectedWinnerFighterId, fight);
      return [
        {
          fightId: rawPick.fightId,
          fightSlug: rawPick.fightSlug ?? stringValue(fight.slug),
          eventId: rawPick.eventId,
          eventName: event.name,
          eventShortName: event.shortName,
          eventSlug: event.slug,
          eventStartsAt: event.startsAt,
          boutOrder: numberValue(fight.boutOrder),
          fighterAName,
          fighterBName,
          selectedWinnerName,
          method: rawPick.pick.method,
          ...(rawPick.pick.detail !== undefined
            ? { detail: rawPick.pick.detail }
            : {}),
          status: rawPick.status,
          ...(rawPick.points !== undefined ? { points: rawPick.points } : {}),
          ...(correct !== undefined ? { winnerCorrect: correct } : {}),
          resultSummary: resultSummary(fight),
        },
      ];
    });

    const events = [...eventMap.values()]
      .filter((event) => entries.some((entry) => entry.eventId === event.id))
      .sort(
        (left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt),
      );
    entries.sort((left, right) => {
      const eventOrder =
        Date.parse(right.eventStartsAt) - Date.parse(left.eventStartsAt);
      return eventOrder || left.boutOrder - right.boutOrder;
    });
    return { events, entries };
  }
}
