import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { customClaimRoles, hasMatchingRole } from "../lib/admin/auth";

describe("admin authorization", () => {
  it("requires the private account role and Firebase custom claim to agree", () => {
    expect(hasMatchingRole(["admin"], { roles: ["admin"] }, ["admin"])).toBe(
      true,
    );
    expect(hasMatchingRole(["admin"], { roles: ["member"] }, ["admin"])).toBe(
      false,
    );
    expect(hasMatchingRole(["member"], { admin: true }, ["admin"])).toBe(false);
  });

  it("accepts explicit boolean claims while normalizing role arrays", () => {
    expect(
      customClaimRoles({ admin: true, roles: ["member", "invalid"] }),
    ).toEqual(["member", "admin"]);
  });
});
