"use client";

import { BellPlus, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function FollowButton({
  targetType,
  targetId,
}: {
  targetType: "event" | "fighter";
  targetId: string;
}) {
  const pathname = usePathname();
  const [following, setFollowing] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/follows")
      .then(async (response) => {
        if (!response.ok) return;
        setAuthenticated(true);
        const payload = (await response.json()) as {
          follows?: { targetType?: string; targetId?: string }[];
        };
        setFollowing(
          Boolean(
            payload.follows?.some(
              (follow) =>
                follow.targetType === targetType &&
                follow.targetId === targetId,
            ),
          ),
        );
      })
      .catch(() => undefined);
  }, [targetId, targetType]);

  async function toggle() {
    if (!authenticated) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/follows", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (response.ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      aria-pressed={following}
      className="focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-1 px-4 text-xs font-bold transition hover:border-fl-accent hover:text-fl-accent disabled:opacity-60"
      disabled={busy}
      onClick={toggle}
      type="button"
    >
      {following ? (
        <Check aria-hidden="true" size={15} />
      ) : (
        <BellPlus aria-hidden="true" size={15} />
      )}
      {following ? "Following" : `Follow ${targetType}`}
    </button>
  );
}
