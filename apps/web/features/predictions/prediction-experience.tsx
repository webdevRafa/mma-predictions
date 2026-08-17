"use client";

import {
  validatePredictionForFight,
  type Fight,
  type PredictionMethod,
  type PredictionGrade,
  type PredictionPick,
  type PredictionSummary,
} from "@fightlobby/domain";
import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ConsensusCard } from "@/components/fights/consensus-card";
import { Card, CardHeader } from "@/components/ui/card";
import {
  clearAuthReturnContext,
  readAuthReturnContext,
  saveAuthReturnContext,
} from "@/features/auth/auth-return-context";
import { cn } from "@/lib/cn";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";

interface DraftEnvelope {
  fightId: string;
  pick: PredictionPick;
}

interface SavedPrediction {
  pick: PredictionPick;
  status: "active" | "locked" | "graded" | "void";
  predictionVersion: number;
  submittedAt: string;
  lockedAt?: string;
  grade?: PredictionGrade;
}

const methodOptions: { value: PredictionMethod; label: string }[] = [
  { value: "ko_tko", label: "KO / TKO" },
  { value: "submission", label: "Submission" },
  { value: "decision", label: "Decision" },
  { value: "other", label: "Other" },
];

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(value: unknown, fallback: string) {
  const payload = objectRecord(value);
  const error = objectRecord(payload.error);
  return typeof error.message === "string" ? error.message : fallback;
}

function parseSummary(value: unknown): PredictionSummary | null {
  const source = objectRecord(value);
  const total = source.total;
  const fighterA = source.fighterA;
  const fighterB = source.fighterB;
  if (
    typeof total !== "number" ||
    typeof fighterA !== "number" ||
    typeof fighterB !== "number"
  )
    return null;
  const numericMap = (candidate: unknown) =>
    Object.fromEntries(
      Object.entries(objectRecord(candidate)).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  return {
    total,
    fighterA,
    fighterB,
    methods: numericMap(source.methods),
    rounds: numericMap(source.rounds),
  };
}

function parseSavedPrediction(
  value: unknown,
  fight: Fight,
): SavedPrediction | null {
  const source = objectRecord(value);
  const result = validatePredictionForFight(source.pick, fight);
  const status = source.status;
  const version = source.predictionVersion;
  const submittedAt = source.submittedAt;
  const lockedAt = source.lockedAt;
  const gradeSource = objectRecord(source.grade);
  const grade =
    typeof gradeSource.resultVersion === "number" &&
    typeof gradeSource.winnerCorrect === "boolean" &&
    typeof gradeSource.methodCorrect === "boolean" &&
    typeof gradeSource.detailCorrect === "boolean" &&
    typeof gradeSource.points === "number" &&
    typeof gradeSource.gradedAt === "string" &&
    typeof gradeSource.gradeVersion === "number"
      ? (gradeSource as unknown as PredictionGrade)
      : undefined;
  if (
    !result.success ||
    !["active", "locked", "graded", "void"].includes(String(status)) ||
    typeof version !== "number" ||
    typeof submittedAt !== "string"
  )
    return null;
  return {
    pick: result.data,
    status: status as SavedPrediction["status"],
    predictionVersion: version,
    submittedAt,
    ...(typeof lockedAt === "string" ? { lockedAt } : {}),
    ...(grade ? { grade } : {}),
  };
}

function parseDraft(value: unknown, fight: Fight): DraftEnvelope | null {
  const source = objectRecord(value);
  if (source.fightId !== fight.id) return null;
  const result = validatePredictionForFight(source.pick, fight);
  return result.success ? { fightId: fight.id, pick: result.data } : null;
}

function defaultDetail(method: PredictionMethod): PredictionPick["detail"] {
  if (method === "ko_tko" || method === "submission") return 1;
  if (method === "decision") return "unanimous";
  return undefined;
}

function methodLabel(method: PredictionMethod) {
  return (
    methodOptions.find((option) => option.value === method)?.label ?? method
  );
}

function detailLabel(pick: PredictionPick) {
  if (typeof pick.detail === "number") return `Round ${pick.detail}`;
  if (typeof pick.detail === "string")
    return `${pick.detail[0]?.toUpperCase()}${pick.detail.slice(1)} decision`;
  return "No finish detail";
}

function fighterName(fight: Fight, fighterId: string) {
  return (
    [fight.fighterA, fight.fighterB].find((fighter) => fighter.id === fighterId)
      ?.name.full ?? "Unknown fighter"
  );
}

export function PredictionExperience({ fight }: { fight: Fight }) {
  const initiallyOpen =
    fight.predictionStatus === "open" &&
    ["scheduled", "prefight"].includes(fight.status);
  const [pick, setPick] = useState<PredictionPick>({
    winnerFighterId: "",
    method: "decision",
    detail: "unanimous",
  });
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [canSubmit, setCanSubmit] = useState(initiallyOpen);
  const [saved, setSaved] = useState<SavedPrediction | null>(null);
  const [summary, setSummary] = useState(fight.predictionSummary);
  const [reveal, setReveal] = useState(fight.predictionStatus !== "open");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pendingRequestId = useRef<string | null>(null);
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const startedTracked = useRef(false);
  const revealTracked = useRef(false);
  const gradedTracked = useRef(false);

  useEffect(() => {
    const context = readAuthReturnContext();
    const draft = parseDraft(context?.predictionDraft, fight);
    if (context?.predictionDraft && !draft) clearAuthReturnContext();
    let active = true;
    if (draft) {
      queueMicrotask(() => {
        if (!active) return;
        setPick(draft.pick);
        setRestored(true);
        setStatus("Your prediction draft was restored. Confirm it to save.");
      });
    }
    const controller = new AbortController();
    void fetch(`/api/predictions/${fight.id}`, { signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok)
          throw new Error(
            errorMessage(payload, "Prediction state is unavailable"),
          );
        const data = objectRecord(payload);
        const isAuthenticated = data.authenticated === true;
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) return;
        if (typeof data.canSubmit === "boolean") setCanSubmit(data.canSubmit);
        if (typeof data.reveal === "boolean") setReveal(data.reveal);
        const nextSummary = parseSummary(data.summary);
        if (nextSummary) setSummary(nextSummary);
        const prediction = parseSavedPrediction(data.prediction, fight);
        if (prediction) {
          setSaved(prediction);
          setReveal(true);
          if (prediction.grade && !gradedTracked.current) {
            gradedTracked.current = true;
            trackAnalyticsEvent("prediction_graded", {
              fight_id: fight.id,
              points: prediction.grade.points,
            });
          }
          if (!revealTracked.current) {
            revealTracked.current = true;
            trackAnalyticsEvent("prediction_revealed", { fight_id: fight.id });
          }
          if (!draft) setPick(prediction.pick);
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name !== "AbortError") {
          setAuthenticated(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fight]);

  useEffect(() => {
    const dialog = confirmationDialog.current;
    if (!dialog) return;
    if (confirming && !dialog.open) dialog.showModal();
    if (!confirming && dialog.open) dialog.close();
  }, [confirming]);

  function selectMethod(method: PredictionMethod) {
    markStarted();
    setPick((current) => ({
      ...current,
      method,
      detail: defaultDetail(method),
    }));
  }

  function markStarted() {
    if (startedTracked.current) return;
    startedTracked.current = true;
    trackAnalyticsEvent("prediction_started", { fight_id: fight.id });
  }

  function preserveAndAuthenticate(validPick: PredictionPick) {
    const returnTo = `/fights/${fight.slug}#predict`;
    saveAuthReturnContext({
      returnTo,
      predictionDraft: { fightId: fight.id, pick: validPick },
    });
    trackAnalyticsEvent("signup_prompted", { source: "prediction" });
    window.location.assign(`/signup?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    const validated = validatePredictionForFight(pick, fight);
    if (!validated.success) return setError(validated.message);
    if (authenticated !== true) return preserveAndAuthenticate(validated.data);
    setPick(validated.data);
    pendingRequestId.current = crypto.randomUUID();
    setConfirming(true);
  }

  async function confirmPrediction() {
    const validated = validatePredictionForFight(pick, fight);
    if (!validated.success) {
      setConfirming(false);
      return setError(validated.message);
    }
    const requestId = pendingRequestId.current ?? crypto.randomUUID();
    pendingRequestId.current = requestId;
    setBusy(true);
    setError(null);
    try {
      const appCheckToken = await getFirebaseAppCheckToken();
      const response = await fetch(`/api/predictions/${fight.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
        },
        body: JSON.stringify({
          requestId,
          pick: validated.data,
        }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401)
        return preserveAndAuthenticate(validated.data);
      if (!response.ok)
        throw new Error(errorMessage(payload, "Prediction could not be saved"));
      const data = objectRecord(payload);
      const prediction = parseSavedPrediction(data.prediction, fight);
      if (!prediction)
        throw new Error("The saved prediction response was invalid");
      const nextSummary = parseSummary(data.summary);
      setSaved(prediction);
      if (nextSummary) setSummary(nextSummary);
      setReveal(true);
      setCanSubmit(false);
      setRestored(false);
      setStatus(null);
      setConfirming(false);
      pendingRequestId.current = null;
      trackAnalyticsEvent("prediction_submitted", { fight_id: fight.id });
      if (!revealTracked.current) {
        revealTracked.current = true;
        trackAnalyticsEvent("prediction_revealed", { fight_id: fight.id });
      }
      clearAuthReturnContext();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Prediction could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }

  const formDisabled = !canSubmit || busy;
  const detailOptions = Array.from(
    { length: fight.scheduledRounds },
    (_, index) => index + 1,
  );

  return (
    <>
      <Card id="predict">
        <CardHeader
          eyebrow="Your call"
          title={saved ? "Your locked prediction" : "Make your prediction"}
          description={
            saved
              ? "Final and permanently locked."
              : "Winner · method · finish detail"
          }
        />
        {saved ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3 rounded-xl border border-fl-success/30 bg-fl-success/10 p-4">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-fl-success"
                size={18}
              />
              <div>
                <p className="text-sm font-semibold">Prediction locked</p>
                <p className="mt-1 text-xs text-fl-text-muted">
                  {saved.grade
                    ? `Official score: +${saved.grade.points} point${saved.grade.points === 1 ? "" : "s"}.`
                    : "Your selection cannot be edited or replaced."}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-fl-border bg-fl-border sm:grid-cols-3">
              {[
                ["Winner", fighterName(fight, saved.pick.winnerFighterId)],
                ["Method", methodLabel(saved.pick.method)],
                ["Finish detail", detailLabel(saved.pick)],
              ].map(([label, value]) => (
                <div className="bg-fl-surface-2 p-4" key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-2 text-sm font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              Locked{" "}
              {new Date(saved.lockedAt ?? saved.submittedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <form className="p-5 sm:p-6" onSubmit={submit}>
            {restored ? (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-fl-info/30 bg-fl-info/10 p-4 text-sm text-fl-info">
                <RotateCcw aria-hidden="true" size={17} /> Guest draft restored
              </div>
            ) : null}
            {error ? (
              <p
                className="mb-6 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-4 text-sm text-fl-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {status ? (
              <p
                className="mb-6 rounded-xl border border-fl-border bg-fl-surface-2 p-4 text-sm"
                role="status"
              >
                {status}
              </p>
            ) : null}
            <fieldset disabled={formDisabled}>
              <legend className="text-sm font-bold">1. Pick the winner</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[fight.fighterA, fight.fighterB].map((fighter, index) => {
                  const selected = pick.winnerFighterId === fighter.id;
                  return (
                    <label
                      className={cn(
                        "focus-within:focus-ring cursor-pointer rounded-xl border p-4 transition",
                        selected
                          ? "border-fl-accent bg-fl-accent-soft"
                          : "border-fl-border bg-fl-surface-2 hover:border-fl-text-dim",
                      )}
                      key={fighter.id}
                    >
                      <input
                        checked={selected}
                        className="sr-only"
                        name="winner"
                        onChange={() => {
                          markStarted();
                          setError(null);
                          setPick((current) => ({
                            ...current,
                            winnerFighterId: fighter.id,
                          }));
                        }}
                        type="radio"
                        value={fighter.id}
                      />
                      <span className="eyebrow">
                        Corner {index === 0 ? "A" : "B"}
                      </span>
                      <span className="mt-2 block font-display text-2xl font-bold">
                        {fighter.name.full}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-7" disabled={formDisabled}>
              <legend className="text-sm font-bold">
                2. Choose the method
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {methodOptions.map((option) => (
                  <button
                    aria-pressed={pick.method === option.value}
                    className={cn(
                      "focus-ring min-h-10 cursor-pointer rounded-lg border px-3.5 text-xs font-bold transition",
                      pick.method === option.value
                        ? "border-fl-accent bg-fl-accent text-fl-bg"
                        : "border-fl-border bg-fl-surface-2 text-fl-text-muted hover:text-fl-text",
                    )}
                    key={option.value}
                    onClick={() => selectMethod(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-7">
              <label className="block">
                <span className="text-sm font-bold">3. Finish detail</span>
                {pick.method === "ko_tko" || pick.method === "submission" ? (
                  <select
                    className="focus-ring mt-3 min-h-11 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-sm"
                    disabled={formDisabled}
                    onChange={(event) =>
                      setPick((current) => ({
                        ...current,
                        detail: Number(event.target.value),
                      }))
                    }
                    value={typeof pick.detail === "number" ? pick.detail : 1}
                  >
                    {detailOptions.map((round) => (
                      <option key={round} value={round}>
                        Round {round}
                      </option>
                    ))}
                  </select>
                ) : pick.method === "decision" ? (
                  <select
                    className="focus-ring mt-3 min-h-11 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-sm"
                    disabled={formDisabled}
                    onChange={(event) =>
                      setPick((current) => ({
                        ...current,
                        detail: event.target.value as
                          "unanimous" | "split" | "majority",
                      }))
                    }
                    value={
                      typeof pick.detail === "string"
                        ? pick.detail
                        : "unanimous"
                    }
                  >
                    <option value="unanimous">Unanimous decision</option>
                    <option value="split">Split decision</option>
                    <option value="majority">Majority decision</option>
                  </select>
                ) : (
                  <span className="mt-3 flex min-h-11 items-center rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-sm text-fl-text-dim">
                    No extra detail
                  </span>
                )}
              </label>
            </div>

            <button
              className="focus-ring mt-7 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg transition hover:bg-fl-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              disabled={formDisabled}
              type="submit"
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
              {busy
                ? "Saving…"
                : !canSubmit
                  ? "Predictions locked"
                  : "Lock in my pick"}
            </button>
            <p className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
              <ShieldCheck aria-hidden="true" size={14} /> Predictions lock at
              walkouts · server verified
            </p>
          </form>
        )}
      </Card>
      <dialog
        aria-labelledby="prediction-confirm-title"
        className="w-[min(92vw,32rem)] rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else {
            pendingRequestId.current = null;
            setConfirming(false);
          }
        }}
        ref={confirmationDialog}
      >
        <div className="border-b border-fl-border p-5 sm:p-6">
          <p className="eyebrow">Final confirmation</p>
          <h2
            className="mt-2 font-display text-3xl font-extrabold"
            id="prediction-confirm-title"
          >
            Lock in this prediction?
          </h2>
          <p className="mt-2 text-sm leading-6 text-fl-text-muted">
            Once confirmed, this prediction cannot be changed—even while the
            matchup is still accepting picks.
          </p>
        </div>
        <dl className="grid gap-px bg-fl-border sm:grid-cols-3">
          {[
            ["Winner", fighterName(fight, pick.winnerFighterId)],
            ["Method", methodLabel(pick.method)],
            ["Finish detail", detailLabel(pick)],
          ].map(([label, value]) => (
            <div className="bg-fl-surface-2 p-4" key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-2 text-sm font-bold">{value}</dd>
            </div>
          ))}
        </dl>
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
            onClick={() => {
              pendingRequestId.current = null;
              setConfirming(false);
            }}
            type="button"
          >
            Review my pick
          </button>
          <button
            className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg disabled:opacity-50"
            disabled={busy}
            onClick={() => void confirmPrediction()}
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
            {busy ? "Locking…" : "Confirm and lock"}
          </button>
        </div>
      </dialog>
      <ConsensusCard fight={fight} reveal={reveal} summary={summary} />
    </>
  );
}
