export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  try {
    const parsed = new URL(value, "https://fightlobby.local");
    return parsed.origin === "https://fightlobby.local"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
