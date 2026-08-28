import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { serializeFirestoreValue } from "../lib/repositories/firestore-serialization.ts";

describe("Firestore server-to-client serialization", () => {
  it("converts nested timestamps into plain ISO strings", () => {
    const value = serializeFirestoreValue({
      predictionSummary: {
        total: 1,
        lastAggregatedAt: Timestamp.fromDate(new Date("2026-08-16T21:00:00Z")),
      },
    });

    expect(value).toEqual({
      predictionSummary: {
        total: 1,
        lastAggregatedAt: "2026-08-16T21:00:00.000Z",
      },
    });
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });
});
