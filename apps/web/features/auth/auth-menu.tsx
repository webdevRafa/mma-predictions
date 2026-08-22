"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AUTH_PROFILE_UPDATED_EVENT,
  type AuthProfileUpdatedDetail,
} from "@/lib/auth/client-profile-events";
import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

export function AuthMenu() {
  const [user, setUser] = useState<User | null | undefined>(() =>
    isFirebaseClientConfigured ? undefined : null,
  );
  const [signingOut, setSigningOut] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    return onAuthStateChanged(
      getFirebaseClient().auth,
      (currentUser) => {
        setUser(currentUser);
        setPhotoURL(currentUser?.photoURL ?? null);
        setImageFailed(false);
      },
      () => setUser(null),
    );
  }, []);

  useEffect(() => {
    function updateProfile(event: Event) {
      const detail = (event as CustomEvent<AuthProfileUpdatedDetail>).detail;
      setPhotoURL(detail.photoURL);
      setImageFailed(false);
    }
    window.addEventListener(AUTH_PROFILE_UPDATED_EVENT, updateProfile);
    return () =>
      window.removeEventListener(AUTH_PROFILE_UPDATED_EVENT, updateProfile);
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
        aria-label="Signed in — account settings"
        className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-fl-border bg-fl-surface-1 py-1 pr-2.5 pl-1 text-fl-text-muted hover:border-fl-text-muted hover:text-fl-text"
        href="/settings"
        title="Account settings"
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-fl-surface-3">
          {photoURL && !imageFailed ? (
            // Firebase Auth photo URLs can come from Google or FightLobby Storage.
            <img
              alt=""
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
              referrerPolicy="no-referrer"
              src={photoURL}
            />
          ) : (
            <CircleUserRound aria-hidden="true" size={19} />
          )}
        </span>
        <span className="hidden text-xs font-bold lg:inline">Account</span>
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
