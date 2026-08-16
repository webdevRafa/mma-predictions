import { describe, expect, it } from "vitest";

import { moderateChatBody, normalizeChatBody } from "../src/index.ts";

describe("chat moderation normalization", () => {
  it("normalizes Unicode and whitespace without breaking emoji", () => {
    expect(normalizeChatBody("  Ｆight\n\t night 👩‍💻  ")).toBe("Fight night 👩‍💻");
  });

  it("masks mild profanity and records a soft flag", () => {
    expect(moderateChatBody("That was damn close")).toMatchObject({
      accepted: true,
      body: "That was d••• close",
      decision: "soft_flagged",
      signals: ["mild_profanity_masked"],
    });
  });

  it.each([
    ["https://spam.example", "url"],
    ["go go go go go go", "spam"],
    ["kill yourself", "prohibited"],
  ])("rejects unsafe text: %s", (body, code) => {
    expect(moderateChatBody(body)).toMatchObject({ accepted: false, code });
  });
});
