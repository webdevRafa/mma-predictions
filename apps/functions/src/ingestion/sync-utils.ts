import { createHash } from "node:crypto";

type PlainRecord = Record<string, unknown>;

export function record(value: unknown): PlainRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PlainRecord)
    : {};
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as PlainRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function checksum(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function applyManualOverrides<T extends PlainRecord>(
  providerValue: T,
  overrides: unknown,
  allowedRoots: ReadonlySet<string>,
): T {
  const safeOverrides = Object.fromEntries(
    Object.entries(record(overrides)).filter(([key]) => allowedRoots.has(key)),
  );
  return { ...providerValue, ...safeOverrides };
}

export const EVENT_OVERRIDE_ROOTS = new Set([
  "name",
  "shortName",
  "eventNumber",
  "status",
  "startsAt",
  "venueTimezone",
  "venue",
  "mainEventFightId",
  "editorial",
  "monetizationEligible",
  "dataQuality",
]);

export const FIGHT_OVERRIDE_ROOTS = new Set([
  "cardSegment",
  "boutOrder",
  "status",
  "weightClass",
  "isTitleFight",
  "titleType",
  "scheduledRounds",
  "estimatedStartsAt",
  "result",
  "editorial",
  "monetizationEligible",
  "dataQuality",
]);

export const FIGHTER_OVERRIDE_ROOTS = new Set([
  "name",
  "status",
  "countryCode",
  "birthDate",
  "stance",
  "heightCm",
  "reachCm",
  "currentWeightClass",
  "record",
  "careerStats",
  "dataQuality",
]);

export function changedFields(previous: unknown, next: unknown) {
  const left = record(previous);
  const right = record(next);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => stableStringify(left[key]) !== stableStringify(right[key]))
    .sort();
}
