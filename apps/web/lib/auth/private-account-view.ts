export interface PrivateAccountView {
  email: string;
  emailVerified: boolean;
  handle: string;
  displayName: string;
  profileVisibility: "public" | "limited";
  accountStatus: string;
  preferences: {
    timezone: string;
    hideUpcomingPicks: boolean;
    emailEventReminders: boolean;
    emailResults: boolean;
  };
}
