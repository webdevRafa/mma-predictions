import { describe, expect, it } from "vitest";

import { BRAND } from "../src/index";

describe("FightLobby brand contract", () => {
  it("keeps the canonical public name and tagline", () => {
    expect(BRAND.name).toBe("FightLobby");
    expect(BRAND.tagline).toBe("Every fight has a lobby.");
  });
});
