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
    const boards = await this.firestore
      .collection("leaderboards")
      .orderBy("type")
      .limit(20)
      .get();
    return Promise.all(
      boards.docs.map(async (board) => {
        const entries = await board.ref
          .collection("entries")
          .orderBy("rank")
          .limit(100)
          .get();
        const boardValue: unknown = board.data();
        const boardData = record(boardValue);
        return leaderboardSchema.parse({
          ...boardData,
          startsAt: timestampToIso(boardData.startsAt),
          endsAt: timestampToIso(boardData.endsAt),
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
  }
}
