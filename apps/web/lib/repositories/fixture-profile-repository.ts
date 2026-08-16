import { normalizeHandle, publicProfileSchema } from "@fightlobby/domain";

import fixture from "../../../../fixtures/profiles/fightdesk-demo.json";
import type { ProfileRepository } from "./profile-repository";

const profile = publicProfileSchema.parse(fixture);

export class FixtureProfileRepository implements ProfileRepository {
  listProfiles() {
    return Promise.resolve([structuredClone(profile)]);
  }

  getByHandle(handle: string) {
    const normalized = normalizeHandle(handle);
    const matches =
      profile.handleNormalized === normalized ||
      profile.handleHistory.includes(normalized);
    return Promise.resolve(matches ? structuredClone(profile) : null);
  }
}
