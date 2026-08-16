# FightLobby

FightLobby is a UFC prediction and discussion community built around one idea: **every fight has a lobby**.

## Workspace

- `apps/web` — Next.js App Router web application
- `apps/functions` — Firebase Cloud Functions v2
- `packages/domain` — shared domain types, schemas, and scoring logic
- `fixtures` — versioned normalized development data
- `firebase` — Firestore, Realtime Database, and Storage rules
- `docs` — architecture and operations documentation

## Local setup

Requirements: Node.js 22+ and Corepack.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

The web app runs at `http://localhost:3000`. Keep all real credentials in `.env.local`; it is ignored by Git.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Before a production release, run `pnpm launch:preflight` against the production
environment export and `pnpm launch:verify -- https://your-canonical-domain` after
deployment. See [Production launch](docs/production-launch.md).

## Firebase emulators

Install Java 11+ and run `pnpm emulators`. The suite uses the demo project ID `fightlobby-local` and never connects to production by default.

## Data policy

Development uses normalized, versioned fixtures through a mock provider. Production sports data must come through a licensed provider adapter. Provider payloads and secrets never belong in browser bundles or Git.

## Documentation

- [Architecture](docs/architecture.md)
- [Authentication](docs/authentication.md)
- [Predictions](docs/predictions.md)
- [Grading and leaderboards](docs/grading-and-leaderboards.md)
- [Live chat and moderation](docs/live-chat.md)
- [Production launch](docs/production-launch.md)
- [Backup, restore, and regrade](docs/backup-restore-and-regrade.md)
- [UFC event-day runbook](docs/event-day-runbook.md)
