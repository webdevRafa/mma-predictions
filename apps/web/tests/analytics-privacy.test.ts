import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsParameters } from "../lib/analytics/events";
import {
  googleConsentValues,
  isConsentPreferences,
} from "../lib/privacy/consent";

describe("analytics privacy boundary", () => {
  it("drops PII-shaped and content parameters", () => {
    expect(
      sanitizeAnalyticsParameters({
        fight_id: "fgt_public_001",
        email: "member@example.test",
        message_body: "private chat text",
        handle: "public_but_personal",
        card_position: 3,
        broken: Number.NaN,
      }),
    ).toEqual({ fight_id: "fgt_public_001", card_position: 3 });
  });

  it("maps separate analytics and advertising choices to consent mode v2", () => {
    expect(
      googleConsentValues({ analytics: true, advertising: false }),
    ).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("rejects stale consent versions", () => {
    expect(
      isConsentPreferences({
        analytics: true,
        advertising: false,
        decidedAt: "2026-08-16T00:00:00.000Z",
        version: 0,
        source: "fightlobby",
      }),
    ).toBe(false);
  });
});
