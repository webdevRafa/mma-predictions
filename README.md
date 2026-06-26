# MMA Codex

MMA Codex is an MMA analytics workspace for event research, fighter profiles, and future risk/confidence analysis for Prize Picks-style slip building.

## Local Setup

Create a local env file at:

```text
C:\Users\Ralph\Documents\Codex\2026-06-26\pleas\mma-predictions\.env.local
```

Use `.env.example` as the key list. Keep real values out of git.

```bash
npm install
npm run dev
```

## Data

- `src/data/events.json` contains event documents with embedded fights.
- `src/data/fighters.json` contains fighter documents keyed by `fighterId`.
- `src/data/logs.json` is reserved for future private slip analytics.

The app tries Firestore first and falls back to bundled JSON if Firebase config, rules, or seeded data are unavailable.

## Firestore

Rules are defined in `firestore.rules`:

- `events` and `fighters` are public read.
- Client writes are disabled.
- `logs` are locked down for now.

Dry-run the seed:

```bash
npm run seed:firestore -- --dry-run
```

Run the real seed only with admin credentials available through one of:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`
- application-default credentials

```bash
npm run seed:firestore
```

## Verification

```bash
npm run lint
npm run build
npm run seed:firestore -- --dry-run
```
