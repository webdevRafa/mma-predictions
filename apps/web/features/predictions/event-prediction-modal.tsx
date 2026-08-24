"use client";

import {
  validatePredictionForFight,
  type Fight,
  type PredictionGrade,
  type PredictionMethod,
  type PredictionPick,
} from "@fightlobby/domain";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AuthForm } from "@/features/auth/auth-form";
import { HandleForm } from "@/features/auth/handle-form";
import { cn } from "@/lib/cn";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";

interface SavedPrediction {
  fightId: string;
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

type AuthMode = "login" | "signup";
type View = "card" | "auth" | "handle";
type PredictionLookupState = "idle" | "loading" | "ready" | "error";

const methodOptions: { value: PredictionMethod; label: string }[] = [
  { value: "ko_tko", label: "KO / TKO" },
  { value: "submission", label: "Submission" },
  { value: "decision", label: "Decision" },
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function apiError(value: unknown, fallback: string) {
  const error = record(record(value).error);
  return typeof error.message === "string" ? error.message : fallback;
}

function defaultDetail(method: PredictionMethod): PredictionPick["detail"] {
  if (method === "ko_tko" || method === "submission") return 1;
  return "unanimous";
}

function methodLabel(method: PredictionMethod | "") {
  return methodOptions.find((option) => option.value === method)?.label ?? "—";
}

function detailLabel(detail: PredictionPick["detail"]) {
  if (typeof detail === "number") return `Round ${detail}`;
  if (typeof detail === "string") {
    return `${detail[0]?.toUpperCase()}${detail.slice(1)} decision`;
  }
  return "—";
}

function compactDetailLabel(detail: PredictionPick["detail"]) {
  if (typeof detail === "number") return `R${detail}`;
  if (typeof detail === "string") {
    return `${detail[0]?.toUpperCase()}${detail.slice(1)}`;
  }
  return null;
}

function fighterName(fight: Fight, fighterId: string) {
  return fight.fighterA.id === fighterId
    ? fight.fighterA.name.full
    : fight.fighterB.id === fighterId
      ? fight.fighterB.name.full
      : "Unknown fighter";
}

function emptyDraft(): PredictionDraft {
  return { winnerFighterId: "", method: "", detail: undefined };
}

function parseSaved(value: unknown, fight: Fight): SavedPrediction | null {
  const source = record(value);
  const validated = validatePredictionForFight(source.pick, fight);
  if (
    source.fightId !== fight.id ||
    !validated.success ||
    !["active", "locked", "graded", "void"].includes(String(source.status)) ||
    typeof source.predictionVersion !== "number" ||
    typeof source.submittedAt !== "string"
  ) {
    return null;
  }
  return {
    fightId: fight.id,
    pick: validated.data,
    status: source.status as SavedPrediction["status"],
    predictionVersion: source.predictionVersion,
    submittedAt: source.submittedAt,
    ...(typeof source.lockedAt === "string"
      ? { lockedAt: source.lockedAt }
      : {}),
  };
}

function lockedPredictionLabel({
  fight,
  saved,
}: {
  fight: Fight;
  saved: SavedPrediction;
}) {
  return [
    fighterName(fight, saved.pick.winnerFighterId),
    methodLabel(saved.pick.method),
    compactDetailLabel(saved.pick.detail),
  ]
    .filter(Boolean)
    .join(", ");
}

export function EventPredictionModal({
  eventId,
  eventName,
  eventSlug,
  fights,
  label = "Lock in your predictions",
  className,
}: {
  eventId: string;
  eventName: string;
  eventSlug: string;
  fights: Fight[];
  label?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const loadController = useRef<AbortController | null>(null);
  const [view, setView] = useState<View>("card");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [savedByFight, setSavedByFight] = useState<
    Record<string, SavedPrediction>
  >({});
  const [drafts, setDrafts] = useState<Record<string, PredictionDraft>>({});
  const [expandedFightId, setExpandedFightId] = useState<string | null>(null);
  const [reviewFightId, setReviewFightId] = useState<string | null>(null);
  const [busyFightId, setBusyFightId] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<PredictionLookupState>("idle");
  const [error, setError] = useState<string | null>(null);

  const lockedCount = Object.keys(savedByFight).length;
  const openCount = fights.filter(
    (fight) =>
      fight.predictionStatus === "open" &&
      ["scheduled", "prefight"].includes(fight.status) &&
      !savedByFight[fight.id],
  ).length;
  const returnTo = `/events/${eventSlug}`;

  const progressLabel = useMemo(() => {
    if (lockedCount === 0) return "Choose any matchup you want to call.";
    return `${lockedCount} of ${fights.length} matchup${fights.length === 1 ? "" : "s"} predicted.`;
  }, [fights.length, lockedCount]);

  useEffect(
    () => () => {
      loadController.current?.abort();
    },
    [],
  );

  async function loadPredictions() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLookupState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/predictions/events/${eventId}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(apiError(payload, "Your picks could not be loaded."));
      const data = record(payload);
      const signedIn = data.authenticated === true;
      setAuthenticated(signedIn);
      setOnboardingComplete(data.onboardingComplete === true);
      const list = Array.isArray(data.predictions) ? data.predictions : [];
      const next: Record<string, SavedPrediction> = {};
      for (const fight of fights) {
        const saved = list.map((item) => parseSaved(item, fight)).find(Boolean);
        if (saved) next[fight.id] = saved;
      }
      setSavedByFight(next);
      setLookupState("ready");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Your picks could not be loaded.",
      );
      setLookupState("error");
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
      }
    }
  }

  function openModal() {
    setView("card");
    setError(null);
    dialog.current?.showModal();
    void loadPredictions();
  }

  function closeModal() {
    loadController.current?.abort();
    loadController.current = null;
    dialog.current?.close();
    setView("card");
    setLookupState("idle");
    setExpandedFightId(null);
    setReviewFightId(null);
  }

  function requestPrediction(fightId: string) {
    if (authenticated !== true) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    if (!onboardingComplete) {
      setView("handle");
      return;
    }
    setDrafts((current) => ({
      ...current,
      [fightId]: current[fightId] ?? emptyDraft(),
    }));
    setExpandedFightId(fightId);
    setReviewFightId(null);
    setError(null);
  }

  function updateDraft(fightId: string, update: Partial<PredictionDraft>) {
    setDrafts((current) => ({
      ...current,
      [fightId]: { ...(current[fightId] ?? emptyDraft()), ...update },
    }));
  }

  async function confirmPrediction(fight: Fight) {
    const draft = drafts[fight.id] ?? emptyDraft();
    const validated = validatePredictionForFight(draft, fight);
    if (!validated.success) {
      setError(validated.message);
      setReviewFightId(null);
      return;
    }
    setBusyFightId(fight.id);
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
          requestId: crypto.randomUUID(),
          pick: validated.data,
        }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        setView("auth");
        return;
      }
      if (
        response.status === 409 &&
        record(record(payload).error).code === "onboarding_required"
      ) {
        setOnboardingComplete(false);
        setView("handle");
        return;
      }
      if (!response.ok)
        throw new Error(apiError(payload, "Prediction could not be saved."));
      const saved = parseSaved(
        { fightId: fight.id, ...record(record(payload).prediction) },
        fight,
      );
      if (!saved) throw new Error("The saved prediction response was invalid.");
      setSavedByFight((current) => ({ ...current, [fight.id]: saved }));
      setExpandedFightId(null);
      setReviewFightId(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Prediction could not be saved.",
      );
    } finally {
      setBusyFightId(null);
    }
  }

  function authCompleted() {
    setView("card");
    void loadPredictions();
  }

  return (
    <>
      <button
        className={cn(
          "focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-fl-accent/80 bg-fl-accent/10 px-4 text-sm font-bold text-fl-text shadow-[0_8px_24px_rgba(224,12,15,0.08)] transition hover:bg-fl-accent hover:text-fl-bg hover:shadow-[0_10px_28px_rgba(224,12,15,0.18)]",
          className,
        )}
        onClick={openModal}
        type="button"
      >
        <Target aria-hidden="true" size={17} /> {label}
      </button>

      <dialog
        aria-labelledby="event-prediction-title"
        className="m-auto h-[min(94dvh,56rem)] w-[min(96vw,78rem)] overflow-hidden rounded-2xl border border-fl-border bg-fl-surface-1 p-0 text-fl-text shadow-2xl backdrop:bg-black/80 sm:h-auto sm:max-h-[92dvh]"
        onCancel={closeModal}
        ref={dialog}
      >
        <div className="flex h-full max-h-[92dvh] flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-fl-border bg-fl-surface-1 p-5 sm:p-6">
            <div>
              <p className="eyebrow">
                {view === "card"
                  ? "Fight card predictions"
                  : "FightLobby account"}
              </p>
              <h2
                className="mt-2 font-display text-3xl leading-none font-extrabold"
                id="event-prediction-title"
              >
                {view === "card"
                  ? "Make your picks"
                  : view === "handle"
                    ? "Choose your corner"
                    : authMode === "login"
                      ? "Sign in to predict"
                      : "Create your account"}
              </h2>
              {view === "card" ? (
                <div className="mt-3 max-w-2xl border-l-2 border-fl-accent pl-3">
                  <p className="font-display text-lg leading-tight font-bold text-fl-text sm:text-xl">
                    {eventName}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-fl-text-muted">
                    Pick as many or as few matchups as you want—every confirmed
                    pick is permanent.
                  </p>
                </div>
              ) : (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-fl-text-muted">
                  You’ll stay here and return to the fight card as soon as
                  you’re done.
                </p>
              )}
            </div>
            <button
              aria-label="Close predictions"
              className="focus-ring shrink-0 rounded-lg border border-fl-border p-2 text-fl-text-muted transition hover:bg-fl-surface-2 hover:text-fl-text"
              onClick={closeModal}
              type="button"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>

          <div className="fight-card-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {view === "card" ? (
              <>
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-fl-border bg-fl-surface-1/95 px-5 py-3 backdrop-blur sm:px-6">
                  {lookupState === "loading" || lookupState === "idle" ? (
                    <div aria-hidden="true">
                      <Skeleton className="h-4 w-56 max-w-full" />
                      <Skeleton className="mt-2 h-2.5 w-32" />
                    </div>
                  ) : lookupState === "error" ? (
                    <div>
                      <p className="text-sm font-bold">
                        Pick status unavailable
                      </p>
                      <p className="mt-1 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                        Retry to check your fight card
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold">{progressLabel}</p>
                      <p className="mt-1 font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
                        {openCount} matchup{openCount === 1 ? "" : "s"} still
                        open
                      </p>
                    </div>
                  )}
                  {lookupState === "loading" || lookupState === "idle" ? (
                    <span className="inline-flex items-center gap-2 text-xs text-fl-text-muted">
                      <LoaderCircle
                        aria-hidden="true"
                        className="animate-spin"
                        size={15}
                      />{" "}
                      Checking your picks
                    </span>
                  ) : null}
                </div>

                {error ? (
                  <div
                    className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fl-danger/30 bg-fl-danger/10 p-4 text-sm text-fl-danger sm:mx-6"
                    role="alert"
                  >
                    <p>{error}</p>
                    {lookupState === "error" ? (
                      <button
                        className="focus-ring min-h-9 rounded-lg border border-fl-danger/35 px-3 text-xs font-bold transition hover:bg-fl-danger/10"
                        onClick={() => void loadPredictions()}
                        type="button"
                      >
                        Try again
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div
                  aria-busy={
                    lookupState === "loading" || lookupState === "idle"
                  }
                  className="divide-y divide-fl-border"
                >
                  {fights.map((fight) => {
                    const saved = savedByFight[fight.id];
                    const draft = drafts[fight.id] ?? emptyDraft();
                    const available =
                      fight.predictionStatus === "open" &&
                      ["scheduled", "prefight"].includes(fight.status);
                    const expanded = expandedFightId === fight.id;
                    const reviewing = reviewFightId === fight.id;
                    const validated = validatePredictionForFight(draft, fight);
                    const detailOptions = Array.from(
                      { length: fight.scheduledRounds },
                      (_, index) => index + 1,
                    );

                    return (
                      <article className="p-5 sm:p-6" key={fight.id}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <p className="eyebrow">
                              {fight.cardSegment === "main_card"
                                ? "Main card"
                                : "Prelims"}{" "}
                              · {fight.weightClass}
                            </p>
                            <h3 className="mt-2 font-display text-xl font-bold sm:text-2xl">
                              {fight.fighterA.name.full}{" "}
                              <span className="mx-1 text-fl-text-dim">vs</span>{" "}
                              {fight.fighterB.name.full}
                            </h3>
                          </div>
                          {lookupState === "loading" ||
                          lookupState === "idle" ? (
                            <Skeleton className="h-11 w-40 max-w-full shrink-0 self-start lg:self-auto" />
                          ) : lookupState === "error" ? (
                            <span className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-xs font-bold text-fl-text-muted lg:self-auto">
                              <AlertCircle aria-hidden="true" size={15} />{" "}
                              Status unavailable
                            </span>
                          ) : saved ? (
                            <span
                              className="inline-flex max-w-full shrink-0 items-center gap-2 self-start rounded-full border border-fl-success/30 bg-fl-success/8 px-3 py-2 text-left text-xs leading-5 font-bold text-fl-text lg:self-auto"
                              title={`Locked prediction: ${lockedPredictionLabel({ fight, saved })}`}
                            >
                              <CheckCircle2
                                className="shrink-0 text-fl-success"
                                size={15}
                              />
                              <span>
                                {lockedPredictionLabel({ fight, saved })}
                              </span>
                            </span>
                          ) : available ? (
                            <button
                              aria-expanded={expanded}
                              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-fl-border bg-fl-surface-2 px-4 text-sm font-bold transition hover:border-fl-accent hover:text-fl-accent lg:self-auto"
                              onClick={() =>
                                expanded
                                  ? setExpandedFightId(null)
                                  : requestPrediction(fight.id)
                              }
                              type="button"
                            >
                              {expanded ? "Close picker" : "Make prediction"}{" "}
                              <ChevronDown
                                className={cn(
                                  "transition",
                                  expanded && "rotate-180",
                                )}
                                size={16}
                              />
                            </button>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-fl-border bg-fl-surface-2 px-3 py-2 text-xs font-bold text-fl-text-muted lg:self-auto">
                              <LockKeyhole size={14} /> Predictions closed
                            </span>
                          )}
                        </div>

                        {expanded && !saved ? (
                          <div className="mt-5 rounded-xl border border-fl-border bg-fl-bg/55 p-4 sm:p-5">
                            {reviewing && validated.success ? (
                              <div>
                                <div className="flex items-start gap-3 rounded-xl border border-fl-warning/30 bg-fl-warning/10 p-4">
                                  <ShieldCheck
                                    className="mt-0.5 shrink-0 text-fl-warning"
                                    size={19}
                                  />
                                  <div>
                                    <p className="text-sm font-bold">
                                      Final confirmation
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-fl-text-muted">
                                      This prediction cannot be edited or
                                      replaced after you lock it.
                                    </p>
                                  </div>
                                </div>
                                <dl className="mt-4 grid gap-px overflow-hidden rounded-xl border border-fl-border bg-fl-border sm:grid-cols-3">
                                  {[
                                    [
                                      "Winner",
                                      fighterName(
                                        fight,
                                        validated.data.winnerFighterId,
                                      ),
                                    ],
                                    [
                                      "Method",
                                      methodLabel(validated.data.method),
                                    ],
                                    [
                                      "Finish detail",
                                      detailLabel(validated.data.detail),
                                    ],
                                  ].map(([term, value]) => (
                                    <div
                                      className="bg-fl-surface-2 p-3"
                                      key={term}
                                    >
                                      <dt className="eyebrow">{term}</dt>
                                      <dd className="mt-1 text-sm font-bold">
                                        {value}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                                <div className="mt-4 flex flex-wrap justify-end gap-3">
                                  <button
                                    className="focus-ring min-h-11 rounded-lg border border-fl-border px-4 text-sm font-bold"
                                    onClick={() => setReviewFightId(null)}
                                    type="button"
                                  >
                                    Review my pick
                                  </button>
                                  <button
                                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-fl-accent px-4 text-sm font-bold text-white"
                                    disabled={busyFightId === fight.id}
                                    onClick={() =>
                                      void confirmPrediction(fight)
                                    }
                                    type="button"
                                  >
                                    {busyFightId === fight.id ? (
                                      <LoaderCircle
                                        className="animate-spin"
                                        size={16}
                                      />
                                    ) : (
                                      <LockKeyhole size={16} />
                                    )}{" "}
                                    Confirm and lock
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-5">
                                <fieldset>
                                  <legend className="text-sm font-bold">
                                    1. Pick the winner
                                  </legend>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {[fight.fighterA, fight.fighterB].map(
                                      (fighter) => (
                                        <button
                                          aria-pressed={
                                            draft.winnerFighterId === fighter.id
                                          }
                                          className={cn(
                                            "focus-ring min-h-16 rounded-xl border bg-fl-surface-2 px-4 text-left font-display text-lg font-bold transition",
                                            draft.winnerFighterId === fighter.id
                                              ? "border-fl-accent bg-fl-accent-soft text-fl-text"
                                              : "border-fl-border hover:border-fl-text-muted",
                                          )}
                                          key={fighter.id}
                                          onClick={() =>
                                            updateDraft(fight.id, {
                                              winnerFighterId: fighter.id,
                                            })
                                          }
                                          type="button"
                                        >
                                          {fighter.name.full}
                                        </button>
                                      ),
                                    )}
                                  </div>
                                </fieldset>
                                <fieldset>
                                  <legend className="text-sm font-bold">
                                    2. Choose the method
                                  </legend>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {methodOptions.map((option) => (
                                      <button
                                        aria-pressed={
                                          draft.method === option.value
                                        }
                                        className={cn(
                                          "focus-ring min-h-10 rounded-lg border px-4 text-sm transition",
                                          draft.method === option.value
                                            ? "border-fl-accent bg-fl-accent-soft font-bold text-fl-text"
                                            : "border-fl-border bg-fl-surface-2 text-fl-text-muted hover:border-fl-text-muted",
                                        )}
                                        key={option.value}
                                        onClick={() =>
                                          updateDraft(fight.id, {
                                            method: option.value,
                                            detail: defaultDetail(option.value),
                                          })
                                        }
                                        type="button"
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </fieldset>
                                {draft.method ? (
                                  <label className="block text-sm font-bold">
                                    3. Finish detail
                                    <select
                                      className="focus-ring mt-3 min-h-11 w-full rounded-lg border border-fl-border bg-fl-surface-2 px-3 text-sm"
                                      onChange={(event) =>
                                        updateDraft(fight.id, {
                                          detail:
                                            draft.method === "decision"
                                              ? (event.target
                                                  .value as PredictionPick["detail"])
                                              : Number(event.target.value),
                                        })
                                      }
                                      value={String(draft.detail ?? "")}
                                    >
                                      {draft.method === "decision" ? (
                                        <>
                                          <option value="unanimous">
                                            Unanimous decision
                                          </option>
                                          <option value="split">
                                            Split decision
                                          </option>
                                          <option value="majority">
                                            Majority decision
                                          </option>
                                        </>
                                      ) : (
                                        detailOptions.map((round) => (
                                          <option key={round} value={round}>
                                            Round {round}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  </label>
                                ) : null}
                                <div className="flex justify-end">
                                  <button
                                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-fl-accent px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!validated.success}
                                    onClick={() => setReviewFightId(fight.id)}
                                    type="button"
                                  >
                                    Review prediction <LockKeyhole size={15} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mx-auto w-full max-w-xl p-5 sm:p-8">
                <button
                  className="focus-ring mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-fl-text-muted hover:text-fl-text"
                  onClick={() => setView("card")}
                  type="button"
                >
                  <ArrowLeft size={16} /> Back to fight card
                </button>
                {view === "handle" ? (
                  <HandleForm onCompleted={authCompleted} returnTo={returnTo} />
                ) : (
                  <AuthForm
                    key={authMode}
                    mode={authMode}
                    onAuthenticated={authCompleted}
                    onModeChange={setAuthMode}
                    onOnboardingRequired={() => setView("handle")}
                    returnTo={returnTo}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
