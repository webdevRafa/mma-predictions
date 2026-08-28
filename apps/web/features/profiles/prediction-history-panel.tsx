"use client";

import { BarChart3, ChevronDown, Clock3, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

import type {
  PredictionHistory,
  PredictionHistoryEntry,
} from "./prediction-history-types";

const ALL_EVENTS = "all";
const MOBILE_HEADER_HEIGHT = 64;
const SCROLL_DIRECTION_THRESHOLD = 8;

function EventFilter({
  compact = false,
  eventId,
  events,
  onChange,
}: {
  compact?: boolean;
  eventId: string;
  events: PredictionHistory["events"];
  onChange: (eventId: string) => void;
}) {
  return (
    <label
      className={cn(
        "min-w-0",
        compact
          ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3"
          : "block sm:w-72",
      )}
    >
      <span
        className={cn(
          "block font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase",
          compact ? "whitespace-nowrap" : "mb-2",
        )}
      >
        By event
      </span>
      <span className="relative block min-w-0">
        <select
          aria-label="Filter predictions by event"
          className={cn(
            "focus-ring w-full appearance-none rounded-lg border border-fl-border bg-fl-surface-2 px-4 pr-11 text-sm font-bold text-fl-text transition hover:border-fl-text-muted",
            compact ? "h-11" : "h-12",
          )}
          onChange={(event) => onChange(event.target.value)}
          value={eventId}
        >
          <option value={ALL_EVENTS}>All events</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.shortName}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-fl-text-dim"
          size={16}
        />
      </span>
    </label>
  );
}

function pickDetail(entry: PredictionHistoryEntry) {
  const method = {
    ko_tko: "KO/TKO",
    submission: "Submission",
    decision: "Decision",
  }[entry.method];
  const detail =
    typeof entry.detail === "number"
      ? `Round ${entry.detail}`
      : entry.detail
        ? `${entry.detail[0]?.toUpperCase()}${entry.detail.slice(1)}`
        : undefined;
  return [method, detail].filter(Boolean).join(" · ");
}

function pointsLabel(entry: PredictionHistoryEntry) {
  if (entry.status === "active") return "Open";
  if (entry.status === "locked") return "Pending";
  if (entry.status === "void") return "Void";
  return `+${entry.points ?? 0}`;
}

function pointsContext(entry: PredictionHistoryEntry) {
  if (entry.status === "active") return "Pick locked in";
  if (entry.status === "locked") return "Awaiting result";
  if (entry.status === "void") return "Not scored";
  if (entry.points === 10) return "Perfect read";
  if ((entry.points ?? 0) >= 8) return "Winner + method";
  if ((entry.points ?? 0) >= 5) return "Winner called";
  return "No points";
}

function pointsTone(entry: PredictionHistoryEntry) {
  if (entry.status === "void") return "text-fl-text-dim";
  if (entry.status !== "graded") return "text-fl-info";
  return (entry.points ?? 0) > 0 ? "text-fl-success" : "text-fl-text-muted";
}

export function summarizePredictionHistory(entries: PredictionHistoryEntry[]) {
  const graded = entries.filter((entry) => entry.status === "graded");
  const correctWinners = graded.filter(
    (entry) => entry.winnerCorrect === true,
  ).length;
  return {
    points: graded.reduce((total, entry) => total + (entry.points ?? 0), 0),
    gradedPicks: graded.length,
    accuracy:
      graded.length > 0
        ? Math.round((correctWinners / graded.length) * 100)
        : 0,
  };
}

function DesktopHistoryTable({
  entries,
}: {
  entries: PredictionHistoryEntry[];
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">Prediction history</caption>
        <thead className="bg-fl-surface-2">
          <tr className="font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase">
            <th className="w-[24%] px-5 py-3 font-medium">Fight</th>
            <th className="w-[19%] px-5 py-3 font-medium">Event</th>
            <th className="w-[21%] px-5 py-3 font-medium">Pick</th>
            <th className="w-[25%] px-5 py-3 font-medium">Result</th>
            <th className="w-[11%] px-5 py-3 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              className="border-t border-fl-border align-top"
              key={entry.fightId}
            >
              <td className="px-5 py-5">
                <Link
                  className="focus-ring rounded-sm text-sm font-bold text-fl-text transition hover:text-fl-accent"
                  href={`/fights/${entry.fightSlug}`}
                >
                  {entry.fighterAName}
                  <span className="mx-1.5 text-fl-text-dim">vs</span>
                  {entry.fighterBName}
                </Link>
              </td>
              <td className="px-5 py-5">
                <Link
                  className="focus-ring rounded-sm text-sm text-fl-text-muted transition hover:text-fl-text"
                  href={`/events/${entry.eventSlug}`}
                >
                  {entry.eventName}
                </Link>
              </td>
              <td className="px-5 py-5">
                <p className="text-sm font-bold text-fl-text">
                  {entry.selectedWinnerName}
                </p>
                <p className="mt-1 text-xs text-fl-text-dim">
                  {pickDetail(entry)}
                </p>
              </td>
              <td className="px-5 py-5 text-sm leading-5 text-fl-text-muted">
                {entry.resultSummary}
              </td>
              <td className="px-5 py-5 text-right">
                <p
                  className={cn(
                    "font-display text-2xl font-extrabold",
                    pointsTone(entry),
                  )}
                >
                  {pointsLabel(entry)}
                </p>
                <p className="mt-1 text-[10px] text-fl-text-dim">
                  {pointsContext(entry)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileHistoryCards({
  entries,
  owner,
}: {
  entries: PredictionHistoryEntry[];
  owner: boolean;
}) {
  return (
    <div className="divide-y divide-fl-border lg:hidden">
      {entries.map((entry) => (
        <article className="p-5" key={entry.fightId}>
          <Link
            className="focus-ring inline-flex rounded-sm font-mono text-[10px] tracking-[.08em] text-fl-text-dim uppercase transition hover:text-fl-accent"
            href={`/events/${entry.eventSlug}`}
          >
            {entry.eventName}
          </Link>
          <Link
            className="focus-ring mt-2 block rounded-sm font-display text-2xl leading-tight font-bold text-fl-text transition hover:text-fl-accent"
            href={`/fights/${entry.fightSlug}`}
          >
            {entry.fighterAName}
            <span className="mx-2 text-fl-text-dim">vs</span>
            {entry.fighterBName}
          </Link>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-fl-border pt-4">
            <div className="min-w-0">
              <p className="eyebrow">{owner ? "Your pick" : "Pick"}</p>
              <p className="mt-2 text-sm font-bold text-fl-text">
                {entry.selectedWinnerName}
              </p>
              <p className="mt-1 text-xs leading-5 text-fl-text-dim">
                {pickDetail(entry)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Result</p>
              <p className="mt-2 text-sm leading-5 text-fl-text-muted">
                {entry.resultSummary}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4 rounded-xl bg-fl-surface-2 px-4 py-3">
            <div>
              <p className="eyebrow">Score</p>
              <p className="mt-1 text-xs text-fl-text-muted">
                {pointsContext(entry)}
              </p>
            </div>
            <p
              className={cn(
                "font-display text-3xl font-extrabold",
                pointsTone(entry),
              )}
            >
              {pointsLabel(entry)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function PredictionHistoryPanel({
  history,
  owner = false,
}: {
  history: PredictionHistory;
  owner?: boolean;
}) {
  const [eventId, setEventId] = useState(ALL_EVENTS);
  const [mobileFilterVisible, setMobileFilterVisible] = useState(true);
  const mobileFilterRef = useRef<HTMLDivElement>(null);
  const mobileFilterSentinelRef = useRef<HTMLDivElement>(null);
  const entries = useMemo(
    () =>
      eventId === ALL_EVENTS
        ? history.entries
        : history.entries.filter((entry) => entry.eventId === eventId),
    [eventId, history.entries],
  );
  const summary = useMemo(() => summarizePredictionHistory(entries), [entries]);
  const stats = [
    { icon: Trophy, label: "Points", value: summary.points.toLocaleString() },
    {
      icon: BarChart3,
      label: "Graded picks",
      value: summary.gradedPicks.toLocaleString(),
    },
    { icon: Target, label: "Winner accuracy", value: `${summary.accuracy}%` },
  ];

  useEffect(() => {
    if (history.events.length === 0) return;

    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let lastScrollY = window.scrollY;
    let frameId: number | undefined;

    const showFilter = (visible: boolean) => {
      setMobileFilterVisible((current) =>
        current === visible ? current : visible,
      );
    };
    const updateFilter = () => {
      frameId = undefined;
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;
      const sentinel = mobileFilterSentinelRef.current;
      const filterHasFocus = mobileFilterRef.current?.contains(
        document.activeElement,
      );

      if (!mobileQuery.matches || reducedMotionQuery.matches || !sentinel) {
        showFilter(true);
        lastScrollY = currentScrollY;
        return;
      }

      const filterHasReachedHeader =
        sentinel.getBoundingClientRect().top <= MOBILE_HEADER_HEIGHT;

      if (!filterHasReachedHeader || filterHasFocus) {
        showFilter(true);
        lastScrollY = currentScrollY;
        return;
      }

      if (scrollDelta >= SCROLL_DIRECTION_THRESHOLD) {
        showFilter(false);
        lastScrollY = currentScrollY;
      } else if (scrollDelta <= -SCROLL_DIRECTION_THRESHOLD) {
        showFilter(true);
        lastScrollY = currentScrollY;
      }
    };
    const handleScroll = () => {
      if (frameId !== undefined) return;
      frameId = window.requestAnimationFrame(updateFilter);
    };
    const handlePreferenceChange = () => {
      lastScrollY = window.scrollY;
      showFilter(true);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    mobileQuery.addEventListener("change", handlePreferenceChange);
    reducedMotionQuery.addEventListener("change", handlePreferenceChange);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mobileQuery.removeEventListener("change", handlePreferenceChange);
      reducedMotionQuery.removeEventListener("change", handlePreferenceChange);
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
    };
  }, [history.events.length]);

  return (
    <Card className="overflow-visible sm:overflow-hidden">
      <CardHeader
        eyebrow="Prediction record"
        title={owner ? "Your predictions" : "Prediction history"}
        description={
          owner
            ? "Review every pick you have locked in and how it scored."
            : "Locked picks and official scores, event by event."
        }
      />
      <div className="flex flex-col gap-4 border-b border-fl-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-semibold text-fl-text">
            {entries.length === 1
              ? "1 prediction"
              : `${entries.length.toLocaleString()} predictions`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fl-text-dim">
            <Clock3 aria-hidden="true" size={13} /> Newest events first
          </p>
        </div>
        {history.events.length > 0 ? (
          <div className="hidden sm:block">
            <EventFilter
              eventId={eventId}
              events={history.events}
              onChange={setEventId}
            />
          </div>
        ) : null}
      </div>
      {history.events.length > 0 ? (
        <>
          <div
            aria-hidden="true"
            className="h-px sm:hidden"
            ref={mobileFilterSentinelRef}
          />
          <div
            className={cn(
              "sticky top-16 z-30 border-b border-fl-border bg-fl-surface-1/95 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out will-change-transform sm:hidden",
              mobileFilterVisible
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-full opacity-0",
            )}
            data-mobile-event-filter
            onFocus={() => setMobileFilterVisible(true)}
            ref={mobileFilterRef}
          >
            <EventFilter
              compact
              eventId={eventId}
              events={history.events}
              onChange={setEventId}
            />
          </div>
        </>
      ) : null}
      <div className="grid grid-cols-3 gap-px border-b border-fl-border bg-fl-border">
        {stats.map(({ icon: Icon, label, value }) => (
          <div className="bg-fl-surface-1 p-4 sm:p-5" key={label}>
            <Icon aria-hidden="true" className="text-fl-accent" size={16} />
            <p className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">
              {value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-fl-text-muted sm:text-xs">
              {label}
            </p>
          </div>
        ))}
      </div>
      {entries.length > 0 ? (
        <>
          <DesktopHistoryTable entries={entries} />
          <MobileHistoryCards entries={entries} owner={owner} />
        </>
      ) : (
        <div className="px-5 py-12 text-center sm:px-6">
          <p className="font-display text-2xl font-bold">No predictions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fl-text-muted">
            {owner
              ? "Once you lock in a fight pick, it will appear here automatically."
              : "This member does not have any visible predictions for this view."}
          </p>
          {owner ? (
            <Link
              className="focus-ring mt-5 inline-flex rounded-md text-sm font-bold text-fl-accent"
              href="/events"
            >
              Browse upcoming events
            </Link>
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function PredictionHistoryPanelSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading prediction history">
      <div className="border-b border-fl-border px-5 py-5 sm:px-6">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-3 h-7 w-48" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <div className="flex items-end justify-between gap-5 border-b border-fl-border p-5 sm:p-6">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
        <Skeleton className="h-12 w-72 max-w-[55%]" />
      </div>
      <div className="grid grid-cols-3 gap-px bg-fl-border">
        {[0, 1, 2].map((item) => (
          <div className="bg-fl-surface-1 p-4 sm:p-5" key={item}>
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="mt-3 h-8 w-14" />
            <Skeleton className="mt-2 h-3 w-20 max-w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-px bg-fl-border">
        {[0, 1, 2].map((item) => (
          <div className="bg-fl-surface-1 p-5" key={item}>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-6 w-64 max-w-full" />
            <Skeleton className="mt-4 h-14 w-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
