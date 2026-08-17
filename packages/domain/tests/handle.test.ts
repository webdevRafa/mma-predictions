import { describe, expect, it } from "vitest";

import { handleSchema, normalizeHandle } from "../src/identity/handle.ts";

describe("public handle rules", () => {
  it("normalizes valid handles to lowercase canonical storage", () => {
    expect(normalizeHandle("  Rafa_Picks ")).toBe("rafa_picks");
    expect(handleSchema.parse("Rafa_Picks")).toBe("rafa_picks");
  });

  it.each(["ab", "_rafa", "rafa__picks", "rafa-picks", "fightlobby", "ufc"])(
    "rejects invalid or reserved handle %s",
    (handle) => expect(handleSchema.safeParse(handle).success).toBe(false),
  );
});
