"use client";

import { Check, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/events";

export function UserFollowButton({ targetUid }: { targetUid: string }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [following, setFollowing] = useState(false);
  const [self, setSelf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/follows?targetUid=${encodeURIComponent(targetUid)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          authenticated?: boolean;
          following?: boolean;
          self?: boolean;
        };
        setAuthenticated(payload.authenticated === true);
        setFollowing(payload.following === true);
        setSelf(payload.self === true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [targetUid]);

  if (self) return null;

  async function toggle() {
    if (!authenticated) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/follows", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Follow could not be updated",
        );
      if (!following)
        trackAnalyticsEvent("user_followed", { target_uid: targetUid });
      setFollowing((current) => !current);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Follow could not be updated",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
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
          <UserPlus aria-hidden="true" size={15} />
        )}
        {following ? "Following" : "Follow member"}
      </button>
      {error ? (
        <span className="text-xs text-fl-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
