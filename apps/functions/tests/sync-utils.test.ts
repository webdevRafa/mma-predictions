import { describe, expect, it } from "vitest";

import {
  EVENT_OVERRIDE_ROOTS,
  applyManualOverrides,
  checksum,
  changedFields,
} from "../src/ingestion/sync-utils.js";

describe("provider sync utilities", () => {
  it("applies only allowlisted manual overrides", () => {
    const merged = applyManualOverrides(
      { name: "Provider name", status: "scheduled", fightCount: 12 },
      {
        name: "Editor name",
        fightCount: 99,
        provider: { key: "attacker" },
      },
      EVENT_OVERRIDE_ROOTS,
    );
    expect(merged).toEqual({
      name: "Editor name",
      status: "scheduled",
      fightCount: 12,
    });
  });

  it("produces order-independent checksums and explicit diffs", () => {
    expect(checksum({ b: 2, a: 1 })).toBe(checksum({ a: 1, b: 2 }));
    expect(changedFields({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toEqual([
      "b",
      "c",
    ]);
  });
});
