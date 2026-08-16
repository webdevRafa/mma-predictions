export const BRAND = {
  name: "FightLobby",
  tagline: "Every fight has a lobby.",
  actionLine: "Make your pick. Join the lobby.",
} as const;

export * from "./normalization/slug.js";
export * from "./schemas/domain.js";
export * from "./schemas/fixture.js";
export * from "./types/domain.js";
export * from "./validation/fixture.js";
