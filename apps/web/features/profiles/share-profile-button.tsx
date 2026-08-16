"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/events";

export function ShareProfileButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const nativeShare = (
      navigator as unknown as {
        share?: (data: ShareData) => Promise<void>;
      }
    ).share?.bind(navigator);
    try {
      if (nativeShare) {
        await nativeShare({ title: `${label} on FightLobby`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2_000);
      }
      trackAnalyticsEvent("profile_shared", {
        method: nativeShare ? "native" : "clipboard",
      });
    } catch {
      // Closing the native share sheet is not an error the page needs to show.
    }
  }

  return (
    <button
      className="focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-1 px-4 text-xs font-bold hover:border-fl-accent hover:text-fl-accent"
      onClick={share}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" size={15} />
      ) : (
        <Share2 aria-hidden="true" size={15} />
      )}
      {copied ? "Link copied" : "Share profile"}
    </button>
  );
}
