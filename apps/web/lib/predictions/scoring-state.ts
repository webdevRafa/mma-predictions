export type MatchScoringPanelMode =
  "loading" | "explainer" | "earned" | "pending" | "hidden";

export function getMatchScoringPanelMode({
  lookupState,
  canSubmit,
  hasPrediction,
  hasResult,
  hasGrade,
}: {
  lookupState: "loading" | "ready" | "error";
  canSubmit: boolean;
  hasPrediction: boolean;
  hasResult: boolean;
  hasGrade: boolean;
}): MatchScoringPanelMode {
  if (lookupState === "loading") return "loading";
  if (hasPrediction && hasGrade) return "earned";
  if (hasPrediction && hasResult) return "pending";
  if (hasPrediction || canSubmit) return "explainer";
  return "hidden";
}
