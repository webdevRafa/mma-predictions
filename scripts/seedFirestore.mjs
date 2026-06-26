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

validateSeedData()

if (dryRun) {
  console.log(
    `Dry run OK: ${events.length} event document(s), ${fighters.length} fighter document(s).`,
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
  `Seeded Firestore: ${events.length} event document(s), ${fighters.length} fighter document(s).`,
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
