import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FirestorePublicRepository } from "../lib/repositories/firestore-public-repository";

function documentSnapshot(path: string, data: unknown) {
  return {
    ref: { path },
    data: () => data,
  };
}

describe("FirestorePublicRepository", () => {
  it("counts every immutable prediction for an event detail page", async () => {
    const event = {
      id: "event_1",
      slug: "event-one",
      slugHistory: [],
      status: "scheduled",
      predictionSummary: { totalPredictions: 0, uniquePredictors: 3 },
    };
    const fight = {
      id: "fight_1",
      slug: "fighter-a-vs-fighter-b",
      slugHistory: [],
      eventId: event.id,
      fighterAId: "fighter_a",
      fighterBId: "fighter_b",
    };
    const fighter = {
      id: "fighter_a",
      slug: "fighter-a",
      slugHistory: [],
      name: { full: "Fighter A", normalized: "fighter a" },
    };
    const predictionCountGet = vi.fn(() =>
      Promise.resolve({
        data: () => ({ count: 27 }),
      }),
    );

    const firestore = {
      collection: vi.fn((collectionName: string) => ({
        where: vi.fn((field: string, _operator: string, value: unknown) => {
          if (collectionName === "events" && field === "slug") {
            return {
              limit: () => ({
                get: () =>
                  Promise.resolve({
                    docs: [documentSnapshot("events/event_1", event)],
                  }),
              }),
            };
          }
          if (collectionName === "fights" && field === "eventId") {
            return {
              orderBy: () => ({
                get: () =>
                  Promise.resolve({
                    docs: [documentSnapshot("fights/fight_1", fight)],
                  }),
              }),
            };
          }
          if (collectionName === "fighters" && field === "upcomingEventIds") {
            return {
              get: () =>
                Promise.resolve({
                  docs: [documentSnapshot("fighters/fighter_a", fighter)],
                }),
            };
          }
          if (collectionName === "predictions" && field === "eventId") {
            expect(value).toBe(event.id);
            return {
              count: () => ({ get: predictionCountGet }),
            };
          }
          throw new Error(`Unexpected query: ${collectionName}.${field}`);
        }),
      })),
    } as unknown as Firestore;

    const repository = new FirestorePublicRepository(firestore);
    const card = await repository.getEventBySlug(event.slug);

    expect(card?.event.predictionSummary).toEqual({
      totalPredictions: 27,
      uniquePredictors: 3,
    });
    expect(predictionCountGet).toHaveBeenCalledOnce();
  });
});
