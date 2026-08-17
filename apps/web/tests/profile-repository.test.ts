import { describe, expect, it } from "vitest";

import { FixtureProfileRepository } from "../lib/repositories/fixture-profile-repository.ts";

describe("public profile repository", () => {
  const repository = new FixtureProfileRepository();

  it("resolves a canonical profile through an old handle", async () => {
    const profile = await repository.getByHandle("fightdesk");
    expect(profile?.handleNormalized).toBe("fightdesk_demo");
  });

  it("never serializes private identity fields", async () => {
    const profile = await repository.getByHandle("fightdesk_demo");
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("providerId");
    expect(serialized).not.toContain("preferences");
  });
});
