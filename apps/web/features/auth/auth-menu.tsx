"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { CircleUserRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getAccountMenuPresentation } from "@/lib/auth/account-menu";
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
  const [handle, setHandle] = useState<string | null | undefined>(() =>
    isFirebaseClientConfigured ? undefined : null,
  );
  const [handleUnavailable, setHandleUnavailable] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    return onAuthStateChanged(
      getFirebaseClient().auth,
      (currentUser) => {
        setUser(currentUser);
        setPhotoURL(currentUser?.photoURL ?? null);
        setHandle(currentUser ? undefined : null);
        setHandleUnavailable(false);
        setImageFailed(false);
      },
      () => {
        setUser(null);
        setHandle(null);
        setHandleUnavailable(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/profile/identity", {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        setHandle(
          response.ok &&
            payload &&
            typeof payload === "object" &&
            "handle" in payload &&
            typeof payload.handle === "string"
            ? payload.handle
            : null,
        );
        setHandleUnavailable(!response.ok);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setHandle(null);
        setHandleUnavailable(true);
      }
    })();
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    function updateProfile(event: Event) {
      const detail = (event as CustomEvent<AuthProfileUpdatedDetail>).detail;
      if (detail.photoURL !== undefined) {
        setPhotoURL(detail.photoURL);
        setImageFailed(false);
      }
      if (detail.handle !== undefined) {
        setHandle(detail.handle);
        setHandleUnavailable(false);
      }
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

  const account = getAccountMenuPresentation(handle, handleUnavailable);

  return (
    <div className="flex items-center gap-1">
      <Link
        aria-label={account.title}
        className={`focus-ring inline-flex h-10 items-center gap-2 rounded-lg border bg-fl-surface-1 py-1 pr-2.5 pl-1 hover:text-fl-text ${account.needsOnboarding ? "border-fl-accent/50 text-fl-accent" : "border-fl-border text-fl-text-muted hover:border-fl-text-muted"}`}
        href={account.href}
        title={account.title}
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
        {handle === undefined ? (
          <Skeleton className="hidden h-3 w-16 lg:block" />
        ) : (
          <span className="hidden max-w-32 truncate text-xs font-bold lg:inline">
            {account.label}
          </span>
        )}
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
