export type DataSource = 'firestore' | 'local-json'

export type CardSection = 'main_event' | 'main_card' | 'prelims' | string

export interface FighterRecord {
  wins: number
  losses: number
  draws: number
  no_contests?: number
}

export interface FighterStats {
  sig_str_landed_per_min?: number
  sig_str_accuracy_pct?: number
  sig_str_absorbed_per_min?: number
  sig_str_defense_pct?: number
  takedown_avg_per_15_min?: number
  takedown_accuracy_pct?: number
  takedown_defense_pct?: number
  submission_avg_per_15_min?: number
}

export interface FighterPhysical {
  height?: string
  weight_lbs?: number
  reach_inches?: number
  stance?: string
  dob?: string
}

export interface FighterDataQuality {
  official_ufc_rate_metrics_complete?: boolean
  official_ufc_rate_metrics_present_fields?: string[]
  official_ufc_rate_metrics_missing_fields?: string[]
  estimated_fields?: string[]
  warning?: string
  [key: string]: unknown
}

export interface ProCareerSummary {
  source_scope?: string
  wins_by_ko_tko?: number
  wins_by_submission?: number
  wins_by_decision?: number
  losses_by_ko_tko?: number
  losses_by_submission?: number
  losses_by_decision?: number
  win_finish_rate_pct?: number
  wins_by_decision_pct?: number
  note?: string
  [key: string]: unknown
}

export interface Fighter {
  fighterId: string
  name: string
  record: FighterRecord
  physical?: FighterPhysical
  stats?: FighterStats
  data_quality?: FighterDataQuality
  pro_career_summary?: ProCareerSummary
  ufc_or_endeavor_record?: FighterRecord
  [key: string]: unknown
}

export interface Fight {
  fightId: string
  bout_order: number
  card_section: CardSection
  weight_class: string
  rounds_scheduled: number
  fighters: string[]
  fighterIds: string[]
}

export interface MmaEvent {
  eventId: string
  name: string
  date: string
  location: string
  source_note?: string
  last_researched_date?: string
  data_notes?: string[]
  remaining_null_official_stat_fields?: number
  fights: Fight[]
  methodology_notes?: string[]
  null_audit?: {
    remaining_null_values: number
    remaining_null_paths: string[]
  }
}

export interface PrizePickLog {
  logId: string
  eventId?: string
  createdAt: string
  legs: unknown[]
  result?: 'pending' | 'won' | 'lost' | 'partial'
}
