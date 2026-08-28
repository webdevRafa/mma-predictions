import { leaderboardSchema, type Leaderboard } from "@fightlobby/domain";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import type { LeaderboardRepository } from "./leaderboard-repository";

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : value;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export class FirestoreLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly firestore: Firestore) {}

  async listBoards(): Promise<Leaderboard[]> {
    const [eventBoards, seasonBoards] = await Promise.all([
      this.firestore
        .collection("leaderboards")
        .where("type", "==", "event")
        .limit(100)
        .get(),
      this.firestore
        .collection("leaderboards")
        .where("type", "in", ["season_points", "season_accuracy", "streak"])
        .limit(30)
        .get(),
    ]);
    const boards = [...eventBoards.docs, ...seasonBoards.docs];
    const eventIds = [
      ...new Set(
        eventBoards.docs.flatMap((board) => {
          const eventId = record(board.data()).eventId;
          return typeof eventId === "string" ? [eventId] : [];
        }),
      ),
    ];
    const eventSnapshots =
      eventIds.length > 0
        ? await this.firestore.getAll(
            ...eventIds.map((eventId) =>
              this.firestore.collection("events").doc(eventId),
            ),
          )
        : [];
    const completedEvents = new Map(
      eventSnapshots.flatMap((event) => {
        const data = record(event.data());
        return event.exists && data.status === "completed"
          ? [[event.id, data] as const]
          : [];
      }),
    );
    const parsed = await Promise.all(
      boards.map(async (board) => {
        const boardValue: unknown = board.data();
        const boardData = record(boardValue);
        const eventId = boardData.eventId;
        const event =
          boardData.type === "event" && typeof eventId === "string"
            ? completedEvents.get(eventId)
            : undefined;
        if (boardData.type === "event" && !event) return null;
        const entries = await board.ref
          .collection("entries")
          .orderBy("rank")
          .limit(100)
          .get();
        return leaderboardSchema.parse({
          ...boardData,
          startsAt: timestampToIso(event?.startsAt ?? boardData.startsAt),
          endsAt: timestampToIso(event?.completedAt ?? boardData.endsAt),
          lastBuiltAt: timestampToIso(boardData.lastBuiltAt),
          entries: entries.docs.map((entry) => {
            const entryValue: unknown = entry.data();
            const entryData = record(entryValue);
            return {
              ...entryData,
              updatedAt: timestampToIso(entryData.updatedAt),
            };
          }),
        });
      }),
    );
    return parsed
      .filter((board): board is Leaderboard => board !== null)
      .sort((left, right) => {
        if (left.type === "event" && right.type === "event") {
          return (
            Date.parse(right.startsAt ?? "1970-01-01T00:00:00.000Z") -
            Date.parse(left.startsAt ?? "1970-01-01T00:00:00.000Z")
          );
        }
        if (left.type === "event") return -1;
        if (right.type === "event") return 1;
        return (
          String(right.seasonId ?? "").localeCompare(
            String(left.seasonId ?? ""),
          ) || left.type.localeCompare(right.type)
        );
      });
  }
}
