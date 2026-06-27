import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(rootDir, 'src', 'data')
const dryRun = process.argv.includes('--dry-run')

loadLocalEnvFile('.env.local')
loadLocalEnvFile('.env')

const fighters = readJson('fighters.json')
const events = readJson('events.json')
const prizePickOdds = readJson('prizepickodds.json')

validateSeedData()

if (dryRun) {
  const prizePickLineCount = prizePickOdds.reduce(
    (total, oddsSnapshot) => total + oddsSnapshot.lines.length,
    0,
  )

  console.log(
    `Dry run OK: ${events.length} event document(s), ${fighters.length} fighter document(s), ${prizePickOdds.length} PrizePicks snapshot document(s), ${prizePickLineCount} PrizePicks line document(s).`,
  )
  for (const event of events) {
    console.log(`events/${event.eventId} -> ${event.name}`)
  }
  for (const fighter of fighters.slice(0, 5)) {
    console.log(`fighters/${fighter.fighterId} -> ${fighter.name}`)
  }
  if (fighters.length > 5) {
    console.log(`...and ${fighters.length - 5} more fighter document(s).`)
  }
  for (const oddsSnapshot of prizePickOdds) {
    console.log(
      `prizepickOdds/${oddsSnapshot.oddsSnapshotId} -> ${oddsSnapshot.lines.length} line document(s) for ${oddsSnapshot.eventId}`,
    )
  }
  process.exit(0)
}

initializeFirebaseAdmin()

const firestore = getFirestore()
const batch = firestore.batch()
const seededAt = new Date().toISOString()

for (const event of events) {
  batch.set(
    firestore.collection('events').doc(event.eventId),
    {
      ...event,
      seededAt,
    },
    { merge: true },
  )
}

for (const fighter of fighters) {
  batch.set(
    firestore.collection('fighters').doc(fighter.fighterId),
    {
      ...fighter,
      seededAt,
    },
    { merge: true },
  )
}

for (const oddsSnapshot of prizePickOdds) {
  const { lines, ...snapshotMetadata } = oddsSnapshot
  const snapshotRef = firestore.collection('prizepickOdds').doc(oddsSnapshot.oddsSnapshotId)

  batch.set(
    snapshotRef,
    {
      ...snapshotMetadata,
      lineCount: lines.length,
      seededAt,
    },
    { merge: true },
  )

  for (const line of lines) {
    batch.set(
      snapshotRef.collection('lines').doc(line.lineId),
      {
        ...line,
        oddsSnapshotId: oddsSnapshot.oddsSnapshotId,
        seededAt,
      },
      { merge: true },
    )
  }

  batch.set(
    firestore.collection('events').doc(oddsSnapshot.eventId),
    {
      latestPrizePickOddsSnapshotId: oddsSnapshot.oddsSnapshotId,
      latestPrizePickOddsLineCount: lines.length,
      latestPrizePickOddsSeededAt: seededAt,
    },
    { merge: true },
  )
}

try {
  await batch.commit()
} catch (error) {
  console.error('Firestore seed failed.')
  console.error(
    'Provide FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or valid application-default credentials before running a real seed.',
  )
  throw error
}

console.log(
  `Seeded Firestore: ${events.length} event document(s), ${fighters.length} fighter document(s), ${prizePickOdds.length} PrizePicks snapshot document(s), ${prizePickOdds.reduce(
    (total, oddsSnapshot) => total + oddsSnapshot.lines.length,
    0,
  )} PrizePicks line document(s).`,
)

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, fileName), 'utf8'))
}

function loadLocalEnvFile(fileName) {
  const filePath = path.join(rootDir, fileName)

  if (!fs.existsSync(filePath)) {
    return
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')

    if (equalsIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function validateSeedData() {
  const eventIds = new Set(events.map((event) => event.eventId))

  for (const event of events) {
    if (!event.eventId || !Array.isArray(event.fights)) {
      throw new Error(`Invalid event seed document: ${event.name ?? 'unknown event'}`)
    }
  }

  for (const fighter of fighters) {
    if (!fighter.fighterId || !fighter.name) {
      throw new Error(`Invalid fighter seed document: ${fighter.name ?? 'unknown fighter'}`)
    }
  }

  for (const oddsSnapshot of prizePickOdds) {
    if (!oddsSnapshot.oddsSnapshotId || !oddsSnapshot.eventId || !Array.isArray(oddsSnapshot.lines)) {
      throw new Error(
        `Invalid PrizePicks odds snapshot: ${oddsSnapshot.oddsSnapshotId ?? 'unknown snapshot'}`,
      )
    }

    if (!eventIds.has(oddsSnapshot.eventId)) {
      throw new Error(
        `PrizePicks odds snapshot ${oddsSnapshot.oddsSnapshotId} references unknown event ${oddsSnapshot.eventId}`,
      )
    }

    if (oddsSnapshot.audit?.lineCount !== undefined && oddsSnapshot.audit.lineCount !== oddsSnapshot.lines.length) {
      throw new Error(
        `PrizePicks odds snapshot ${oddsSnapshot.oddsSnapshotId} audit lineCount does not match lines length`,
      )
    }

    const lineIds = new Set()

    for (const line of oddsSnapshot.lines) {
      if (!line.lineId || !line.marketType || !line.fighterName || typeof line.projection !== 'number') {
        throw new Error(
          `Invalid PrizePicks line in ${oddsSnapshot.oddsSnapshotId}: ${line.lineId ?? line.fighterName ?? 'unknown line'}`,
        )
      }

      if (lineIds.has(line.lineId)) {
        throw new Error(
          `Duplicate PrizePicks lineId ${line.lineId} in ${oddsSnapshot.oddsSnapshotId}`,
        )
      }

      lineIds.add(line.lineId)
    }
  }
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson)

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id ?? projectId,
    })
    return
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  })
}
