import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import { FirestoreLeaderboardRepository } from "./firestore-leaderboard-repository";
import { FixtureLeaderboardRepository } from "./fixture-leaderboard-repository";
import type { LeaderboardRepository } from "./leaderboard-repository";

let repository: LeaderboardRepository | undefined;

export function getLeaderboardRepository() {
  repository ??=
    process.env.FIGHTLOBBY_DATA_SOURCE === "firestore"
      ? new FirestoreLeaderboardRepository(getFirebaseAdmin().firestore)
      : new FixtureLeaderboardRepository();
  return repository;
}
