"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

export function AuthMenu() {
  const [user, setUser] = useState<User | null | undefined>(() =>
    isFirebaseClientConfigured ? undefined : null,
  );
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    return onAuthStateChanged(getFirebaseClient().auth, setUser, () =>
      setUser(null),
    );
  }, []);

  if (user === undefined || signingOut) {
    return (
      <div aria-busy="true" className="flex items-center gap-2" role="status">
        <span className="sr-only">Checking account status…</span>
        <Skeleton className="h-10 w-14 sm:w-16" />
        <Skeleton className="size-10" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg bg-fl-accent px-3 text-xs font-bold text-fl-bg transition hover:bg-fl-accent-strong"
          href="/signup"
        >
          <span className="sm:hidden">Join</span>
          <span className="hidden sm:inline">Sign up</span>
        </Link>
        <Link
          aria-label="Sign in"
          className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 text-fl-text-muted hover:border-fl-text-muted hover:text-fl-text"
          href="/login"
          title="Sign in"
        >
          <CircleUserRound aria-hidden="true" size={19} />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        aria-label="Account settings"
        className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 text-fl-text-muted hover:border-fl-text-muted hover:text-fl-text"
        href="/settings"
      >
        <CircleUserRound aria-hidden="true" size={19} />
      </Link>
      <button
        aria-label="Sign out"
        className="focus-ring hidden size-10 cursor-pointer place-items-center rounded-lg text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text sm:grid"
        onClick={async () => {
          setSigningOut(true);
          try {
            await Promise.all([
              signOut(getFirebaseClient().auth),
              fetch("/api/auth/session", { method: "DELETE" }),
            ]);
            window.location.assign("/");
          } catch {
            setSigningOut(false);
          }
        }}
        type="button"
      >
        <LogOut aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
