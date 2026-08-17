import type { PublicProfileStats } from "@fightlobby/domain";

export interface PrivateAccountView {
  email: string;
  emailVerified: boolean;
  handle: string;
  displayName: string;
  profileVisibility: "public" | "limited";
  accountStatus: string;
  stats: PublicProfileStats;
  preferences: {
    timezone: string;
    hideUpcomingPicks: boolean;
    emailEventReminders: boolean;
    emailResults: boolean;
  };
}
