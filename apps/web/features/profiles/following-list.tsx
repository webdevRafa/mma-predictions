"use client";

import { UserMinus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface FollowedMember {
  uid: string;
  handle: string;
  displayName?: string;
}

export function FollowingList() {
  const [members, setMembers] = useState<FollowedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/follows", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          follows?: FollowedMember[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(
            payload.error?.message ?? "Following could not be loaded",
          );
        setMembers(payload.follows ?? []);
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Following could not be loaded",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function unfollow(member: FollowedMember) {
    setError(null);
    const response = await fetch("/api/follows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUid: member.uid }),
    });
    if (!response.ok) {
      setError("That member could not be unfollowed. Try again.");
      return;
    }
    setMembers((current) => current.filter(({ uid }) => uid !== member.uid));
  }

  if (loading)
    return (
      <p className="p-5 text-sm text-fl-text-muted sm:p-6">Loading members…</p>
    );
  return (
    <div className="p-5 sm:p-6">
      {error ? (
        <p
          className="mb-4 rounded-lg border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fl-border bg-fl-surface-2 p-6 text-center">
          <UsersRound
            aria-hidden="true"
            className="mx-auto text-fl-text-dim"
            size={24}
          />
          <p className="mt-3 text-sm font-semibold">
            You are not following any members yet.
          </p>
          <p className="mt-1 text-xs text-fl-text-muted">
            Open a member’s public profile to follow their prediction record.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-fl-border">
          {members.map((member) => (
            <li
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              key={member.uid}
            >
              <div className="min-w-0">
                <Link
                  className="focus-ring rounded-md text-sm font-bold hover:text-fl-accent"
                  href={`/u/${member.handle}`}
                >
                  @{member.handle}
                </Link>
                {member.displayName ? (
                  <p className="mt-1 truncate text-xs text-fl-text-muted">
                    {member.displayName}
                  </p>
                ) : null}
              </div>
              <button
                className="focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-fl-border px-3 text-xs font-bold hover:border-fl-danger hover:text-fl-danger"
                onClick={() => void unfollow(member)}
                type="button"
              >
                <UserMinus aria-hidden="true" size={14} /> Unfollow
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
