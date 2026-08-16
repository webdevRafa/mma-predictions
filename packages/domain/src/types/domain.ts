export type Promotion = "ufc";
export type EventStatus = "draft" | "scheduled" | "live" | "completed" | "canceled" | "postponed";
export type FightStatus = "scheduled" | "prefight" | "walkouts" | "intros" | "in_progress" | "end_of_round" | "completed" | "canceled" | "postponed";
export type PredictionStatus = "open" | "locked" | "grading" | "graded" | "void";
export type CardSegment = "early_prelims" | "prelims" | "main_card";
export type ResultMethod = "ko_tko" | "submission" | "decision_unanimous" | "decision_split" | "decision_majority" | "dq" | "draw" | "no_contest" | "overturned" | "other";
export type PredictionMethod = "ko_tko" | "submission" | "decision" | "other";
export type DataQuality = "verified" | "complete" | "partial" | "blocked";

export interface FighterName {
  full: string;
  first?: string | undefined;
  last?: string | undefined;
  nickname?: string | undefined;
  normalized: string;
}

export interface FighterRecord {
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
}

export interface CareerStats {
  significantStrikesLandedPerMinute?: number | undefined;
  significantStrikeAccuracy?: number | undefined;
  significantStrikeDefense?: number | undefined;
  takedownsPer15?: number | undefined;
  takedownAccuracy?: number | undefined;
  takedownDefense?: number | undefined;
  submissionsPer15?: number | undefined;
}

export interface Fighter {
  id: string;
  slug: string;
  slugHistory: string[];
  name: FighterName;
  status: "active" | "inactive" | "unknown";
  countryCode?: string | undefined;
  birthDate?: string | undefined;
  stance?: "orthodox" | "southpaw" | "switch" | "open" | "unknown" | undefined;
  heightCm?: number | undefined;
  reachCm?: number | undefined;
  currentWeightClass?: string | undefined;
  record: FighterRecord;
  careerStats?: CareerStats | undefined;
  dataQuality: DataQuality;
  updatedAt: string;
}

export interface FighterSnapshot {
  id: string;
  slug: string;
  name: FighterName;
  record: FighterRecord;
  countryCode?: string | undefined;
}

export interface Venue {
  name?: string | undefined;
  city?: string | undefined;
  region?: string | undefined;
  countryCode?: string | undefined;
}

export interface Event {
  id: string;
  slug: string;
  slugHistory: string[];
  promotion: Promotion;
  name: string;
  shortName: string;
  eventNumber?: number | undefined;
  status: EventStatus;
  startsAt: string;
  venueTimezone: string;
  venue?: Venue | undefined;
  mainEventFightId?: string | undefined;
  fightCount: number;
  cardSegments: { earlyPrelims: number; prelims: number; mainCard: number };
  predictionSummary: { totalPredictions: number; uniquePredictors: number };
  chatRoomId: string;
  editorial?: { summary?: string | undefined; status: "missing" | "draft" | "reviewed" | "published" } | undefined;
  monetizationEligible: boolean;
  dataQuality: DataQuality;
  updatedAt: string;
}

export interface FightEditorial {
  biggestQuestion?: string | undefined;
  styleContrast?: string | undefined;
  keysForFighterA?: string[] | undefined;
  keysForFighterB?: string[] | undefined;
  fightLobbyTake?: string | undefined;
  status: "missing" | "draft" | "reviewed" | "published";
}

export interface FightResult {
  winnerFighterId?: string | undefined;
  method: ResultMethod;
  methodDetail?: string | undefined;
  round?: number | undefined;
  timeInRoundSeconds?: number | undefined;
  resultVersion: number;
  official: boolean;
  updatedAt: string;
}

export interface PredictionSummary {
  total: number;
  fighterA: number;
  fighterB: number;
  methods: Record<string, number>;
  rounds: Record<string, number>;
  lastAggregatedAt?: string | undefined;
}

export interface Fight {
  id: string;
  slug: string;
  slugHistory: string[];
  eventId: string;
  cardSegment: CardSegment;
  boutOrder: number;
  status: FightStatus;
  predictionStatus: PredictionStatus;
  fighterAId: string;
  fighterBId: string;
  fighterA: FighterSnapshot;
  fighterB: FighterSnapshot;
  weightClass: string;
  isTitleFight: boolean;
  titleType?: "undisputed" | "interim" | "bmf" | "other" | undefined;
  scheduledRounds: 3 | 5;
  estimatedStartsAt?: string | undefined;
  predictionsLockedAt?: string | undefined;
  result?: FightResult | undefined;
  replacedByFightId?: string | undefined;
  predictionSummary: PredictionSummary;
  chatRoomId: string;
  editorial: FightEditorial;
  monetizationEligible: boolean;
  dataQuality: DataQuality;
  updatedAt: string;
}

export interface PredictionPick {
  winnerFighterId: string;
  method: PredictionMethod;
  detail?: number | "unanimous" | "split" | "majority" | undefined;
  confidence: number;
}

export interface EventCard {
  event: Event;
  fights: Fight[];
  fighters: Fighter[];
}
