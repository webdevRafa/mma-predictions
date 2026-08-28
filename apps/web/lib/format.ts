import type {
  CardSegment,
  FighterRecord,
  FightStatus,
} from "@fightlobby/domain";

export function formatRecord(record: FighterRecord) {
  const base = `${record.wins}-${record.losses}-${record.draws}`;
  return record.noContests > 0 ? `${base} (${record.noContests} NC)` : base;
}

function formatInches(value: number) {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatHeightMeasurement(valueCm: number | undefined) {
  if (valueCm === undefined) return "—";
  const totalInches = Math.round((valueCm / 2.54) * 2) / 2;
  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  return `${feet}′${formatInches(remainingInches)}″ · ${Math.round(valueCm)} cm`;
}

export function formatReachMeasurement(valueCm: number | undefined) {
  if (valueCm === undefined) return "—";
  return `${formatInches(valueCm / 2.54)} in · ${Math.round(valueCm)} cm`;
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

export function formatEventDateCompact(isoDate: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoDate));
}

export function formatCompactDate(isoDate: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
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
