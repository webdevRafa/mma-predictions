export interface BadgeInputs {
  gradedPicks: number;
  perfectReads: number;
  longestStreak: number;
  eventChampionships: number;
  topSeasonPercentile?: 1 | 10 | undefined;
}

export function deriveBadges(input: BadgeInputs) {
  const badges: string[] = [];
  if (input.gradedPicks > 0) badges.push("First Pick");
  if (input.perfectReads > 0) badges.push("Perfect Read");
  if (input.longestStreak >= 5) badges.push("Five-Fight Streak");
  if (input.longestStreak >= 10) badges.push("Ten-Fight Streak");
  if (input.eventChampionships > 0) badges.push("Event Champion");
  if (
    input.topSeasonPercentile !== undefined &&
    input.topSeasonPercentile <= 10
  )
    badges.push("Top 10% Season");
  if (input.topSeasonPercentile === 1) badges.push("Top 1% Season");
  return badges;
}
