import { useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import logo from './assets/logo.png'
import { useMmaData } from './hooks/useMmaData'
import { getNextEvent, indexFightersById } from './services/mmaData'
import type { DataSource, Fight, Fighter, FighterStats, MmaEvent } from './types/mma'
import './App.css'

const statRows: Array<[keyof FighterStats, string]> = [
  ['sig_str_landed_per_min', 'SLpM'],
  ['sig_str_accuracy_pct', 'Str Acc'],
  ['sig_str_absorbed_per_min', 'SApM'],
  ['sig_str_defense_pct', 'Str Def'],
  ['takedown_avg_per_15_min', 'TD Avg'],
  ['takedown_accuracy_pct', 'TD Acc'],
  ['takedown_defense_pct', 'TD Def'],
  ['submission_avg_per_15_min', 'Sub Avg'],
]

function App() {
  const { fighters, events, source, loading, error } = useMmaData()
  const fightersById = useMemo(() => indexFightersById(fighters), [fighters])
  const nextEvent = useMemo(() => getNextEvent(events), [events])

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="MMA Codex home">
          <img src={logo} alt="" />
          <span>MMA Codex</span>
        </Link>
        <nav className="tabs" aria-label="Primary">
          <NavLink to="/event">Event</NavLink>
          <NavLink to="/fighters">Fighters</NavLink>
        </nav>
      </header>

      <DataStatus loading={loading} source={source} error={error} />

      <main>
        <Routes>
          <Route path="/" element={<HomePage event={nextEvent} fighters={fighters} />} />
          <Route
            path="/event"
            element={<EventPage event={nextEvent} fightersById={fightersById} />}
          />
          <Route path="/fighters" element={<FightersPage fighters={fighters} />} />
          <Route
            path="/fighters/:fighterId"
            element={<FighterProfile fightersById={fightersById} />}
          />
        </Routes>
      </main>
    </div>
  )
}

interface DataStatusProps {
  loading: boolean
  source: DataSource
  error?: string
}

function DataStatus({ loading, source, error }: DataStatusProps) {
  if (loading) {
    return <div className="data-status">Syncing fight data...</div>
  }

  if (source === 'local-json') {
    return (
      <div className="data-status warning">
        Local JSON fallback active{error ? `: ${error}` : ''}
      </div>
    )
  }

  return <div className="data-status live">Firestore data live</div>
}

interface HomePageProps {
  event?: MmaEvent
  fighters: Fighter[]
}

function HomePage({ event, fighters }: HomePageProps) {
  return (
    <section className="home-hero">
      <div className="logo-stage">
        <img src={logo} alt="MMA Codex" />
      </div>
      <div className="home-copy">
        <p className="eyebrow">Fight analytics workspace</p>
        <h1>MMA Codex</h1>
        <p className="home-line">
          {event?.name ?? 'Upcoming UFC event'} data with {fighters.length} fighter profiles.
        </p>
      </div>
      <div className="home-actions">
        <Link className="primary-action" to="/event">
          Event
        </Link>
        <Link className="secondary-action" to="/fighters">
          Fighters
        </Link>
      </div>
    </section>
  )
}

interface EventPageProps {
  event?: MmaEvent
  fightersById: Map<string, Fighter>
}

function EventPage({ event, fightersById }: EventPageProps) {
  if (!event) {
    return <EmptyState title="No event loaded" body="Add an event seed to continue." />
  }

  const fights = [...event.fights].sort((first, second) => second.bout_order - first.bout_order)

  return (
    <section className="page-stack">
      <div className="page-heading">
        <p className="eyebrow">Next event</p>
        <h1>{event.name}</h1>
        <div className="meta-row">
          <span>{formatDate(event.date)}</span>
          <span>{event.location}</span>
          <span>{event.fights.length} bouts</span>
        </div>
      </div>

      <div className="fight-list">
        {fights.map((fight) => (
          <FightCard key={fight.fightId} fight={fight} fightersById={fightersById} />
        ))}
      </div>
    </section>
  )
}

interface FightCardProps {
  fight: Fight
  fightersById: Map<string, Fighter>
}

function FightCard({ fight, fightersById }: FightCardProps) {
  const fighters = fight.fighterIds.map((fighterId, index) => {
    return fightersById.get(fighterId) ?? fallbackFighter(fighterId, fight.fighters[index])
  })

  return (
    <article className="fight-card">
      <div className="fight-card-header">
        <span className="pill">{formatCardSection(fight.card_section)}</span>
        <span>{fight.weight_class}</span>
        <span>{fight.rounds_scheduled} rounds</span>
      </div>
      <div className="matchup-grid">
        {fighters.map((fighter) => (
          <FighterSnapshot key={fighter.fighterId} fighter={fighter} />
        ))}
      </div>
    </article>
  )
}

function FighterSnapshot({ fighter }: { fighter: Fighter }) {
  return (
    <Link className="fighter-snapshot" to={`/fighters/${fighter.fighterId}`}>
      <div>
        <h2>{fighter.name}</h2>
        <p>{formatRecord(fighter.record)}</p>
      </div>
      <MetricGrid fighter={fighter} compact />
    </Link>
  )
}

function FightersPage({ fighters }: { fighters: Fighter[] }) {
  const [query, setQuery] = useState('')
  const filteredFighters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return fighters
    }

    return fighters.filter((fighter) => {
      const searchable = [
        fighter.name,
        fighter.physical?.stance,
        String(fighter.physical?.weight_lbs ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(normalizedQuery)
    })
  }, [fighters, query])

  return (
    <section className="page-stack">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Roster</p>
          <h1>Fighters</h1>
        </div>
        <label className="search-control">
          <span>Search fighters</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, stance, weight"
          />
        </label>
      </div>

      {filteredFighters.length > 0 ? (
        <div className="fighter-directory">
          {filteredFighters.map((fighter) => (
            <FighterDirectoryCard key={fighter.fighterId} fighter={fighter} />
          ))}
        </div>
      ) : (
        <EmptyState title="No fighters found" body="Try a different search." />
      )}
    </section>
  )
}

function FighterDirectoryCard({ fighter }: { fighter: Fighter }) {
  return (
    <Link className="directory-card" to={`/fighters/${fighter.fighterId}`}>
      <div>
        <h2>{fighter.name}</h2>
        <p>{formatRecord(fighter.record)}</p>
      </div>
      <div className="directory-meta">
        <span>{fighter.physical?.stance ?? 'Stance TBD'}</span>
        <span>{formatWeight(fighter)}</span>
      </div>
      <MetricGrid fighter={fighter} compact />
    </Link>
  )
}

function FighterProfile({ fightersById }: { fightersById: Map<string, Fighter> }) {
  const { fighterId } = useParams()
  const fighter = fighterId ? fightersById.get(fighterId) : undefined

  if (!fighter) {
    return <EmptyState title="Fighter not found" body="The selected profile is not seeded yet." />
  }

  const summary = fighter.pro_career_summary
  const estimatedCount = fighter.data_quality?.estimated_fields?.length ?? 0

  return (
    <section className="page-stack fighter-profile">
      <Link className="back-link" to="/fighters">
        Fighters
      </Link>

      <div className="profile-header">
        <div>
          <p className="eyebrow">Fighter profile</p>
          <h1>{fighter.name}</h1>
          <div className="meta-row">
            <span>{formatRecord(fighter.record)}</span>
            <span>{formatWeight(fighter)}</span>
            <span>{fighter.physical?.stance ?? 'Stance TBD'}</span>
          </div>
        </div>
        <div className="quality-badge">
          {fighter.data_quality?.official_ufc_rate_metrics_complete ? 'UFC metrics complete' : 'Mixed source data'}
        </div>
      </div>

      <div className="profile-grid">
        <section className="detail-panel">
          <h2>UFC Metrics</h2>
          <MetricGrid fighter={fighter} />
        </section>

        <section className="detail-panel">
          <h2>Physical</h2>
          <dl className="detail-list">
            <DetailItem label="Height" value={fighter.physical?.height} />
            <DetailItem label="Reach" value={formatReach(fighter)} />
            <DetailItem label="DOB" value={fighter.physical?.dob} />
            <DetailItem label="UFC/Endeavor" value={formatOptionalRecord(fighter.ufc_or_endeavor_record)} />
          </dl>
        </section>

        <section className="detail-panel">
          <h2>Career Finish Profile</h2>
          <dl className="detail-list">
            <DetailItem label="KO/TKO wins" value={summary?.wins_by_ko_tko} />
            <DetailItem label="Submission wins" value={summary?.wins_by_submission} />
            <DetailItem label="Decision wins" value={summary?.wins_by_decision} />
            <DetailItem label="Finish rate" value={formatPercent(summary?.win_finish_rate_pct)} />
          </dl>
        </section>

        <section className="detail-panel">
          <h2>Data Quality</h2>
          <dl className="detail-list">
            <DetailItem label="Estimated fields" value={estimatedCount} />
            <DetailItem
              label="Missing official fields"
              value={fighter.data_quality?.official_ufc_rate_metrics_missing_fields?.length ?? 0}
            />
            <DetailItem label="Source scope" value={summary?.source_scope} />
          </dl>
        </section>
      </div>
    </section>
  )
}

interface MetricGridProps {
  fighter: Fighter
  compact?: boolean
}

function MetricGrid({ fighter, compact = false }: MetricGridProps) {
  const rows = compact ? statRows.slice(0, 4) : statRows

  return (
    <dl className={compact ? 'metric-grid compact' : 'metric-grid'}>
      {rows.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{formatStatValue(key, fighter.stats?.[key])}</dd>
        </div>
      ))}
    </dl>
  )
}

interface DetailItemProps {
  label: string
  value?: number | string
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? 'TBD'}</dd>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state">
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  )
}

function fallbackFighter(fighterId: string, name = 'Unknown fighter'): Fighter {
  return {
    fighterId,
    name,
    record: {
      wins: 0,
      losses: 0,
      draws: 0,
      no_contests: 0,
    },
  }
}

function formatRecord(record?: Fighter['record']): string {
  if (!record) {
    return 'Record TBD'
  }

  const noContests = record.no_contests ? ` (${record.no_contests} NC)` : ''
  return `${record.wins}-${record.losses}-${record.draws}${noContests}`
}

function formatOptionalRecord(record?: Fighter['record']): string {
  return record ? formatRecord(record) : 'TBD'
}

function formatStatValue(key: keyof FighterStats, value?: number): string {
  if (value === undefined || value === null) {
    return 'TBD'
  }

  const isPercentage = key.endsWith('_pct')
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2)
  return isPercentage ? `${formatted}%` : formatted
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function formatCardSection(section: string): string {
  return section.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatWeight(fighter: Fighter): string {
  return fighter.physical?.weight_lbs ? `${fighter.physical.weight_lbs} lb` : 'Weight TBD'
}

function formatReach(fighter: Fighter): string {
  return fighter.physical?.reach_inches ? `${fighter.physical.reach_inches} in` : 'TBD'
}

function formatPercent(value?: number): string {
  return value === undefined ? 'TBD' : `${value}%`
}

export default App
