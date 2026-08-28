# FightLobby Operations Runbook

Last verified against `codex/builder`: 2026-08-22

This is the practical runbook for operating FightLobby. Read
`FIGHTLOBBY_PRODUCT_SPEC.md` and `FIGHTLOBBY_ARCHITECTURE.md` first when a change
could affect product rules or data integrity.

## 1. Operating principles

- UFC event data is imported from an operator-reviewed JSON fixture. There is no
  unattended UFC scraper in the production path.
- Store all timestamps as UTC instants. The browser formats them in the viewer's
  local timezone.
- Use stable IDs for events, fights, and fighters. Never identify a fighter by
  name alone.
- Predictions are create-only and permanently immutable after confirmation.
- Lock each matchup individually at the walkout. FightLobby intentionally has no
  bulk or event-wide prediction lock.
- Saving a fight result grades that fight. Marking an event complete does not
  grade any fight.
- Every admin mutation is server-authorized and audited. Do not edit production
  documents by hand unless performing an explicitly documented recovery.
- Never commit `.env.local`, Firebase service-account JSON, Vercel secrets, or
  copied private keys.

## 2. Production identities and environments

| Purpose                     | Value                                             |
| --------------------------- | ------------------------------------------------- |
| GitHub repository           | `webdevRafa/mma-predictions`                      |
| Integration branch          | `codex/builder`                                   |
| Production branch           | `main`                                            |
| Firebase production project | `mma-cortex`                                      |
| Firebase production RTDB    | `https://mma-cortex-default-rtdb.firebaseio.com/` |
| Firebase production bucket  | `gs://mma-cortex.firebasestorage.app`             |
| Local Firebase alias        | `fightlobby-local`                                |
| Production Firebase alias   | `mma-cortex` through the `production` alias       |

The `staging` alias in `.firebaserc` is a placeholder. Do not assume it is a
real isolated staging project until one is explicitly provisioned.

## 3. Local operator setup

From the repository root:

```powershell
git fetch origin --prune
git switch codex/builder
git pull --ff-only origin codex/builder
npx --yes pnpm@10.17.0 install --frozen-lockfile
```

Use Node.js 22 for parity with CI, Firebase Functions, and Vercel. CI also uses
Java 21 for Firebase emulator rule tests.

Confirm the active Firebase account and project before any deploy or data
operation:

```powershell
npx --yes firebase-tools@latest login:list
npx --yes firebase-tools@latest login:use your-account@example.com
npx --yes firebase-tools@latest use production
npx --yes firebase-tools@latest projects:list
```

`firebase login:use` changes the CLI account; `firebase use production` selects
the repository alias. Check both.

## 4. Credentials

Production import scripts use Firebase Admin credentials. The safe options are:

1. `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON file
   outside the repository; or
2. the server-only `FIREBASE_ADMIN_PROJECT_ID`,
   `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` variables.

The reviewed import scripts call Application Default Credentials. A typical
PowerShell session is:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\mma-cortex-service-account.json"
```

Do not copy the JSON into the repo and do not paste its contents into a public
log. Revoke and rotate a service account immediately if it is exposed.

## 5. Preparing an event JSON fixture

### 5.1 Source review

The operator should compare the fixture against official UFC event and athlete
pages before import. At minimum verify:

- event title, slug, venue, city, region, and country;
- prelim and main-card UTC start instants;
- official card segment and card order;
- both fighters in every matchup;
- division and scheduled rounds;
- fighter records and any tale-of-the-tape statistics being published;
- provenance URLs and the time the source was verified.

Card order is presentation order. List active fights in one contiguous,
top-to-bottom sequence: main event first, then the rest of the main card,
prelims, and early prelims. `boutOrder` starts at `1` and matches the bout's
position among active fights in the fixture array. Public UI labels only the
main and co-main positions; it does not display misleading `Bout 1`, `Bout 2`
labels.

### 5.2 Stable identity

- Reuse an existing `fighterId` only after verifying it is the same person.
- Prefer an official/provider athlete ID mapping where one is available.
- A fallback identity match needs more than the name, such as exact name plus
  date of birth and reviewed biographical evidence.
- Two fighters with the same name must have distinct FightLobby IDs.
- Once imported, keep IDs stable across future events so profile history joins
  correctly.
- A fight ID identifies its participant pair, not its card position. If UFC
  moves a matchup, preserve the fight and fighter IDs and change only
  `cardSegment`/`boutOrder`.

### 5.3 Time fields

Supply both `prelimsStartsAt` and `mainCardStartsAt` as UTC instants. `startsAt`
is a legacy-compatible main-card value, not an individual-bout time. Set the
venue IANA timezone separately, for example `America/Los_Angeles`.

Do not invent individual bout start times. FightLobby only promises the prelim
and main-card starts; individual fights occur when the preceding bouts finish.

### 5.4 Validate before production

Place reviewed fixtures under `fixtures/` or another deliberate local path, then
run:

```powershell
npx --yes pnpm@10.17.0 validate:fixtures
npx --yes pnpm@10.17.0 typecheck
npx --yes pnpm@10.17.0 test
```

Fixture validation is Zod-backed and should fail closed on unsupported values.

## 6. Importing an event into Firestore

There are two reviewed import paths.

### 6.1 Admin Import UI

For normal operator-managed imports:

1. Sign in with an account that has both the Firebase custom admin claim and the
   matching Firestore admin role.
2. Open `/admin/import` on the intended deployment.
3. Paste or upload the reviewed fixture content.
4. Review the parsed event, fight, fighter, and room counts.
5. Confirm the import action.

The server validates the fixture, writes events/fights/fighters/chat-room
metadata, preserves protected prediction/result state where appropriate, writes
`manualImports`, and records an audit entry.

### 6.2 Guarded production scripts

The repository also contains guarded scripts for distinct production workflows:

```powershell
npx --yes pnpm@10.17.0 add:production:event -- .\imports\ufc\event.json
npx --yes pnpm@10.17.0 import:production:event -- .\fixtures\event.json optional_legacy_event_id
npx --yes pnpm@10.17.0 refresh:production:event -- .\fixtures\event.json
```

`add-production-event.ts` is the recurring create-only path for a new reviewed
card. It dry-runs without a confirmation phrase; refuses event, fight, fighter,
and room identity collisions; writes the complete card atomically; and then
verifies that the protected launch event and both global and launch-event
prediction counts are unchanged.

`import-production-event.ts` was intentionally written as a guarded launch
migration. It verifies the production project/RTDB and contains overwrite and
event-identity guards. Do not assume it accepts an arbitrary new event without
reviewing and intentionally updating those guards.

`refresh-production-event.ts` is a guarded, metadata-only card-order correction
for the reviewed current event. Before writing, it requires the exact live fight
ID set, verifies the unordered participant pair for each fight, and validates
every event prediction's winner fighter ID. It updates only changed
`cardSegment`/`boutOrder` values plus timestamps and creates import/audit records.
Run it without the confirmation phrase first and review the dry-run diff.

For recurring new events, prefer the create-only script or the audited Admin
Import UI. Never weaken project, identity, or overwrite guards simply to make an
import pass.

### 6.3 Post-import verification

Verify all of the following before advertising the card:

- `/events` shows the event once;
- the event page displays the correct full title and both card segments;
- the home hero points to the expected current/next event;
- prelim and main-card times render correctly in at least Central, Eastern,
  Pacific, and UTC browser timezones;
- every matchup route resolves and the event matchup switcher contains the full
  card;
- all fights start with predictions open;
- fighter records and stats are formatted correctly;
- Firestore has the intended `events`, `fights`, `fighters`, and `chatRooms`
  documents;
- RTDB message paths are empty or intentionally retained for the room IDs.

## 7. Granting admin access

FightLobby requires two matching sources of authority:

1. a Firebase Auth custom admin claim; and
2. the private `users/{uid}` Firestore admin role.

The guarded bootstrap is:

```powershell
$env:FIGHTLOBBY_ADMIN_BOOTSTRAP_CONFIRM = "the-firebase-uid"
npx --yes pnpm@10.17.0 admin:grant -- the-firebase-uid
```

The command writes an audit record. The user must sign out and sign in again so
Firebase issues a fresh ID token containing the claim. A visible `/admin` page
does not replace server authorization; every mutation rechecks authority.

## 8. Fight-day prediction operations

### 8.1 Before the card

- Smoke-test email and Google sign-in on the production domain.
- Verify a Google account photo appears in the signed-in navbar, then upload,
  crop, replace, and remove a test avatar from Profile settings.
- Confirm the domain is authorized in Firebase Authentication and the reCAPTCHA
  Enterprise/App Check key.
- Submit a real test prediction, confirm it becomes a locked receipt, and verify
  the same account cannot submit again.
- Confirm a user without a pick cannot see consensus and a user with a pick can.
- Confirm posts and RTDB live chat remain distinct.
- Open `/admin/events/{eventId}` and make sure all intended fights say picks are
  open.

### 8.2 Locking a matchup

At the walkout for each fight:

1. Open `/admin/events/{eventId}`.
2. Find the exact matchup row.
3. Select **Lock matchup**.
4. Review the keyboard-accessible confirmation and confirm.
5. Wait for the row to show the locked state before moving on.

The canonical lock transaction changes that fight from open to locked. It then
materializes each existing user's public pick. Any new submission after the
lock is rejected server-side, including a stale form that was open beforehand.

There is intentionally no event-wide lock. Locking one fight does not affect
other matchups.

### 8.3 Emergency reopen

Use the detailed admin fight page only for a genuine operational correction:

1. supply the required audit reason;
2. type the required confirmation phrase;
3. reopen the matchup.

Reopening suppresses public-pick visibility while the fight is open again. It
does not unlock or change any existing user's immutable prediction. Only users
who never submitted a pick for that fight can submit during the reopened window.

## 9. Submitting results and grading

### 9.1 Quick result from the event page

Each fight row on `/admin/events/{eventId}` contains a result dropdown and a
disabled **Submit result** action. Choose the exact winner, method, and finish
detail; the action enables only after a choice exists. Confirm the result before
submitting.

Quick choices cover the standard scoring outcomes. Use **Details** when the
official result needs clock time or uncommon wording.

### 9.2 Detailed result correction

The detailed admin fight page supports:

- winner or no-winner outcomes;
- result method and method detail;
- round and time within the round;
- official/provisional designation;
- a required reason and typed confirmation.

Saving increments `resultVersion`, changes the fight to completed/grading, adds
an audited regrade job, and starts grading. Correcting a result later creates a
new version and regrades from the new official result; prior grades remain in
history.

### 9.3 Scoring

For an official fight with a winner:

- correct winner: 5 points;
- correct method group: 3 additional points;
- correct exact detail: 2 additional points;
- wrong winner: 0 points for the fight.

For KO/TKO or submission, exact detail is the round. For decisions, exact detail
is the decision type. Draw/no-contest/void-style results are handled by the
result and grading model rather than inventing a winning fighter.

### 9.4 What grading updates

Grading runs in bounded batches and updates:

- the user's immutable prediction grade and score;
- grade history when a result version changes;
- the public pick result;
- fight grading counts/status;
- public profile aggregates and streak-related state;
- event and season leaderboard entries;
- eligible achievements;
- grading-run and audit records.

Do not manually edit leaderboard totals to repair a result. Correct the official
fight result and let the idempotent regrade path rebuild derived state.

### 9.5 Verify grading

After each result:

- the fight row shows the submitted result;
- the public event and matchup pages show a friendly winner/result badge;
- the fight grading summary reaches its terminal state;
- sample predictions have the correct 0/5/8/10 score;
- event-board entries reflect the new graded fight;
- no `adminJobs` or grading run remains failed.

The event board must list every member with at least one event prediction. The
season accuracy board must list every member with at least one graded season
pick; both boards currently have `minimumPicks: 0`. On `/leaderboards`, confirm
**Last event** resolves to the newest event whose admin status is `completed`,
and confirm **By event** contains only completed events.

### 9.6 Reconcile a stalled grading pipeline

The result workflow depends on two deployed operational workers:

- `processAdminJob`, the Firestore-created trigger that consumes
  `regrade_fight` jobs; and
- `refreshPendingPredictionAggregates`, the every-minute scheduler that folds
  prediction shards into the per-fight summaries shown on card rows.

A Vercel deploy or a partial callable-only Functions deploy does not install
these workers. If results are visible but fights remain in `grading`, profiles
show no points, jobs remain `queued`, or event and row totals disagree, first
run the read-only reconciliation:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\mma-cortex-service-account.json"
$env:GOOGLE_CLOUD_PROJECT = "mma-cortex"
npx --yes pnpm@10.17.0 audit:production:predictions -- event-id-or-slug
```

The report compares raw prediction documents, unique predictors, shards,
displayed fight summaries, current result versions, grade status, admin jobs,
and profile aggregates without printing member identifiers or picks.

Deploy missing workers narrowly, then run the repair once without confirmation
to review its exact scope:

```powershell
npx --yes firebase-tools@latest deploy --only functions:processAdminJob,functions:refreshPendingPredictionAggregates --project mma-cortex
npx --yes pnpm@10.17.0 repair:production:grading -- event-id-or-slug
```

Only after the dry run resolves the intended production event, set
`FIGHTLOBBY_GRADING_REPAIR_CONFIRM` to the resolved event ID and repeat the
repair. The repair is result-version/scoring-version idempotent, refreshes fight
and event counters, processes only queued, interrupted, or failed
current-result-version jobs for that event, rebuilds profile and leaderboard
state through the canonical grading core, and records terminal job/run/audit
state. Run the read-only audit again afterward. Never patch member points or
leaderboard entries directly.

## 10. Completing an event

**Mark event complete** is a lifecycle control, not a grading button.

Only use it after the final bout and after reviewing whether all fight results
are final. It:

- changes the event to `completed`;
- records `completedAt`;
- sets chat write access through a six-hour post-event window;
- sets RTDB chat retention metadata for purge 30 days after chat closes;
- writes the administrator, prior state, new state, timestamp, and reason to the
  audit log.

It does not synthesize missing results and does not grade unresulted fights.
Submit every official fight result separately.

If the operator does not mark completion immediately, the public live display
has an automatic six-hour main-card safety window. Manual completion makes the
event lifecycle accurate sooner while preserving the six-hour post-completion
chat window.

## 11. Live chat operations

- Matchup chat messages live at
  `chat/v1/rooms/{roomId}/messages/{messageId}` in RTDB.
- Firestore `chatRooms/{roomId}` stores lifecycle and moderation metadata.
- The client loads a bounded latest page and subscribes with child-level RTDB
  events; it does not download the entire room repeatedly.
- Historical rooms become read-only after the configured close time.
- Retention cleanup removes messages after 30 days.
- Reports, sanctions, and audit evidence are Firestore-backed.

Use admin moderation tools for reports and sanctions. Do not delete messages
directly in RTDB unless following an incident-recovery procedure that preserves
required audit evidence.

## 12. Deployments

### 12.1 Application preview

All feature work lands on `codex/builder` first:

```powershell
git switch codex/builder
git pull --ff-only origin codex/builder
npx --yes pnpm@10.17.0 typecheck
npx --yes pnpm@10.17.0 lint
npx --yes pnpm@10.17.0 test
npx --yes pnpm@10.17.0 build
git push origin codex/builder
```

Vercel builds the Next.js app using the root `vercel.json`. Preview variables
must include the existing `VITE_FIREBASE_*` names. `next.config.ts` maps those to
the `NEXT_PUBLIC_FIREBASE_*` identifiers consumed by the client bundle; operators
do not need a second `VITE_PUBLIC_FIREBASE_*` naming family.

### 12.2 Production application deploy

After preview smoke testing and passing checks, merge `codex/builder` into
`main`. Vercel production should deploy from `main`. Verify the deployment's Git
commit, not only the friendly alias, before declaring it current.

### 12.3 Firebase deploys

A Vercel deployment does not deploy Firebase Functions or security rules. When
those files change, verify the diff and deploy only the required targets:

```powershell
npx --yes firebase-tools@latest use production
npx --yes firebase-tools@latest deploy --only firestore:rules,firestore:indexes,database,storage
npx --yes firebase-tools@latest deploy --only functions
```

Use narrower targets when possible. Run rule tests before rule deployments. A
functions deploy requires the production server configuration and Node 22.

After a narrow prediction-functions deploy, verify the operational workers were
not omitted:

```powershell
npx --yes firebase-tools@latest functions:list --project mma-cortex
```

The production list must include both `processAdminJob` and
`refreshPendingPredictionAggregates` in addition to the callable prediction
controls. A newly enabled Eventarc trigger can require a second deploy after its
service-agent permissions finish propagating.

An avatar release changes only Storage rules and the Vercel-hosted web app. After
the rules tests pass, deploy the narrow Firebase target with
`npx --yes firebase-tools@latest deploy --only storage`; no Functions redeploy is
required for the avatar route.

## 13. Launch smoke test

On the exact production alias and a private/incognito window, verify:

1. favicon, navbar, homepage, event page, and every matchup route load;
2. displayed times match the browser's timezone;
3. signup/signin, handle claim, session refresh, and signout work;
4. a first prediction succeeds exactly once and later attempts are rejected;
5. consensus remains hidden before the user's pick and visible afterward;
6. event-wide picker recognizes already locked picks;
7. posts and replies persist independently from live chat;
8. chat opens, receives child updates, rate limits, and respects room state;
9. `/admin` rejects a normal member and accepts the dual-authorized admin;
10. a controlled lock/result flow works on a safe test fight or emulator;
11. Vercel and Firebase logs show no unexplained 500s or permission errors.

## 14. Incident guidance

- **A route returns 500:** inspect Vercel server logs first. Browser console only
  shows the symptom.
- **Authentication works on one domain only:** review Firebase authorized
  domains, reCAPTCHA Enterprise/App Check domains, and matching Vercel variables.
- **A prediction request appears retried:** inspect the deterministic prediction
  document and revision request ID. Do not add a second vote manually.
- **Wrong result or score:** correct the official fight result through admin and
  regrade; do not patch totals.
- **Event times are wrong:** correct UTC instants and venue timezone in the event
  source, then refresh. Never hardcode a viewer timezone in UI.
- **Preview looks stale:** compare the deployed Git SHA with
  `origin/codex/builder`; a persistent Vercel branch alias can point to an older
  deployment during Git provider incidents.

## 15. End-of-event checklist

- lock the final fight at walkout;
- submit and verify every official result;
- resolve any result corrections before publishing final rankings;
- mark the event complete;
- confirm the public hero no longer treats it as the next event after the
  lifecycle window;
- verify the event leaderboard and sample public profiles;
- verify a graded pick appears with the correct result and points in both the
  owner's Settings > Predictions record and the post-lock public profile record;
- select at least one historical event on each record and confirm the summary
  totals update without exposing any still-open public pick;
- monitor failed admin/grading/aggregate jobs;
- prepare and review the next event JSON with stable fighter identities;
- retain the source review and manual import audit trail.
