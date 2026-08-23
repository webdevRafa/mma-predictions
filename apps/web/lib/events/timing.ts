import type { EventStatus } from "@fightlobby/domain";

const HOUR_MS = 60 * 60 * 1_000;
const LIVE_WINDOW_AFTER_MAIN_CARD_MS = 6 * HOUR_MS;

export type EventTimingPhase =
  | "upcoming"
  | "prelims_live"
  | "main_card_live"
  | "awaiting_results"
  | "completed"
  | "canceled"
  | "postponed";

export interface EventScheduleInput {
  status: EventStatus;
  startsAt: string;
  prelimsStartsAt?: string | undefined;
  mainCardStartsAt?: string | undefined;
}

export function resolveEventSchedule(event: EventScheduleInput) {
  const mainCardStartsAt = event.mainCardStartsAt ?? event.startsAt;
  return {
    prelimsStartsAt: event.prelimsStartsAt ?? mainCardStartsAt,
    mainCardStartsAt,
  };
}

export function getEventTimingPhase(
  event: EventScheduleInput,
  now = Date.now(),
): EventTimingPhase {
  if (event.status === "completed") return "completed";
  if (event.status === "canceled") return "canceled";
  if (event.status === "postponed") return "postponed";

  const { prelimsStartsAt, mainCardStartsAt } = resolveEventSchedule(event);
  const prelimsAt = new Date(prelimsStartsAt).getTime();
  const mainCardAt = new Date(mainCardStartsAt).getTime();

  if (now < prelimsAt) return "upcoming";
  if (now < mainCardAt) return "prelims_live";
  if (
    event.status === "live" ||
    now < mainCardAt + LIVE_WINDOW_AFTER_MAIN_CARD_MS
  )
    return "main_card_live";
  return "awaiting_results";
}

export function eventPhaseLabel(phase: EventTimingPhase) {
  switch (phase) {
    case "upcoming":
      return "Next UFC event";
    case "prelims_live":
    case "main_card_live":
      return "Happening now";
    case "completed":
      return "Event complete";
    case "canceled":
      return "Event canceled";
    case "postponed":
      return "Event postponed";
    case "awaiting_results":
      return "Event concluded";
  }
}

function clock(distance: number) {
  const totalSeconds = Math.max(0, Math.floor(distance / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function countdown(distance: number) {
  if (distance <= 24 * HOUR_MS) return clock(distance);
  const days = Math.floor(distance / (24 * HOUR_MS));
  const hours = Math.floor((distance % (24 * HOUR_MS)) / HOUR_MS);
  return `${days}d ${hours}h`;
}

export function heroEventCountdownRows(
  event: EventScheduleInput,
  now = Date.now(),
) {
  const phase = getEventTimingPhase(event, now);
  const { prelimsStartsAt, mainCardStartsAt } = resolveEventSchedule(event);
  const prelimsAt = new Date(prelimsStartsAt).getTime();
  const mainCardAt = new Date(mainCardStartsAt).getTime();
  const rows = (
    prelims: string,
    mainCard: string,
  ): Array<{ label: string; value: string; dateTime: string }> => [
    { label: "Prelims", value: prelims, dateTime: prelimsStartsAt },
    { label: "Main card", value: mainCard, dateTime: mainCardStartsAt },
  ];

  if (phase === "upcoming")
    return rows(
      `${countdown(prelimsAt - now)} until prelims`,
      `${countdown(mainCardAt - now)} until main card`,
    );
  if (phase === "prelims_live")
    return rows("Live now", `${countdown(mainCardAt - now)} until main card`);
  if (phase === "main_card_live") return rows("Complete", "Live now");
  if (phase === "awaiting_results") return rows("Complete", "Awaiting results");
  if (phase === "completed") return rows("Complete", "Official results posted");
  if (phase === "postponed") return rows("Time pending", "Time pending");
  return rows("Canceled", "Canceled");
}

export function eventCountdownLabel(
  event: EventScheduleInput,
  now = Date.now(),
) {
  const phase = getEventTimingPhase(event, now);
  const { prelimsStartsAt, mainCardStartsAt } = resolveEventSchedule(event);
  const prelimsAt = new Date(prelimsStartsAt).getTime();
  const mainCardAt = new Date(mainCardStartsAt).getTime();

  if (phase === "upcoming") {
    const distance = prelimsAt - now;
    return `${countdown(distance)} until prelims`;
  }
  if (phase === "prelims_live")
    return `Prelims live · main card in ${clock(mainCardAt - now)}`;
  if (phase === "main_card_live") return "Main card live";
  if (phase === "awaiting_results") return "Awaiting official results";
  if (phase === "completed") return "Official results posted";
  if (phase === "postponed") return "New start time pending";
  return "Event canceled";
}

export function isClockDerivedLive(phase: EventTimingPhase) {
  return phase === "prelims_live" || phase === "main_card_live";
}
