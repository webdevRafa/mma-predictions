"use client";

import {
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  describeQuickResult,
  findQuickResultOption,
  quickResultGroups,
  type ExistingQuickResult,
  type QuickResultOption,
} from "@/lib/admin/quick-results";

export interface AdminFightControl {
  id: string;
  boutOrder: number;
  cardSegment: string;
  fighterAId: string;
  fighterAName: string;
  fighterBId: string;
  fighterBName: string;
  fightStatus: string;
  predictionStatus: string;
  scheduledRounds: number;
  resultVersion: number;
  currentResult?: ExistingQuickResult;
  lockedAt?: string;
}

interface ResultTarget {
  fight: AdminFightControl;
  option: QuickResultOption;
}

function errorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : fallback;
}

function responseResultVersion(value: unknown, fallback: number) {
  if (!value || typeof value !== "object") return fallback;
  const result = (value as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return fallback;
  const version = (result as Record<string, unknown>).resultVersion;
  return typeof version === "number" ? version : fallback;
}

export function PredictionControlBoard({
  eventId,
  initialFights,
}: {
  eventId: string;
  initialFights: AdminFightControl[];
}) {
  const [fights, setFights] = useState(initialFights);
  const [lockTarget, setLockTarget] = useState<AdminFightControl | null>(null);
  const [resultTarget, setResultTarget] = useState<ResultTarget | null>(null);
  const [resultSelections, setResultSelections] = useState<
    Record<string, string>
  >({});
  const [lockBusy, setLockBusy] = useState(false);
  const [resultBusyId, setResultBusyId] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lockDialog = useRef<HTMLDialogElement>(null);
  const resultDialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (lockTarget && !lockDialog.current?.open)
      lockDialog.current?.showModal();
    if (!lockTarget && lockDialog.current?.open) lockDialog.current.close();
  }, [lockTarget]);

  useEffect(() => {
    if (resultTarget && !resultDialog.current?.open)
      resultDialog.current?.showModal();
    if (!resultTarget && resultDialog.current?.open)
      resultDialog.current.close();
  }, [resultTarget]);

  async function lockSelected() {
    if (!lockTarget) return;
    setLockBusy(true);
    setLockError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prediction_control",
          fightId: lockTarget.id,
          operation: "lock",
          reason: "Manual live matchup lock",
          confirmation: `LOCK ${lockTarget.id}`,
          returnTo: `/admin/events/${eventId}`,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(payload, "Matchup could not be locked"));
      const lockedAt = new Date().toISOString();
      setFights((current) =>
        current.map((fight) =>
          fight.id === lockTarget.id
            ? { ...fight, predictionStatus: "locked", lockedAt }
            : fight,
        ),
      );
      setNotice(
        `${lockTarget.fighterAName} vs ${lockTarget.fighterBName} is locked.`,
      );
      setLockTarget(null);
      router.refresh();
    } catch (caught) {
      setLockError(
        caught instanceof Error
          ? caught.message
          : "Matchup could not be locked",
      );
    } finally {
      setLockBusy(false);
    }
  }

  function prepareResult(fight: AdminFightControl) {
    const optionId = resultSelections[fight.id];
    if (!optionId) return;
    const option = findQuickResultOption(fight, optionId);
    if (!option) return;
    setResultError(null);
    setResultTarget({ fight, option });
  }

  async function submitResult() {
    if (!resultTarget) return;
    const { fight, option } = resultTarget;
    setResultBusyId(fight.id);
    setResultError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct_result",
          fightId: fight.id,
          result: option.result,
          reason: `Official result submitted from event control board: ${option.label}`,
          confirmation: `RESULT ${fight.id}`,
          returnTo: `/admin/events/${eventId}`,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(errorMessage(payload, "Result could not be submitted"));
      const resultVersion = responseResultVersion(
        payload,
        fight.resultVersion + 1,
      );
      setFights((current) =>
        current.map((currentFight) =>
          currentFight.id === fight.id
            ? {
                ...currentFight,
                fightStatus: "completed",
                predictionStatus: "grading",
                currentResult: option.result,
                resultVersion,
              }
            : currentFight,
        ),
      );
      setResultSelections((current) => {
        const next = { ...current };
        delete next[fight.id];
        return next;
      });
      setNotice(
        `${fight.fighterAName} vs ${fight.fighterBName}: result saved and grading queued.`,
      );
      setResultTarget(null);
      router.refresh();
    } catch (caught) {
      setResultError(
        caught instanceof Error
          ? caught.message
          : "Result could not be submitted",
      );
    } finally {
      setResultBusyId(null);
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
            Prediction and result controls
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-fl-text-muted">
            Lock each matchup at walkout, then submit its scoring result from
            the same row. Quick results cover every grading outcome; use Details
            to add the official clock time or uncommon method wording.
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
          const canSubmitResult = !["canceled", "postponed"].includes(
            fight.fightStatus,
          );
          const selectedOptionId = resultSelections[fight.id] ?? "";
          const resultBusy = resultBusyId === fight.id;
          const currentResult = describeQuickResult(fight, fight.currentResult);
          return (
            <article
              className="grid gap-5 p-5 xl:grid-cols-[minmax(16rem,1fr)_minmax(0,auto)] xl:items-center"
              key={fight.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                    Bout {fight.boutOrder} ·{" "}
                    {fight.cardSegment.replaceAll("_", " ")}
                  </span>
                  <Badge>{fight.fightStatus}</Badge>
                  {fight.resultVersion > 0 ? (
                    <Badge tone="success">Result v{fight.resultVersion}</Badge>
                  ) : null}
                </div>
                <h3 className="mt-2 text-base font-bold">
                  {fight.fighterAName} vs {fight.fighterBName}
                </h3>
                <p className="mt-1 font-mono text-[10px] text-fl-text-dim">
                  {fight.id}
                </p>
                {currentResult ? (
                  <p className="mt-2 text-xs font-bold text-fl-success">
                    Current result: {currentResult}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <Badge tone={open ? "info" : "neutral"}>
                    Picks {fight.predictionStatus}
                  </Badge>
                  {fight.lockedAt ? (
                    <span className="text-[10px] text-fl-text-dim">
                      Locked {new Date(fight.lockedAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_auto_minmax(14rem,1fr)_auto] sm:items-center">
                  <Link
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-fl-border px-3 text-xs font-bold text-fl-text-muted"
                    href={`/admin/fights/${fight.id}`}
                  >
                    <ExternalLink aria-hidden="true" size={14} /> Details
                  </Link>
                  <button
                    className={cn(
                      "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold",
                      open
                        ? "bg-fl-accent text-fl-bg hover:bg-fl-accent-strong"
                        : "cursor-not-allowed border border-fl-border text-fl-text-dim",
                    )}
                    disabled={!open}
                    onClick={() => {
                      setLockError(null);
                      setLockTarget(fight);
                    }}
                    type="button"
                  >
                    <LockKeyhole aria-hidden="true" size={14} />
                    {open ? "Lock matchup" : "Locked"}
                  </button>
                  <label className="min-w-0">
                    <span className="sr-only">
                      Select result for {fight.fighterAName} vs{" "}
                      {fight.fighterBName}
                    </span>
                    <select
                      className="focus-ring min-h-10 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-xs font-bold text-fl-text disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canSubmitResult || resultBusy}
                      onChange={(event) =>
                        setResultSelections((current) => ({
                          ...current,
                          [fight.id]: event.target.value,
                        }))
                      }
                      value={selectedOptionId}
                    >
                      <option value="">Submit result…</option>
                      {quickResultGroups(fight).map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <button
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-fl-accent bg-fl-accent/10 px-4 text-xs font-bold text-fl-accent transition hover:bg-fl-accent hover:text-fl-bg disabled:cursor-not-allowed disabled:border-fl-border disabled:bg-transparent disabled:text-fl-text-dim"
                    disabled={
                      !selectedOptionId || !canSubmitResult || resultBusy
                    }
                    onClick={() => prepareResult(fight)}
                    type="button"
                  >
                    {resultBusy ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                        size={14}
                      />
                    ) : (
                      <Trophy aria-hidden="true" size={14} />
                    )}
                    {resultBusy ? "Submitting…" : "Submit result"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <dialog
        aria-labelledby="admin-lock-title"
        className="w-[min(92vw,32rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={(event) => {
          if (lockBusy) event.preventDefault();
          else setLockTarget(null);
        }}
        ref={lockDialog}
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
            {lockTarget?.fighterAName} vs {lockTarget?.fighterBName}
          </p>
          <p className="mt-2 text-sm leading-6 text-fl-text-muted">
            New predictions will stop immediately. Existing predictions remain
            permanently locked. An audited emergency reopen remains available
            from the matchup details page.
          </p>
        </div>
        {lockError ? (
          <p
            className="mx-5 mt-5 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger sm:mx-6"
            role="alert"
          >
            {lockError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="focus-ring min-h-11 rounded-lg border border-fl-border px-5 text-sm font-bold disabled:opacity-50"
            disabled={lockBusy}
            onClick={() => setLockTarget(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-50"
            disabled={lockBusy}
            onClick={() => void lockSelected()}
            type="button"
          >
            {lockBusy ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={17}
              />
            ) : (
              <LockKeyhole aria-hidden="true" size={17} />
            )}
            {lockBusy ? "Locking…" : "Confirm lock"}
          </button>
        </div>
      </dialog>

      <dialog
        aria-labelledby="admin-result-title"
        className="w-[min(92vw,34rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={(event) => {
          if (resultBusyId) event.preventDefault();
          else setResultTarget(null);
        }}
        ref={resultDialog}
      >
        <div className="border-b border-fl-border p-5 sm:p-6">
          <p className="eyebrow">Official result</p>
          <h2
            className="mt-2 font-display text-3xl font-extrabold"
            id="admin-result-title"
          >
            Submit and grade?
          </h2>
          <p className="mt-3 text-sm font-bold text-fl-text-muted">
            {resultTarget?.fight.fighterAName} vs{" "}
            {resultTarget?.fight.fighterBName}
          </p>
          <p className="mt-2 text-lg font-bold text-fl-text">
            {resultTarget?.option.label}
          </p>
          <p className="mt-3 text-sm leading-6 text-fl-text-muted">
            This marks the matchup completed, saves an audited official result,
            and immediately queues grading for every submitted prediction. A
            correction later creates a new result version and regrades safely.
          </p>
        </div>
        {resultError ? (
          <p
            className="mx-5 mt-5 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-3 text-sm text-fl-danger sm:mx-6"
            role="alert"
          >
            {resultError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            className="focus-ring min-h-11 rounded-lg border border-fl-border px-5 text-sm font-bold disabled:opacity-50"
            disabled={Boolean(resultBusyId)}
            onClick={() => setResultTarget(null)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-50"
            disabled={Boolean(resultBusyId)}
            onClick={() => void submitResult()}
            type="button"
          >
            {resultBusyId ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={17}
              />
            ) : (
              <Trophy aria-hidden="true" size={17} />
            )}
            {resultBusyId ? "Submitting…" : "Confirm result"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
