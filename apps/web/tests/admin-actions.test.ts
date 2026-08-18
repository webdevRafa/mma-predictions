import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { adminActionSchema, confirmationFor } from "../lib/admin/actions";

describe("admin action validation", () => {
  it("accepts an audited event completion override", () => {
    const input = {
      action: "update_event",
      eventId: "evt_test_001",
      patch: { status: "completed" },
      reason:
        "Final bout concluded; event marked complete by live administrator",
      confirmation: "UPDATE evt_test_001",
      returnTo: "/admin/events/evt_test_001",
    };
    const parsed = adminActionSchema.parse(input);
    expect(confirmationFor(parsed)).toBe("UPDATE evt_test_001");
  });

  it("requires a reason and confirmation for emergency controls", () => {
    const input = {
      action: "prediction_control",
      fightId: "fgt_test_001",
      operation: "lock",
      reason: "Event operations requested an emergency lock",
      confirmation: "LOCK fgt_test_001",
    };
    const parsed = adminActionSchema.parse(input);
    expect(confirmationFor(parsed)).toBe("LOCK fgt_test_001");
    expect(adminActionSchema.safeParse({ ...input, reason: "" }).success).toBe(
      false,
    );
  });

  it("rejects arbitrary feature flag keys", () => {
    expect(
      adminActionSchema.safeParse({
        action: "feature_flags",
        patch: { arbitraryRemoteCode: true },
        reason: "Attempt to add an unsupported flag",
        confirmation: "UPDATE FEATURE FLAGS",
      }).success,
    ).toBe(false);
  });

  it("validates editorial updates and blocks protocol-relative returns", () => {
    const update = {
      action: "update_fight",
      fightId: "fgt_test_001",
      patch: {
        biggestQuestion: "Can the pressure fighter safely close the distance?",
        keysForFighterA: ["Establish range before the first exchange"],
        editorialStatus: "reviewed",
      },
      reason: "Editorial review is complete for the featured matchup",
      confirmation: "UPDATE fgt_test_001",
      returnTo: "/admin/fights/fgt_test_001",
    };
    expect(adminActionSchema.safeParse(update).success).toBe(true);
    expect(
      adminActionSchema.safeParse({ ...update, returnTo: "//example.com" })
        .success,
    ).toBe(false);
  });

  it("requires distinct fighter IDs for an identity merge", () => {
    const merge = {
      action: "merge_fighters",
      primaryFighterId: "ftr_primary",
      duplicateFighterId: "ftr_primary",
      reason: "Identity review confirmed these records are duplicates",
      confirmation: "MERGE ftr_primary INTO ftr_primary",
    };
    expect(adminActionSchema.safeParse(merge).success).toBe(false);
  });
});
