import { describe, expect, it } from "vitest";

import { getAccountMenuPresentation } from "@/lib/auth/account-menu";

describe("account menu identity", () => {
  it("shows the public handle after onboarding", () => {
    expect(getAccountMenuPresentation("the_mma_pro")).toEqual({
      href: "/settings",
      label: "@the_mma_pro",
      title: "Account settings for @the_mma_pro",
      needsOnboarding: false,
    });
  });

  it("turns an incomplete account into a clear setup action", () => {
    expect(getAccountMenuPresentation(null)).toEqual({
      href: "/onboarding",
      label: "Finish setup",
      title: "Finish account setup",
      needsOnboarding: true,
    });
  });

  it("falls back safely when identity lookup is unavailable", () => {
    expect(getAccountMenuPresentation(null, true)).toEqual({
      href: "/settings",
      label: "Account",
      title: "Account settings",
      needsOnboarding: false,
    });
  });
});
