"use client";

import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export interface AdminFightControl {
  id: string;
  boutOrder: number;
  cardSegment: string;
  fighterAName: string;
  fighterBName: string;
  fightStatus: string;
  predictionStatus: string;
  lockedAt?: string;
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "Matchup could not be locked";
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return "Matchup could not be locked";
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "Matchup could not be locked";
}

export function PredictionControlBoard({
  eventId,
  initialFights,
}: {
  eventId: string;
  initialFights: AdminFightControl[];
}) {
  const [fights, setFights] = useState(initialFights);
  const [selected, setSelected] = useState<AdminFightControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);

  async function lockSelected() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prediction_control",
          fightId: selected.id,
          operation: "lock",
          reason: "Manual live matchup lock",
          confirmation: `LOCK ${selected.id}`,
          returnTo: `/admin/events/${eventId}`,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      const lockedAt = new Date().toISOString();
      setFights((current) =>
        current.map((fight) =>
          fight.id === selected.id
            ? { ...fight, predictionStatus: "locked", lockedAt }
            : fight,
        ),
      );
      setNotice(
        `${selected.fighterAName} vs ${selected.fighterBName} is locked.`,
      );
      setSelected(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Matchup could not be locked",
      );
    } finally {
      setBusy(false);
    }
  }

  const openCount = fights.filter(
    (fight) => fight.predictionStatus === "open",
  ).length;
  return (
    <section aria-labelledby="prediction-controls-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-fl-border p-5">
        <div>
          <p className="eyebrow">Live operations</p>
          <h2
            className="mt-2 font-display text-3xl font-extrabold"
            id="prediction-controls-title"
          >
            Prediction controls
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fl-text-muted">
            Lock each matchup as you see its walkout begin. There is no bulk or
            event-wide lock.
          </p>
        </div>
        <Badge tone={openCount > 0 ? "info" : "neutral"}>
          {openCount} open
        </Badge>
      </div>
      <div aria-live="polite" className="sr-only">
        {notice}
      </div>
      {notice ? (
        <div className="mx-5 mt-5 flex items-center gap-2 rounded-xl border border-fl-success/30 bg-fl-success/10 p-3 text-sm text-fl-success">
          <CheckCircle2 aria-hidden="true" size={17} /> {notice}
        </div>
      ) : null}
      <div className="divide-y divide-fl-border">
        {fights.map((fight) => {
          const open = fight.predictionStatus === "open";
          return (
            <article
              className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
              key={fight.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                    Bout {fight.boutOrder} ·{" "}
                    {fight.cardSegment.replaceAll("_", " ")}
                  </span>
                  <Badge>{fight.fightStatus}</Badge>
                </div>
                <h3 className="mt-2 text-base font-bold">
                  {fight.fighterAName} vs {fight.fighterBName}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                  {fight.id}
                </p>
              </div>
              <div className="lg:text-right">
                <Badge tone={open ? "info" : "neutral"}>
                  Picks {fight.predictionStatus}
                </Badge>
                {fight.lockedAt ? (
                  <p className="mt-2 text-[10px] text-fl-text-dim">
                    {new Date(fight.lockedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link
                  className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-fl-border px-3 text-xs font-bold text-fl-text-muted"
                  href={`/admin/fights/${fight.id}`}
                >
                  <ExternalLink aria-hidden="true" size={14} /> Details
                </Link>
                <button
                  className={cn(
                    "focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold",
                    open
                      ? "bg-fl-accent text-fl-bg hover:bg-fl-accent-strong"
                      : "cursor-not-allowed border border-fl-border text-fl-text-dim",
                  )}
                  disabled={!open}
                  onClick={() => {
                    setError(null);
                    setSelected(fight);
                  }}
                  type="button"
                >
                  <LockKeyhole aria-hidden="true" size={14} />
                  {open ? "Lock matchup" : "Locked"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <dialog
        aria-labelledby="admin-lock-title"
        className="w-[min(92vw,32rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setSelected(null);
        }}
        ref={dialog}
      >
        <div className="border-b border-fl-border p-5 sm:p-6">
          <p className="eyebrow">Live prediction control</p>
          <h2
            className="mt-2 font-display text-3xl font-extrabold"
            id="admin-lock-title"
          >
            Lock this matchup?
          </h2>
          <p className="mt-3 text-base font-bold">
            {selected?.fighterAName} vs {selected?.fighterBName}
          </p>
          <p className="mt-2 text-sm leading-6 text-fl-text-muted">
            New predictions will stop immediately. Existing predictions remain
            permanently locked. An audited emergency reopen remains available
            from the matchup details page.
          </p>
        </div>
        {error ? (
          <p
            className="mx-5 mt-5 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger sm:mx-6"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="focus-ring min-h-11 rounded-lg border border-fl-border px-5 text-sm font-bold disabled:opacity-50"
            disabled={busy}
            onClick={() => setSelected(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-50"
            disabled={busy}
            onClick={() => void lockSelected()}
            type="button"
          >
            {busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={17}
              />
            ) : (
              <LockKeyhole aria-hidden="true" size={17} />
            )}
            {busy ? "Locking…" : "Confirm lock"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
