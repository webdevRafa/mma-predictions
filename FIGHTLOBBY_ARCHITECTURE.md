# FightLobby Architecture

## Purpose and authority

This document is the concise technical map of FightLobby as of August 22, 2026. Read it with the other root-level `FIGHTLOBBY_*.md` files before changing the application. The current code remains the final authority when implementation details evolve.

## System overview

FightLobby is a pnpm monorepo built around a Next.js App Router web application and Firebase services.

```text
Browser
  -> Next.js application on Vercel
       -> Firebase Authentication
       -> Firestore for durable application data
       -> Realtime Database for event-day chat messages
       -> Firebase Storage for permitted user assets
       -> Firebase App Check / reCAPTCHA Enterprise
       -> server-only Firebase Admin SDK for trusted mutations
       -> Firebase Functions v2 for asynchronous and scheduled work
```

The architectural boundary is intentional:

- Browsers may read public data and use narrowly allowed realtime features under Firebase Security Rules.
- Sensitive writes, prediction creation, admin operations, grading, imports, and deletion are performed by trusted server code.
- Firestore is the durable source of truth. Realtime Database is used only where a live append-oriented stream is valuable.
- UFC event data is supplied through an operator-reviewed JSON workflow rather than an unreviewed production scraper.

## Repository layout

| Path                    | Responsibility                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/web`              | Next.js App Router UI, route handlers, server actions, Firebase client integration, and server-side repositories. |
| `apps/functions`        | Firebase Functions source and deployment bundle.                                                                  |
| `packages/domain`       | Shared domain types, Zod validation, prediction and scoring rules, and fixture contracts.                         |
| `packages/firebase`     | Firebase client and Admin SDK initialization helpers.                                                             |
| `packages/firebase-ops` | Canonical privileged Firebase operations such as matchup locking and public-pick materialization.                 |
| `packages/providers`    | Provider abstractions and ingestion helpers. Launch may use reviewed fixtures instead of a commercial provider.   |
| `firebase`              | Firestore, Realtime Database, and Storage Security Rules plus Firestore indexes.                                  |
| `fixtures`              | Versioned, reviewable JSON event data used by validation/import tooling.                                          |
| `imports`               | Import artifacts and operator-reviewed source material when applicable.                                           |
| `scripts`               | Validation, import, refresh, migration, bootstrap, verification, and emulator scripts.                            |
| `tests`                 | Unit, integration, rules, and staging-simulation coverage.                                                        |
| `docs`                  | Deep operational and design references. The five root handoff documents summarize the current source of truth.    |

## Runtime and framework

- Node.js: `22.x`.
- Package manager: `pnpm@10.17.0`.
- Web framework: Next.js App Router.
- Language: TypeScript.
- Styling: application-owned CSS and reusable components under `apps/web`.
- Deployment: Vercel for the web application; Firebase CLI for rules and functions.

Next.js server components and route handlers load public/durable data and execute trusted operations. Client components are used for interactive controls, Firebase Authentication, realtime subscriptions, modal flows, local-time formatting, and responsive navigation. Do not move privileged Admin SDK work into client bundles.

## Firebase services

| Service                 | FightLobby use                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Firebase Authentication | Google and email/password identity. A successful Google sign-in creates a Firebase Auth user when one does not already exist.       |
| Cloud Firestore         | Events, fights, fighters, users, profiles, handles, predictions, discussions, audits, jobs, boards, and room metadata.              |
| Realtime Database       | Event and matchup live-chat messages under a versioned room path.                                                                   |
| Firebase Storage        | Optional member avatar output at `avatars/{uid}/avatar.webp`. Fighter imagery is not part of the current launch workflow.           |
| App Check               | Web request attestation through reCAPTCHA Enterprise. Production enforcement is controlled by server configuration.                 |
| Cloud Functions v2      | Background and scheduled operations, including bounded chat lifecycle/retention work and other asynchronous tasks.                  |
| Security Rules          | Direct-client authorization for Firestore, RTDB, and Storage. Server authorization is still required for privileged route handlers. |

### Firebase environments

| Environment    | Firebase project                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Local emulator | `fightlobby-local`                                                                                                              |
| Staging alias  | Placeholder `fightlobby-staging`; do not treat it as a configured production-like environment until a real project is assigned. |
| Production     | `mma-cortex`                                                                                                                    |

The production Realtime Database URL is `https://mma-cortex-default-rtdb.firebaseio.com/`. The production Storage bucket is `mma-cortex.firebasestorage.app`.

Member avatar source files are cropped in the browser and are never uploaded.
Storage accepts only the authenticated owner's final non-empty WebP object up to
1 MiB at the deterministic avatar path. The profile document stores the path and
a monotonically increasing version; Firebase Auth stores the display URL used by
the navbar.

## Firestore data map

The following paths are the important durable records. Exact fields are validated by the shared domain package and current repositories.

| Path                                                              | Purpose                                                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `events/{eventId}`                                                | Event identity, official title, segments, UTC schedule, venue timezone, status, completion/chat lifecycle, and rollups. |
| `fights/{fightId}`                                                | Matchup identity, card order, fighters, status, prediction state, result, consensus summaries, and grading summary.     |
| `fighters/{fighterId}`                                            | Stable fighter identity, names, records, biographical fields, and tale-of-the-tape statistics.                          |
| `users/{uid}`                                                     | Private account, role, restrictions, and minimal preferences.                                                           |
| `profiles/{uid}`                                                  | Public handle/profile and public prediction record aggregates.                                                          |
| `handles/{normalizedHandle}`                                      | Transactionally claimed global handle index.                                                                            |
| `predictions/{fightId}_{uid}`                                     | The user's single immutable prediction for a matchup. The deterministic ID is a core duplicate-prevention constraint.   |
| `predictions/{predictionId}/revisions/{requestId}`                | Idempotency/revision receipt used to make retries safe.                                                                 |
| `profiles/{uid}/publicPicks/{fightId}`                            | Materialized public pick visible when the matchup is locked; suppressed when an admin reopens the matchup.              |
| `fights/{fightId}/predictionShards/{shardId}`                     | Write-distributed counters for scalable prediction aggregation.                                                         |
| `predictionAggregateJobs/{fightId}`                               | Background aggregation trigger/state for consensus materialization.                                                     |
| `fightDiscussions/{fightId}/posts/{postId}`                       | Persistent top-level matchup posts. This is separate from live chat.                                                    |
| `fightDiscussions/{fightId}/posts/{rootPostId}/replies/{replyId}` | Persistent threaded replies.                                                                                            |
| `chatRooms/{roomId}`                                              | Durable room status, moderation, writable window, completion, and retention metadata.                                   |
| `manualImports/{importId}`                                        | Reviewed JSON import receipt and audit context.                                                                         |
| `auditLogs/{auditId}`                                             | Security and operator mutation audit records.                                                                           |
| `adminJobs/{jobId}`                                               | Regrade and other privileged background jobs.                                                                           |
| `leaderboards/{boardId}/entries/{uid}`                            | Event/season leaderboard entries.                                                                                       |
| `achievements/{uid}/eventChampionships/{id}`                      | Event achievement history.                                                                                              |
| `achievements/{uid}/seasonRanks/{id}`                             | Season-rank achievement history.                                                                                        |

Member prediction history uses two bounded server read models. The private
Settings endpoint queries canonical `predictions` by the authenticated UID and
loads only when the Predictions section opens. Public profile pages query
`profiles/{uid}/publicPicks`, never canonical open predictions. Both paths batch
hydrate referenced fight and event documents, sort events newest first, and
return the same UI view model. This preserves the post-lock disclosure boundary
while avoiding full-history reads on unrelated Settings visits.

Other support collections may exist for rate limits, sanctions, reports, consent, and operational cursors. Search the current rules and repositories before changing or deleting a collection.

## Realtime Database map

Live-chat messages are stored at:

```text
chat/v1/rooms/{roomId}/messages/{messageId}
```

The room document itself is in Firestore at `chatRooms/{roomId}`. Firestore therefore controls lifecycle and moderation while RTDB supplies the efficient live stream.

The client loads a bounded recent page, listens with child-level subscriptions such as `onChildAdded`, `onChildChanged`, and `onChildRemoved`, and pages older messages separately. It must not subscribe to the entire room with an unbounded `onValue()` listener.

## Core domain model

### Event and fight states

- Event status: `draft`, `scheduled`, `live`, `completed`, `canceled`, or `postponed`.
- Fight status: `scheduled`, `prefight`, `walkouts`, `intros`, `in_progress`, `end_of_round`, `completed`, `canceled`, or `postponed`.
- Prediction status: `open`, `locked`, `grading`, `graded`, or `void`.

An event stores absolute timestamps for prelims and the main card, with a legacy/general start timestamp retained where required. Browser components format these timestamps in the visitor's local timezone. Event status and time windows are related but not interchangeable: an admin can end the event immediately while the six-hour automatic live-window fallback remains a safety net.

### Prediction model

A `PredictionPick` contains only:

- `winnerFighterId`
- `method`: `ko_tko`, `submission`, or `decision`
- optional `detail`, such as a round or decision type

Confidence and the user-facing `Other` prediction method were deliberately removed. The official result model remains broader because real fights may end by disqualification, draw, no contest, overturned result, or another uncommon outcome.

## Authentication and sessions

1. The browser authenticates through Firebase Authentication.
2. The client obtains a fresh Firebase ID token.
3. FightLobby exchanges it through a same-origin server route for a five-day, HTTP-only session cookie.
4. Server components and route handlers verify the session with the Firebase Admin SDK.
5. Sign-out clears both Firebase client state and the server session.

Google sign-in is sign-in-or-create at the Firebase level. A first-time account must still claim a public handle and accept required terms before it can post, chat, or create predictions. Handle claiming is transactional through `handles/{normalizedHandle}` so uniqueness does not rely on a read-then-write race.

## Authorization

### Member operations

Prediction, posting, chat, blocking, reporting, and settings mutations require an authenticated, non-restricted user and the operation-specific invariants. Posting/chatting also require a valid handle; live chat requires a verified account and an open room.

### Admin operations

Admin access intentionally requires both sources of authority:

- a Firebase custom admin claim; and
- a matching admin role in `users/{uid}`.

Every admin mutation is server-authorized, same-origin/session protected, validates its confirmation/reason where applicable, and writes an audit record containing the actor, target, prior state, resulting state, timestamp, and reason. Never protect `/admin` with UI hiding alone, and never hardcode an administrator UID into application source.

## Important data flows

### Reviewed JSON event import

1. The operator creates or updates a reviewable event JSON fixture.
2. Shared Zod schemas validate events, fights, fighters, schedule, IDs, and provenance.
3. The operator compares the fixture with the official UFC event/card and resolves identity ambiguities.
4. A guarded script or the secured admin import flow writes events, fights, fighters, room metadata, and an import receipt.
5. Post-import verification confirms counts, schedule, slugs, card order, fighter links, and public pages.

No production page scrapes UFC at request time. A reviewed fixture is a legitimate production source because the operator owns the review and import step.

### Immutable prediction creation

1. The user confirms winner, method, and detail.
2. The trusted submission path validates the current fight state and strict payload.
3. It creates `predictions/{fightId}_{uid}` as version 1 with status `locked`.
4. It records the request ID under `revisions` for idempotent retry behavior.
5. It increments one prediction shard and queues/reconciles the aggregate job exactly once.
6. A later distinct submission for the same user/fight is rejected with `prediction_already_locked`.

The deterministic document ID, Firestore transaction, and request receipt prevent multiple votes even if a browser retries after an App Check or network error.

### Consensus privacy

The dedicated matchup experience checks whether `predictions/{fightId}_{uid}` exists. Community consensus is withheld until that current user has made a pick. The aggregate is not considered authorization to reveal it. Once the user has a pick, the page may show fighter-specific winner, method, and round distributions.

### Matchup locking and reopening

The canonical privileged lock operation transactionally changes the fight's prediction state and materializes each user's public pick in paged batches. New predictions are rejected after the lock.

Emergency reopening changes the fight back to accepting picks and removes materialized public-pick visibility. Existing prediction documents remain immutable; only users who have not already picked can submit. Relocking restores public-pick materialization.

### Results and grading

Submitting an official fight result:

1. Increments `resultVersion` and stores winner, method, detail, round/time when known, and official status.
2. Sets the fight/result prediction state to grading.
3. Creates an idempotent regrade job.
4. Grades predictions in bounded batches.
5. Updates prediction grade/history, public picks, fight grading summary, profile aggregates, leaderboards, and achievements.

Event-board input includes every UID with at least one prediction document for
that event, even if a prediction was voided. Points and accuracy still derive
only from graded predictions. The public leaderboard repository joins event
boards to their event documents, excludes events not marked `completed`, and
sorts completed event boards by event start time so the last event is the stable
default rather than the most recently rebuilt board.

The season accuracy board currently includes every member with at least one
graded pick and ranks by raw winner accuracy, then graded-pick volume, points,
exact picks, and UID. Its stored `minimumPicks` is zero until a future product
decision introduces a participation threshold.

Marking the event complete is separate. It ends the event's live state and starts chat-close/retention timing; it does not invent results or grade unfinalized fights.

### Discussions and live chat

Persistent posts live in Firestore and support top-level posts plus threaded replies. Live chat lives in RTDB and is optimized for event-day streaming. They never share the same message collection or silently copy messages between systems.

Both surfaces can display a matchup-specific immutable prediction badge beside the author's handle. The badge contains fighter last name and method only, never finish detail.

### Account deletion

The deletion flow revokes sessions and deletes the Firebase Auth account plus eligible private Firestore/Storage data. Records that must be retained for integrity, moderation, scoring, or audit are anonymized or retained according to their documented policy instead of being left attached to a live identity.

## Security Rules, App Check, and abuse protection

- Firestore rules: `firebase/firestore.rules`.
- Firestore indexes: `firebase/firestore.indexes.json`.
- RTDB rules: `firebase/database.rules.json`.
- Storage rules: `firebase/storage.rules`.
- Firebase deployment configuration: `firebase.json`.

Rules are necessary but not sufficient: privileged web route handlers still perform server authorization and invariant validation. App Check uses `VITE_FIREBASE_APP_CHECK_SITE_KEY` through the build-time mapping described below. Domain allowlists must include every production and preview domain used for authenticated or protected flows.

## Environment variables and the VITE compatibility layer

The historical deployment already uses `VITE_FIREBASE_*` names. Next.js client code ultimately needs build-time `NEXT_PUBLIC_*` values, so `apps/web/next.config.ts` deliberately maps the established Vite-named variables to internal Next public aliases. Operators should continue setting these values:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_APP_CHECK_SITE_KEY
```

There is no `VITE_PUBLIC_FIREBASE_*` family. Do not rename the working environment variables without updating and testing the compatibility mapping.

Server-only credentials use `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`. They must never be exposed to the browser, committed, or placed in public-prefixed variables.

Other important values include `FIREBASE_APP_CHECK_ENFORCED`, `NEXT_PUBLIC_SITE_URL`, analytics/ads consent values, `REVALIDATION_SECRET`, and provider/import configuration. `.env.example` is the canonical key inventory; it contains names, not production secrets.

## Vercel deployment

`vercel.json` configures:

- Next.js framework detection;
- a frozen pnpm install;
- web build command: `pnpm --filter @fightlobby/web build`;
- output: `apps/web/.next`.

Vercel Preview deployments are normally generated from `codex/builder`; Production is normally generated from `main`. Both environments need the correct Firebase client configuration, Admin credentials, App Check settings, and site URL. A successful Git push does not guarantee the production alias moved; verify the deployment commit and alias in Vercel.

## Continuous integration

`.github/workflows/ci.yml` runs on relevant branch pushes and pull requests using Node 22 and Java 21. It installs with the lockfile, then runs type checking, linting, unit tests, Firebase rules/integration tests, staging simulation, and the production build. Local Firebase emulator tests require Java; CI supplies it even if a developer machine does not.

## Local emulators

Configured ports:

| Service           | Port |
| ----------------- | ---: |
| Auth              | 9099 |
| Functions         | 5001 |
| Firestore         | 8080 |
| Realtime Database | 9000 |
| Storage           | 9199 |
| Emulator UI       | 4000 |

Run `pnpm emulators` or the targeted test/simulation scripts. Keep emulator data separate from production credentials.

## Scalability boundaries

- Prediction documents use deterministic IDs and sharded aggregation counters.
- Grading uses bounded batches and idempotent result versions/jobs.
- Chat reads are limited and child-based; older messages are paginated.
- Live chat becomes read-only after the event completion window and is purged after the retention period.
- Discussion list endpoints return bounded previews/pages rather than whole threads.
- Public pages should use server caching/revalidation where correctness permits.
- Do not add unbounded listeners, collection scans, or per-row N+1 reads without an explicit cost review.

## Implementation anchors

Before altering a subsystem, inspect these current anchors:

- `packages/domain/src` for domain and scoring contracts.
- `apps/web/lib/predictions` for prediction reads/writes and consensus gating.
- `packages/firebase-ops/src/prediction-control.ts` for lock/reopen behavior.
- `apps/web/lib/admin/actions.ts` for results, grading jobs, event completion, and audit behavior.
- `apps/web/features/chat` and related Firebase helpers for RTDB subscriptions.
- `apps/web/features/discussions` and API routes for persistent posts.
- `scripts/import-production-event.ts` and `scripts/refresh-production-event.ts` for guarded production data operations.
- `firebase/*.rules*`, `firebase.json`, `.firebaserc`, `vercel.json`, and `.github/workflows/ci.yml` for environment/deployment behavior.
