import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { parseFirestoreProfile } from "../lib/repositories/firestore-profile-parser.ts";

describe("Firestore public profile parser", () => {
  it("projects public fields without rejecting internal profile metadata", () => {
    const timestamp = Timestamp.fromDate(new Date("2026-08-16T12:00:00Z"));
    const profile = parseFirestoreProfile("member-1", {
      uid: "member-1",
      handle: "rafa_picks",
      handleNormalized: "rafa_picks",
      handleHistory: [],
      handleChangedAt: timestamp,
      joinedAt: timestamp,
      stats: {
        gradedPicks: 0,
        correctWinners: 0,
        winnerAccuracy: 0,
        totalPoints: 0,
        exactPicks: 0,
        currentStreak: 0,
        longestStreak: 0,
        eventChampionships: 0,
      },
      badges: [],
      profileVisibility: "limited",
      updatedAt: timestamp,
    });

    expect(profile.handleNormalized).toBe("rafa_picks");
    expect(profile.joinedAt).toBe("2026-08-16T12:00:00.000Z");
    expect(profile).not.toHaveProperty("handleChangedAt");
  });
});
