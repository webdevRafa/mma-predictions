import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import { FirestorePublicRepository } from "./firestore-public-repository";
import { FixturePublicRepository } from "./fixture-public-repository";
import type { PublicRepository } from "./public-repository";

let repository: PublicRepository | undefined;

export function getPublicRepository(): PublicRepository {
  if (repository) return repository;
  repository =
    process.env.FIGHTLOBBY_DATA_SOURCE === "firestore"
      ? new FirestorePublicRepository(getFirebaseAdmin().firestore)
      : new FixturePublicRepository();
  return repository;
}

export type { PublicRepository } from "./public-repository";
