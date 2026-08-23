import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FirestoreLeaderboardRepository } from "../lib/repositories/firestore-leaderboard-repository";

const generatedAt = "2026-08-23T04:00:00.000Z";

function entry(uid: string, points: number) {
  return {
    uid,
    handle: `member_${uid}`,
    avatarVersion: 0,
    rank: 1,
    gradedPicks: 1,
    correctWinners: 1,
    rawAccuracy: 1,
    totalPoints: points,
    exactPicks: 0,
    currentStreak: 1,
    badges: [],
    updatedAt: generatedAt,
  };
}

function boardSnapshot(
  id: string,
  data: Record<string, unknown>,
  entries: Record<string, unknown>[] = [],
) {
  return {
    id,
    data: () => ({
      id,
      minimumPicks: 0,
      calculationVersion: 2,
      lastBuiltAt: generatedAt,
      ...data,
    }),
    ref: {
      collection: () => ({
        orderBy: () => ({
          limit: () => ({
            get: () =>
              Promise.resolve({
                docs: entries.map((value) => ({ data: () => value })),
              }),
          }),
        }),
      }),
    },
  };
}

describe("FirestoreLeaderboardRepository", () => {
  it("returns only completed event boards with the latest event first", async () => {
    const eventBoards = [
      boardSnapshot(
        "event_latest",
        { type: "event", label: "Latest", eventId: "latest" },
        [entry("latest", 10)],
      ),
      boardSnapshot(
        "event_older",
        { type: "event", label: "Older", eventId: "older" },
        [entry("older", 5)],
      ),
      boardSnapshot("event_scheduled", {
        type: "event",
        label: "Scheduled",
        eventId: "scheduled",
      }),
    ];
    const seasonBoards = [
      boardSnapshot(
        "season_2026_points",
        {
          type: "season_points",
          label: "2026 Season · Points",
          seasonId: "2026",
          minimumPicks: 1,
        },
        [entry("latest", 10)],
      ),
    ];
    const events = new Map([
      [
        "latest",
        {
          status: "completed",
          startsAt: "2026-08-23T00:00:00.000Z",
          completedAt: "2026-08-23T04:00:00.000Z",
        },
      ],
      [
        "older",
        {
          status: "completed",
          startsAt: "2026-08-16T00:00:00.000Z",
          completedAt: "2026-08-16T04:00:00.000Z",
        },
      ],
      [
        "scheduled",
        {
          status: "scheduled",
          startsAt: "2026-08-30T00:00:00.000Z",
        },
      ],
    ]);

    const firestore = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === "leaderboards") {
          return {
            where: (_field: string, operator: string) => ({
              limit: () => ({
                get: () =>
                  Promise.resolve({
                    docs: operator === "==" ? eventBoards : seasonBoards,
                  }),
              }),
            }),
          };
        }
        if (collectionName === "events") {
          return { doc: (id: string) => ({ id }) };
        }
        throw new Error(`Unexpected collection ${collectionName}`);
      }),
      getAll: vi.fn((...references: Array<{ id: string }>) =>
        Promise.resolve(
          references.map((reference) => ({
            id: reference.id,
            exists: events.has(reference.id),
            data: () => events.get(reference.id),
          })),
        ),
      ),
    } as unknown as Firestore;

    const repository = new FirestoreLeaderboardRepository(firestore);
    const boards = await repository.listBoards();

    expect(boards.map((board) => board.id)).toEqual([
      "event_latest",
      "event_older",
      "season_2026_points",
    ]);
    expect(boards[0]).toMatchObject({
      eventId: "latest",
      startsAt: "2026-08-23T00:00:00.000Z",
      endsAt: "2026-08-23T04:00:00.000Z",
    });
  });
});
