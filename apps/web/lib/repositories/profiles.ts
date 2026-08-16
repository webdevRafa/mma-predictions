import "server-only";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

import { FirestoreProfileRepository } from "./firestore-profile-repository";
import { FixtureProfileRepository } from "./fixture-profile-repository";
import type { ProfileRepository } from "./profile-repository";

let profileRepository: ProfileRepository | undefined;

export function getProfileRepository(): ProfileRepository {
  if (profileRepository) return profileRepository;
  profileRepository =
    process.env.FIGHTLOBBY_DATA_SOURCE === "firestore"
      ? new FirestoreProfileRepository(getFirebaseAdmin().firestore)
      : new FixtureProfileRepository();
  return profileRepository;
}
