export function formatForumTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(value).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function forumRelativeTime(value: number, now = Date.now()) {
  const seconds = Math.round((value - now) / 1_000);
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, range] of ranges) {
    if (Math.abs(seconds) >= range)
      return formatter.format(Math.round(seconds / range), unit);
  }
  return "just now";
}
