"use client";

import { openPrivacyChoices } from "@/features/privacy/consent-provider";

export function PrivacyChoicesButton() {
  return (
    <button
      className="focus-ring cursor-pointer rounded hover:text-fl-text"
      onClick={openPrivacyChoices}
      type="button"
    >
      Privacy choices
    </button>
  );
}
