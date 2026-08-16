"use client";

import { handleSchema } from "@fightlobby/domain";
import { ArrowRight, AtSign, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function HandleForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? "Choose another handle",
      );
    setBusy(true);
    try {
      const response = await fetch("/api/profile/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: parsed.data, acceptedTerms: true }),
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
            : "Handle could not be reserved";
        throw new Error(message);
      }
      router.push(returnTo);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Handle could not be reserved",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      {error ? (
        <p
          className="rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-4 text-sm text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-fl-text-muted">
          Public handle
        </span>
        <span className="focus-within:focus-ring flex min-h-12 items-center rounded-lg border border-fl-border bg-fl-surface-2 px-4">
          <AtSign aria-hidden="true" className="text-fl-text-dim" size={17} />
          <input
            autoCapitalize="none"
            autoComplete="username"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            maxLength={20}
            minLength={3}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            pattern="[a-z0-9][a-z0-9_]*"
            placeholder="rafa_picks"
            required
            value={handle}
          />
        </span>
      </label>
      <ul className="grid gap-2 text-xs text-fl-text-muted sm:grid-cols-2">
        <li className="flex gap-2">
          <CheckCircle2
            aria-hidden="true"
            className="text-fl-success"
            size={14}
          />
          3–20 characters
        </li>
        <li className="flex gap-2">
          <CheckCircle2
            aria-hidden="true"
            className="text-fl-success"
            size={14}
          />
          Letters, numbers, underscore
        </li>
        <li className="flex gap-2">
          <CheckCircle2
            aria-hidden="true"
            className="text-fl-success"
            size={14}
          />
          Unique and public
        </li>
        <li className="flex gap-2">
          <CheckCircle2
            aria-hidden="true"
            className="text-fl-success"
            size={14}
          />
          One change per 30 days
        </li>
      </ul>
      <label className="flex items-start gap-3 rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-xs leading-5 text-fl-text-muted">
        <input
          className="mt-1 accent-fl-accent"
          name="terms"
          required
          type="checkbox"
        />
        I agree to the{" "}
        <Link className="font-semibold text-fl-text underline" href="/terms">
          Terms
        </Link>{" "}
        and{" "}
        <Link
          className="font-semibold text-fl-text underline"
          href="/community-guidelines"
        >
          Community Guidelines
        </Link>
        .
      </label>
      <button
        className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? "Reserving…" : "Claim my handle"}
        <ArrowRight aria-hidden="true" size={16} />
      </button>
    </form>
  );
}
