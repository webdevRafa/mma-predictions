import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FirestorePredictionHistoryRepository } from "../lib/repositories/firestore-prediction-history-repository";

function snapshot(id: string, data: Record<string, unknown>) {
  return {
    id,
    exists: true,
    data: () => data,
  };
}

function fakeFirestore() {
  const fights = {
    fight_1: snapshot("fight_1", {
      slug: "fighter-a-vs-fighter-b",
      boutOrder: 1,
      fighterAId: "fighter_a",
      fighterBId: "fighter_b",
      fighterA: { name: { full: "Fighter A" } },
      fighterB: { name: { full: "Fighter B" } },
      result: {
        winnerFighterId: "fighter_a",
        method: "ko_tko",
        round: 2,
      },
    }),
  };
  const events = {
    event_1: snapshot("event_1", {
      name: "UFC Test: A vs B",
      shortName: "A vs B",
      slug: "ufc-test-a-vs-b",
      startsAt: "2026-08-22T00:00:00.000Z",
      status: "completed",
    }),
  };
  const privatePredictions = [
    snapshot("fight_1_user_1", {
      fightId: "fight_1",
      eventId: "event_1",
      uid: "user_1",
      pick: {
        winnerFighterId: "fighter_a",
        method: "ko_tko",
        detail: 2,
      },
      status: "graded",
      grade: { points: 10, winnerCorrect: true },
    }),
  ];
  const publicPicks = [
    snapshot("fight_1", {
      fightId: "fight_1",
      eventId: "event_1",
      fightSlug: "fighter-a-vs-fighter-b",
      fighterAName: "Fighter A",
      fighterBName: "Fighter B",
      selectedWinnerFighterId: "fighter_a",
      selectedWinnerName: "Fighter A",
      method: "ko_tko",
      detail: 2,
      status: "graded",
      points: 10,
    }),
  ];

  function reference(collectionName: string, id: string) {
    return { collectionName, id };
  }

  return {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === "predictions")
        return {
          where: () => ({
            limit: () => ({
              get: () => Promise.resolve({ docs: privatePredictions }),
            }),
          }),
        };
      if (collectionName === "profiles")
        return {
          doc: () => ({
            collection: () => ({
              limit: () => ({
                get: () => Promise.resolve({ docs: publicPicks }),
              }),
            }),
          }),
        };
      return { doc: (id: string) => reference(collectionName, id) };
    }),
    getAll: vi.fn((...references: { collectionName: string; id: string }[]) =>
      Promise.resolve(
        references.map((item) =>
          item.collectionName === "fights"
            ? fights[item.id as keyof typeof fights]
            : events[item.id as keyof typeof events],
        ),
      ),
    ),
  } as unknown as Firestore;
}

describe("FirestorePredictionHistoryRepository", () => {
  it("hydrates private predictions with matchup, event, result, and score", async () => {
    const repository = new FirestorePredictionHistoryRepository(
      fakeFirestore(),
    );
    const history = await repository.getPrivateHistory("user_1");

    expect(history.events.map((event) => event.shortName)).toEqual(["A vs B"]);
    expect(history.entries[0]).toMatchObject({
      fighterAName: "Fighter A",
      fighterBName: "Fighter B",
      selectedWinnerName: "Fighter A",
      resultSummary: "Fighter A · KO/TKO · Round 2",
      points: 10,
      winnerCorrect: true,
    });
  });

  it("uses only post-lock public pick documents for a public profile", async () => {
    const repository = new FirestorePredictionHistoryRepository(
      fakeFirestore(),
    );
    const history = await repository.getPublicHistory("user_1");

    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]?.status).toBe("graded");
    expect(history.entries[0]?.selectedWinnerName).toBe("Fighter A");
  });
});
