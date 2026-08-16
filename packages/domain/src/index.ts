export const BRAND = {
  name: "FightLobby",
  tagline: "Every fight has a lobby.",
  actionLine: "Make your pick. Join the lobby.",
} as const;

export * from "./normalization/slug.ts";
export * from "./identity/handle.ts";
export * from "./leaderboards/badges.ts";
export * from "./leaderboards/ranking.ts";
export * from "./leaderboards/streak.ts";
export * from "./predictions/validation.ts";
export * from "./scoring/prediction.ts";
export * from "./schemas/domain.ts";
export * from "./schemas/fixture.ts";
export * from "./schemas/identity.ts";
export * from "./schemas/leaderboard.ts";
export * from "./types/domain.ts";
export * from "./validation/fixture.ts";
