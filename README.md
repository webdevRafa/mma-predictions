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

## Firebase emulators

Install Java 11+ and run `pnpm emulators`. The suite uses the demo project ID `fightlobby-local` and never connects to production by default.

## Data policy

Development uses normalized, versioned fixtures through a mock provider. Production sports data must come through a licensed provider adapter. Provider payloads and secrets never belong in browser bundles or Git.
