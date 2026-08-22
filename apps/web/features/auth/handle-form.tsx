"use client";

import { handleSchema } from "@fightlobby/domain";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  CircleX,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/events";

type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error";

function readApiError(payload: unknown, fallback: string) {
  return typeof payload === "object" &&
    payload &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error &&
    "message" in payload.error
    ? String(payload.error.message)
    : fallback;
}

export function HandleForm({
  returnTo,
  onCompleted,
}: {
  returnTo: string;
  onCompleted?: (() => void) | undefined;
}) {
  const router = useRouter();
  const feedbackId = useId();
  const guidanceId = useId();
  const availabilityCache = useRef(new Map<string, boolean>());
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<AvailabilityStatus>("idle");
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedHandle = handleSchema.safeParse(handle);
  const canonicalHandle = parsedHandle.success ? parsedHandle.data : null;
  const trimmedLength = handle.trim().length;
  const lengthValid = trimmedLength >= 3 && trimmedLength <= 20;
  const formatMessage =
    handle && lengthValid && !parsedHandle.success
      ? (parsedHandle.error.issues[0]?.message ?? "That handle is invalid")
      : null;
  const canSubmit =
    canonicalHandle !== null &&
    availability === "available" &&
    acceptedTerms &&
    !busy;

  useEffect(() => {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success || availabilityCache.current.has(parsed.data)) return;

    const candidate = parsed.data;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAvailability("checking");
      try {
        const response = await fetch(
          `/api/profile/handle?handle=${encodeURIComponent(candidate)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            readApiError(payload, "Availability could not be checked"),
          );
        }
        if (
          typeof payload !== "object" ||
          !payload ||
          !("available" in payload) ||
          typeof payload.available !== "boolean"
        ) {
          throw new Error("Availability could not be checked");
        }
        availabilityCache.current.set(candidate, payload.available);
        setAvailability(payload.available ? "available" : "taken");
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        setAvailability("error");
      }
    }, 650);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [availabilityRetry, handle]);

  function updateHandle(value: string) {
    const nextHandle = value.toLowerCase();
    const parsed = handleSchema.safeParse(nextHandle);
    const cached = parsed.success
      ? availabilityCache.current.get(parsed.data)
      : undefined;
    setHandle(nextHandle);
    setError(null);
    setAvailability(
      typeof cached === "boolean" ? (cached ? "available" : "taken") : "idle",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? "Choose another handle",
      );
    if (availability !== "available")
      return setError("Wait for the handle availability check to finish");
    setBusy(true);
    try {
      const response = await fetch("/api/profile/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: parsed.data, acceptedTerms: true }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = readApiError(payload, "Handle could not be reserved");
        if (
          typeof payload === "object" &&
          payload &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error &&
          "code" in payload.error &&
          payload.error.code === "handle_unavailable"
        ) {
          availabilityCache.current.set(parsed.data, false);
          setAvailability("taken");
        }
        throw new Error(message);
      }
      trackAnalyticsEvent("handle_created");
      if (onCompleted) onCompleted();
      else router.push(returnTo);
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
            aria-describedby={`${feedbackId} ${guidanceId}`}
            aria-invalid={availability === "taken" || Boolean(formatMessage)}
            autoCapitalize="none"
            autoComplete="username"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
            maxLength={20}
            minLength={3}
            onChange={(event) => updateHandle(event.target.value)}
            pattern="[a-z0-9][a-z0-9_]*"
            placeholder="rafa_picks"
            required
            spellCheck={false}
            value={handle}
          />
        </span>
      </label>
      <div
        aria-atomic="true"
        aria-live="polite"
        className="-mt-3 min-h-5 text-xs"
        id={feedbackId}
      >
        {availability === "checking" ? (
          <span className="inline-flex items-center gap-2 text-fl-text-muted">
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin"
              size={14}
            />
            Checking @{canonicalHandle}…
          </span>
        ) : null}
        {availability === "available" ? (
          <span className="inline-flex items-center gap-2 font-semibold text-fl-success">
            <CheckCircle2 aria-hidden="true" size={14} />@{canonicalHandle} is
            available
          </span>
        ) : null}
        {availability === "taken" ? (
          <span className="inline-flex items-center gap-2 font-semibold text-fl-danger">
            <CircleX aria-hidden="true" size={14} />@{canonicalHandle} is
            already taken
          </span>
        ) : null}
        {availability === "error" ? (
          <span className="inline-flex flex-wrap items-center gap-2 text-fl-warning">
            Availability could not be checked.
            <button
              className="focus-ring rounded font-bold underline underline-offset-2"
              onClick={() => {
                setAvailability("idle");
                setAvailabilityRetry((value) => value + 1);
              }}
              type="button"
            >
              Try again
            </button>
          </span>
        ) : null}
        {availability === "idle" && canonicalHandle ? (
          <span className="text-fl-text-dim">
            Checking after you pause typing…
          </span>
        ) : null}
        {formatMessage ? (
          <span className="text-fl-warning">{formatMessage}</span>
        ) : null}
      </div>
      <div
        className="grid gap-5 rounded-xl border border-fl-border bg-fl-surface-2/50 p-4 text-xs sm:grid-cols-2"
        id={guidanceId}
      >
        <section aria-labelledby={`${guidanceId}-requirements`}>
          <p
            className="mb-3 font-mono text-[10px] font-bold tracking-[0.16em] text-fl-text-dim uppercase"
            id={`${guidanceId}-requirements`}
          >
            Requirements
          </p>
          <ul className="space-y-3">
            <li
              className={`flex items-center gap-2 font-semibold transition-colors ${lengthValid ? "text-fl-success" : "text-fl-text-dim"}`}
            >
              <CheckCircle2 aria-hidden="true" size={15} />
              3–20 characters
            </li>
            <li
              className={`flex items-center gap-2 font-semibold transition-colors ${availability === "available" ? "text-fl-success" : "text-fl-text-dim"}`}
            >
              <CheckCircle2 aria-hidden="true" size={15} />
              Unique
            </li>
          </ul>
        </section>
        <section
          aria-labelledby={`${guidanceId}-details`}
          className="border-t border-fl-border pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5"
        >
          <p
            className="mb-3 font-mono text-[10px] font-bold tracking-[0.16em] text-fl-text-dim uppercase"
            id={`${guidanceId}-details`}
          >
            Good to know
          </p>
          <div className="space-y-3 font-medium text-fl-text">
            <p>Letters, numbers, underscore</p>
            <p>One change per 30 days</p>
          </div>
        </section>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-xs leading-5 text-fl-text-muted">
        <input
          checked={acceptedTerms}
          className="mt-1 accent-fl-accent"
          name="terms"
          onChange={(event) => setAcceptedTerms(event.target.checked)}
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
        className="focus-ring flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg transition disabled:cursor-not-allowed disabled:bg-fl-surface-3 disabled:text-fl-text-dim"
        disabled={!canSubmit}
        type="submit"
      >
        {busy ? "Reserving…" : "Claim my handle"}
        <ArrowRight aria-hidden="true" size={16} />
      </button>
    </form>
  );
}
