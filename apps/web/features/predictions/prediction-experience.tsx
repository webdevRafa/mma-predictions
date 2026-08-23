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
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearAuthReturnContext,
  readAuthReturnContext,
  saveAuthReturnContext,
} from "@/features/auth/auth-return-context";
import { usePredictionScoring } from "@/features/predictions/prediction-scoring-context";
import { cn } from "@/lib/cn";
import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";
import {
  getPredictionPanelMode,
  isPredictionSubmissionDisabled,
} from "@/lib/predictions/experience-state";

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

type PredictionDraft = Omit<PredictionPick, "method"> & {
  method: PredictionMethod | "";
};

type PredictionLookupState = "loading" | "ready" | "error";

const methodOptions: { value: PredictionMethod; label: string }[] = [
  { value: "ko_tko", label: "KO / TKO" },
  { value: "submission", label: "Submission" },
  { value: "decision", label: "Decision" },
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
  const breakdown = (candidate: unknown) => {
    const breakdownSource = objectRecord(candidate);
    return {
      fighterA: numericMap(breakdownSource.fighterA),
      fighterB: numericMap(breakdownSource.fighterB),
    };
  };
  return {
    total,
    fighterA,
    fighterB,
    methods: numericMap(source.methods),
    rounds: numericMap(source.rounds),
    methodsByFighter: breakdown(source.methodsByFighter),
    roundsByFighter: breakdown(source.roundsByFighter),
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

function methodLabel(method: PredictionMethod | "") {
  return (
    methodOptions.find((option) => option.value === method)?.label ?? method
  );
}

function detailLabel(pick: Pick<PredictionPick, "detail">) {
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

function PredictionExperienceLoading() {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">
        Checking your prediction and community consensus…
      </span>
      <Card id="predict">
        <div className="border-b border-fl-border px-5 py-4 sm:px-6">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-52 max-w-full" />
          <Skeleton className="mt-3 h-3.5 w-44 max-w-full" />
        </div>
        <div className="p-5 sm:p-6">
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[5.5rem]" />
            <Skeleton className="h-[5.5rem]" />
          </div>
          <Skeleton className="mt-7 h-4 w-36" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="mt-7 h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-full" />
          <Skeleton className="mt-7 h-12 w-44 max-w-full" />
        </div>
      </Card>
      <Card className="mt-6">
        <div className="border-b border-fl-border px-5 py-4 sm:px-6">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          </div>
          <Skeleton className="mt-6 h-24 w-full" />
        </div>
      </Card>
    </div>
  );
}

function PredictionExperienceError({ retry }: { retry: () => void }) {
  return (
    <>
      <Card id="predict">
        <CardHeader
          eyebrow="Your call"
          title="Prediction status unavailable"
          description="We couldn’t confirm whether you already made a pick."
        />
        <div className="p-5 sm:p-6">
          <button
            className="focus-ring min-h-11 rounded-lg bg-fl-accent px-5 text-sm font-bold text-fl-bg transition hover:bg-fl-accent-strong"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        </div>
      </Card>
      <Card className="mt-6">
        <CardHeader eyebrow="Community read" title="Consensus" />
        <p className="p-5 text-sm leading-6 text-fl-text-muted sm:p-6">
          Consensus will appear after your prediction status is confirmed.
        </p>
      </Card>
    </>
  );
}

function PredictionClosedNotice() {
  return (
    <Card id="predict">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-fl-accent-soft text-fl-accent">
          <LockKeyhole aria-hidden="true" size={20} />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Your call</p>
          <h2 className="mt-2 font-display text-2xl leading-none font-bold tracking-[0.01em]">
            Predictions are closed
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fl-text-muted">
            Predictions closed when the fighters began their walkouts. This
            matchup is no longer accepting new picks.
          </p>
          <p className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            <ShieldCheck aria-hidden="true" size={14} /> Locked at walkout ·
            server verified
          </p>
        </div>
      </div>
    </Card>
  );
}

export function PredictionExperience({ fight }: { fight: Fight }) {
  const initiallyOpen =
    fight.predictionStatus === "open" &&
    ["scheduled", "prefight"].includes(fight.status);
  const [pick, setPick] = useState<PredictionDraft>({
    winnerFighterId: "",
    method: "",
    detail: undefined,
  });
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [lookupState, setLookupState] =
    useState<PredictionLookupState>("loading");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [canSubmit, setCanSubmit] = useState(initiallyOpen);
  const [saved, setSaved] = useState<SavedPrediction | null>(null);
  const [summary, setSummary] = useState(fight.predictionSummary);
  const [reveal, setReveal] = useState(false);
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
  const { setState: setPredictionScoringState } = usePredictionScoring();

  useEffect(() => {
    setPredictionScoringState({
      lookupState,
      canSubmit,
      hasPrediction: Boolean(saved),
      ...(saved?.grade ? { grade: saved.grade } : {}),
    });
  }, [canSubmit, lookupState, saved, setPredictionScoringState]);

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
        if (!active) return;
        const isAuthenticated = data.authenticated === true;
        setAuthenticated(isAuthenticated);
        if (!isAuthenticated) {
          setLookupState("ready");
          return;
        }
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
        setLookupState("ready");
      })
      .catch((caught: unknown) => {
        if (
          active &&
          (!(caught instanceof Error) || caught.name !== "AbortError")
        )
          setLookupState("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fight, initiallyOpen, lookupAttempt]);

  useEffect(() => {
    const dialog = confirmationDialog.current;
    if (!dialog) return;
    if (confirming && !dialog.open) dialog.showModal();
    if (!confirming && dialog.open) dialog.close();
  }, [confirming]);

  if (lookupState === "loading") return <PredictionExperienceLoading />;
  if (lookupState === "error")
    return (
      <PredictionExperienceError
        retry={() => {
          setLookupState("loading");
          setLookupAttempt((current) => current + 1);
        }}
      />
    );

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
  const submissionDisabled = isPredictionSubmissionDisabled({
    busy,
    canSubmit,
    winnerFighterId: pick.winnerFighterId,
  });
  const panelMode = getPredictionPanelMode(Boolean(saved), canSubmit);
  const detailOptions = Array.from(
    { length: fight.scheduledRounds },
    (_, index) => index + 1,
  );

  if (panelMode === "locked")
    return (
      <>
        <PredictionClosedNotice />
        <ConsensusCard
          fight={fight}
          predictionClosed
          reveal={reveal}
          summary={summary}
        />
      </>
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
                        ? "border-fl-accent bg-fl-accent-soft text-fl-text"
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
                    {pick.method ? "No extra detail" : "Choose a method first"}
                  </span>
                )}
              </label>
            </div>

            <button
              className="focus-ring mt-7 inline-flex min-h-12 max-w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-6 text-sm font-bold transition enabled:border-fl-accent enabled:bg-fl-accent enabled:text-fl-bg enabled:shadow-[0_10px_28px_rgba(241,64,29,0.18)] enabled:hover:bg-fl-accent-strong disabled:cursor-not-allowed disabled:border-fl-border disabled:bg-fl-surface-2 disabled:text-fl-text-dim disabled:shadow-none sm:px-7"
              disabled={submissionDisabled}
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
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(92vw,32rem)] overflow-y-auto rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/75"
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
