import type {
  CardSegment,
  FighterRecord,
  FightStatus,
} from "@fightlobby/domain";

export function formatRecord(record: FighterRecord) {
  const base = `${record.wins}-${record.losses}-${record.draws}`;
  return record.noContests > 0 ? `${base} (${record.noContests} NC)` : base;
}

export function formatEventDate(isoDate: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoDate));
}

export function formatEventDateWithZone(isoDate: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(isoDate));
}

export function formatCompactDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatUpdatedAt(isoDate: string) {
  return new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(
    Math.round((new Date(isoDate).getTime() - Date.now()) / 86_400_000),
    "day",
  );
}

export function formatCardSegment(segment: CardSegment) {
  return {
    early_prelims: "Early prelims",
    prelims: "Prelims",
    main_card: "Main card",
  }[segment];
}

export function isFightLive(status: FightStatus) {
  return ["walkouts", "intros", "in_progress", "end_of_round"].includes(status);
}

export function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
