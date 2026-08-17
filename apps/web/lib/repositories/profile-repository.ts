import type { PublicProfile } from "@fightlobby/domain";

export interface ProfileRepository {
  listProfiles(): Promise<PublicProfile[]>;
  getByHandle(handle: string): Promise<PublicProfile | null>;
}
