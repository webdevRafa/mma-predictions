"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

export function AuthMenu() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    return onAuthStateChanged(getFirebaseClient().auth, setUser);
  }, []);

  if (!user) {
    return (
      <Link
        aria-label="Sign in"
        className="focus-ring grid size-10 place-items-center rounded-lg border border-fl-border bg-fl-surface-1 text-fl-text-muted hover:border-fl-text-muted hover:text-fl-text"
        href="/login"
      >
        <CircleUserRound aria-hidden="true" size={19} />
      </Link>
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
          await Promise.all([
            signOut(getFirebaseClient().auth),
            fetch("/api/auth/session", { method: "DELETE" }),
          ]);
          window.location.assign("/");
        }}
        type="button"
      >
        <LogOut aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
