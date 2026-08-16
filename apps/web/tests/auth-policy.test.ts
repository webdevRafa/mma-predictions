import { describe, expect, it } from "vitest";

import { assertMutationAllowed } from "../lib/auth/policy.ts";
import { safeReturnPath } from "../lib/auth/return-path.ts";

describe("account mutation policy", () => {
  it.each(["active", "muted"] as const)(
    "allows %s accounts to use non-chat mutations",
    (status) => expect(() => assertMutationAllowed(status)).not.toThrow(),
  );

  it.each(["suspended", "banned", "deleted"] as const)(
    "denies %s accounts",
    (status) =>
      expect(() => assertMutationAllowed(status)).toThrow(
        "This account cannot make changes",
      ),
  );
});

describe("authentication return paths", () => {
  it("preserves safe local draft destinations", () => {
    expect(safeReturnPath("/fights/example?pick=asha#prediction")).toBe(
      "/fights/example?pick=asha#prediction",
    );
  });

  it.each([
    "https://attacker.example/steal",
    "//attacker.example/steal",
    "javascript:alert(1)",
  ])("rejects external destination %s", (destination) => {
    expect(safeReturnPath(destination)).toBe("/");
  });
});
