import { describe, expect, it } from "vitest";

import {
  settingsSectionForPath,
  settingsSections,
} from "../features/settings/settings-sections.ts";

describe("settings workspace navigation", () => {
  it("maps every settings URL to its client-local panel", () => {
    for (const section of settingsSections) {
      expect(settingsSectionForPath(section.href)).toBe(section.id);
    }
  });

  it("uses the account panel as a safe fallback", () => {
    expect(settingsSectionForPath("/settings/unknown")).toBe("account");
  });
});
