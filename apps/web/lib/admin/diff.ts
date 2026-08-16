import "server-only";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function providerDiff(canonicalValue: unknown, stateValue: unknown) {
  const canonical = record(canonicalValue);
  const state = record(stateValue);
  const provider = record(state.providerData);
  const overrides = record(state.manualOverrides);
  return [...new Set([...Object.keys(provider), ...Object.keys(overrides)])]
    .filter(
      (field) =>
        !["id", "slug", "slugHistory", "updatedAt"].includes(field) &&
        (stable(provider[field]) !== stable(canonical[field]) ||
          field in overrides),
    )
    .sort()
    .map((field) => ({
      field,
      provider: provider[field],
      canonical: canonical[field],
      override: overrides[field],
      overridden: field in overrides,
    }));
}
