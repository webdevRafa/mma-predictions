import { describe, expect, it } from "vitest";

import {
  AVATAR_MAX_BYTES,
  assertAvatarMetadata,
  avatarStoragePath,
  nextAvatarVersion,
} from "@/lib/auth/avatar";
import { confirmAvatarSave } from "@/lib/auth/avatar-confirmation";

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

  it("retries a dropped confirmation response after the server saves", async () => {
    let attempts = 0;
    const saved = await confirmAvatarSave(
      () => {
        attempts += 1;
        if (attempts === 1)
          return Promise.reject(new Error("The server closed the connection"));
        return Promise.resolve(
          Response.json({
            photoURL: "https://example.test/avatar.webp?v=2",
            version: 2,
          }),
        );
      },
      { retryDelayMs: 0 },
    );

    expect(attempts).toBe(2);
    expect(saved.photoURL).toContain("avatar.webp?v=2");
  });

  it("does not retry a rejected avatar request", async () => {
    let attempts = 0;
    await expect(
      confirmAvatarSave(
        () => {
          attempts += 1;
          return Promise.resolve(
            Response.json(
              { error: { message: "Upload an avatar before saving it" } },
              { status: 400 },
            ),
          );
        },
        { retryDelayMs: 0 },
      ),
    ).rejects.toThrow("Upload an avatar before saving it");
    expect(attempts).toBe(1);
  });
});
