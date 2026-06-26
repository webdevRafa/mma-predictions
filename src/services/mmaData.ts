import { collection, getDocs } from 'firebase/firestore'
import { localEvents, localFighters } from '../data/localData'
import { db } from '../firebase/firestore'
import type { DataSource, Fighter, MmaEvent } from '../types/mma'

export interface LoadedMmaData {
  fighters: Fighter[]
  events: MmaEvent[]
  source: DataSource
  error?: string
}

export async function loadMmaData(): Promise<LoadedMmaData> {
  if (!db) {
    return getLocalMmaData('Firebase config is not available in this runtime.')
  }

  try {
    const [fighterSnapshot, eventSnapshot] = await Promise.all([
      getDocs(collection(db, 'fighters')),
      getDocs(collection(db, 'events')),
    ])

    const fighters = fighterSnapshot.docs
      .map((doc) => doc.data() as Fighter)
      .sort(sortFightersByName)
    const events = eventSnapshot.docs
      .map((doc) => doc.data() as MmaEvent)
      .sort(sortEventsByDate)

    if (fighters.length === 0 || events.length === 0) {
      return getLocalMmaData('Firestore returned no seeded MMA Codex data.')
    }

    return {
      fighters,
      events,
      source: 'firestore',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firestore read failed.'
    return getLocalMmaData(message)
  }
}

export function getNextEvent(events: MmaEvent[], now = new Date()): MmaEvent | undefined {
  const today = formatLocalDate(now)
  const sortedEvents = [...events].sort(sortEventsByDate)
  return (
    sortedEvents.find((event) => event.date >= today) ??
    sortedEvents[sortedEvents.length - 1]
  )
}

export function indexFightersById(fighters: Fighter[]): Map<string, Fighter> {
  return new Map(fighters.map((fighter) => [fighter.fighterId, fighter]))
}

function getLocalMmaData(error?: string): LoadedMmaData {
  return {
    fighters: [...localFighters].sort(sortFightersByName),
    events: [...localEvents].sort(sortEventsByDate),
    source: 'local-json',
    error,
  }
}

function sortFightersByName(first: Fighter, second: Fighter): number {
  return first.name.localeCompare(second.name)
}

function sortEventsByDate(first: MmaEvent, second: MmaEvent): number {
  return first.date.localeCompare(second.date)
}

function formatLocalDate(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}
