import eventsJson from './events.json'
import fightersJson from './fighters.json'
import logsJson from './logs.json'
import prizePickOddsJson from './prizepickodds.json'
import type { Fighter, MmaEvent, PrizePickLog, PrizePickOddsSnapshot } from '../types/mma'

export const localEvents = eventsJson as MmaEvent[]
export const localFighters = fightersJson as Fighter[]
export const localLogs = logsJson as PrizePickLog[]
export const localPrizePickOdds = prizePickOddsJson as PrizePickOddsSnapshot[]
