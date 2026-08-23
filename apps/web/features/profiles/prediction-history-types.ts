export type PredictionHistoryStatus = "active" | "locked" | "graded" | "void";

export interface PredictionHistoryEvent {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  startsAt: string;
  status: string;
}

export interface PredictionHistoryEntry {
  fightId: string;
  fightSlug: string;
  eventId: string;
  eventName: string;
  eventShortName: string;
  eventSlug: string;
  eventStartsAt: string;
  boutOrder: number;
  fighterAName: string;
  fighterBName: string;
  selectedWinnerName: string;
  method: "ko_tko" | "submission" | "decision";
  detail?: number | "unanimous" | "split" | "majority";
  status: PredictionHistoryStatus;
  points?: number;
  winnerCorrect?: boolean;
  resultSummary: string;
}

export interface PredictionHistory {
  events: PredictionHistoryEvent[];
  entries: PredictionHistoryEntry[];
}
