import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  assertAvatarMetadata,
  avatarStoragePath,
  nextAvatarVersion,
} from "@/lib/auth/avatar";

describe("member avatars", () => {
  it("uses one deterministic object per member", () => {
    expect(avatarStoragePath("member_a")).toBe("avatars/member_a/avatar.webp");
  });

  it("accepts only non-empty WebP output under the storage limit", () => {
    expect(() =>
      assertAvatarMetadata({ contentType: "image/webp", size: "4096" }),
    ).not.toThrow();
    expect(() =>
      assertAvatarMetadata({ contentType: "image/png", size: 4096 }),
    ).toThrowError(/WebP/);
    expect(() =>
      assertAvatarMetadata({
        contentType: "image/webp",
        size: AVATAR_MAX_BYTES + 1,
      }),
    ).toThrowError(/smaller than 1 MB/);
  });

  it("increments valid versions and repairs malformed values", () => {
    expect(nextAvatarVersion(undefined)).toBe(1);
    expect(nextAvatarVersion({ version: 4 })).toBe(5);
    expect(nextAvatarVersion({ version: -1 })).toBe(1);
    expect(nextAvatarVersion({ version: "4" })).toBe(5);
  });
});
