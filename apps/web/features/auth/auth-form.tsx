"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  getFirebaseClient,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { getFormString } from "@/lib/forms/form-data";

import {
  readAuthReturnContext,
  saveAuthReturnContext,
} from "./auth-return-context";

type Mode = "login" | "signup";

function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential"))
    return "Email or password is incorrect.";
  if (code.includes("email-already-in-use"))
    return "An account already uses that email.";
  if (code.includes("weak-password"))
    return "Use a stronger password with at least 8 characters.";
  if (code.includes("popup-closed"))
    return "Google sign-in was closed before it finished.";
  return error instanceof Error
    ? error.message
    : "Authentication could not be completed.";
}

export function AuthForm({ mode, returnTo }: { mode: Mode; returnTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function establishSession(user: User) {
    const stored = readAuthReturnContext();
    const destination = stored?.returnTo ?? returnTo;
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: await user.getIdToken(true),
        returnTo: destination,
      }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error &&
        "message" in payload.error
          ? String(payload.error.message)
          : "Session could not be created.";
      throw new Error(message);
    }
    const result = payload as {
      onboardingRequired?: boolean;
      accountStatus?: string;
      returnTo?: string;
    };
    if (["banned", "deleted"].includes(result.accountStatus ?? "")) {
      router.push("/account/restricted");
    } else if (result.onboardingRequired) {
      router.push(
        `/onboarding?returnTo=${encodeURIComponent(result.returnTo ?? destination)}`,
      );
    } else {
      router.push(result.returnTo ?? destination);
    }
    router.refresh();
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    saveAuthReturnContext({ returnTo });
    const form = new FormData(event.currentTarget);
    const password = getFormString(form, "password");
    try {
      if (!isFirebaseClientConfigured)
        throw new Error(
          "Firebase sign-in is not configured for this environment.",
        );
      const { auth } = getFirebaseClient();
      const credential =
        mode === "signup"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      if (mode === "signup" && !credential.user.emailVerified)
        await sendEmailVerification(credential.user);
      await establishSession(credential.user);
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    saveAuthReturnContext({ returnTo });
    try {
      if (!isFirebaseClientConfigured)
        throw new Error(
          "Firebase sign-in is not configured for this environment.",
        );
      const { auth } = getFirebaseClient();
      await establishSession(
        (await signInWithPopup(auth, new GoogleAuthProvider())).user,
      );
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    setNotice(null);
    if (!email) return setError("Enter your email first.");
    try {
      if (!isFirebaseClientConfigured)
        throw new Error(
          "Firebase sign-in is not configured for this environment.",
        );
      await sendPasswordResetEmail(getFirebaseClient().auth, email);
      setNotice(
        "Password reset instructions are on the way if that account exists.",
      );
    } catch (caught) {
      setError(friendlyAuthError(caught));
    }
  }

  return (
    <div>
      {!isFirebaseClientConfigured ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-fl-warning/30 bg-fl-warning/10 p-4 text-sm text-fl-warning">
          <AlertCircle aria-hidden="true" className="shrink-0" size={18} />
          Add the Firebase web configuration to enable sign-in here.
        </div>
      ) : null}
      {error ? (
        <p
          className="mb-5 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-4 text-sm text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mb-5 rounded-xl border border-fl-success/30 bg-fl-success/10 p-4 text-sm text-fl-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <button
        className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-fl-border bg-fl-surface-2 text-sm font-bold transition hover:border-fl-text-muted"
        disabled={busy}
        onClick={handleGoogle}
        type="button"
      >
        <span
          aria-hidden="true"
          className="font-display text-lg text-fl-accent"
        >
          G
        </span>{" "}
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-fl-border" />
        <span className="font-mono text-[10px] tracking-[.1em] text-fl-text-dim uppercase">
          or email
        </span>
        <span className="h-px flex-1 bg-fl-border" />
      </div>
      <form className="space-y-4" onSubmit={handleEmail}>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
            Email
          </span>
          <input
            autoComplete="email"
            className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm outline-none"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
            Password
          </span>
          <input
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            className="focus-ring min-h-12 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm outline-none"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <button
          className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg transition hover:bg-fl-accent-strong disabled:cursor-wait disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy
            ? "Checking your corner…"
            : mode === "signup"
              ? "Create my account"
              : "Sign in"}
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </form>
      {mode === "login" ? (
        <button
          className="focus-ring mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md text-xs font-semibold text-fl-text-muted hover:text-fl-text"
          onClick={resetPassword}
          type="button"
        >
          <Mail aria-hidden="true" size={14} /> Send password reset
        </button>
      ) : null}
      <p className="mt-6 text-center text-sm text-fl-text-muted">
        {mode === "signup" ? "Already have a record?" : "New to FightLobby?"}{" "}
        <Link
          className="font-bold text-fl-accent"
          href={`${mode === "signup" ? "/login" : "/signup"}?returnTo=${encodeURIComponent(returnTo)}`}
        >
          {mode === "signup" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
