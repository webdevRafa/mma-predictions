export const BRAND = {
  name: "FightLobby",
  tagline: "Every fight has a lobby.",
  actionLine: "Make your pick. Join the lobby.",
} as const;

export * from "./normalization/slug";
export * from "./schemas/domain";
export * from "./schemas/fixture";
export * from "./types/domain";
export * from "./validation/fixture";
