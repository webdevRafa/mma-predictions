# FightLobby Current State

Snapshot date: 2026-08-22

Integration branch: `codex/builder`

Remote: `origin` (`webdevRafa/mma-predictions`)
Functional baseline before this handoff package: `7e0d941ba3f8a1c3f17127f2d35adff7aea2b3f0`

The documentation commit containing this file becomes the new branch head. In a
new task, run `git fetch origin --prune`, `git switch codex/builder`,
`git pull --ff-only origin codex/builder`, and `git rev-parse HEAD` rather than
assuming the baseline hash above is still current.

## 1. Product status

FightLobby is a functioning UFC-only prediction and fight-community application
built with Next.js and Firebase. It is beyond a static prototype: authentication,
immutable predictions, consensus gating, posts, RTDB live chat, public profiles,
admin controls, result entry, grading, event/season boards, auditing, and Vercel
deployments are implemented.

The operating model is deliberately manual for event data. The owner reviews a
JSON card against official UFC data and imports it into Firestore. The owner then
uses `/admin` on fight day to lock each matchup, submit official results, watch
grading, and mark the event complete.

## 2. Current event data

The current reviewed launch event is:

- **UFC Fight Night: Hernandez vs Rodrigues**
- event ID: `evt_ufc_fn_2026_08_22`
- event date: 2026-08-22
- 13 scheduled matchups: six on the main card and seven on the prelims
- main event: Anthony Hernandez vs Gregory Rodrigues
- official top-to-bottom order was re-verified and refreshed on 2026-08-22
- event results are complete; 27 production predictions across five members
  were reconciled and graded on 2026-08-22, awarding 99 points in total
- raw prediction documents, sharded counters, displayed bout totals, grade
  totals, profile aggregates, and terminal admin-job state were verified to
  agree after recovery

Do not treat this card as a permanent fixture. The next operator should import a
new reviewed event after the current card concludes and verify home/event routing
against the event lifecycle rules.

## 3. Completed capabilities

### 3.1 Brand and responsive application shell

- Flat FightLobby SVG mark and wordmark are used in the navigation.
- The logo is also wired as the browser/app icon.
- Desktop and mobile navigation are responsive.
- Matchup mobile tabs are `Predictions`, `Stats`, `Posts`, and `Live chat`.
- Matchup switching is available without returning to the event page.
- Viewer-local timezone rendering is implemented for event schedule instants.

### 3.2 Authentication and accounts

- Google and email/password Firebase Authentication.
- Server session-cookie exchange with a five-day HTTP-only session.
- Same-page authentication modal for protected discussion actions.
- New Google users are created in Firebase Auth and complete handle onboarding.
- Debounced handle availability checks with transactional uniqueness.
- Optional provider or custom member avatars with client-side square cropping,
  owner-only uploads, explicit replacement/removal, and navbar account identity.
- Public profiles at `/u/{handle}` and a settings entry to view one's profile.
- Event-filtered prediction history on public profiles and a lazy-loaded private
  `Predictions` Settings section. The record includes matchup, event, pick,
  official result, score, and selection-scoped points/accuracy, with dedicated
  mobile cards below the desktop-table breakpoint.
- User-to-user following.
- Blocking, reporting, privacy controls, and public/private data separation.
- Full account deletion path for eligible Firestore, RTDB, Storage, and Firebase
  Auth data, with legally/operationally required audit evidence anonymized or
  retained as designed.

### 3.3 Event and matchup experience

- Home hero chooses the next/live event and formats prelim/main-card clocks.
- Event page renders official card order, main/co-main labels, result badges, and
  card-wide chat entry.
- Dedicated matchup routes show records, division/rounds, prediction experience,
  consensus, tale of the tape, persistent posts, and live chat.
- Event-wide **Make your picks** modal allows optional per-fight predictions and
  recognizes previously locked picks.
- Mobile section composition prevents unrelated content from appearing under the
  wrong tab.

### 3.4 Predictions and consensus

- One deterministic, immutable prediction per user and matchup.
- Create-only/idempotent submission with strict winner/method/detail validation.
- Methods are KO/TKO, Submission, or Decision; confidence and generic `Other`
  were removed.
- Accessible irreversible confirmation modal and read-only locked receipt.
- Per-matchup admin lock rejects all later submissions server-side.
- A locked matchup shows non-predictors a compact closed notice while members
  with an existing pick continue to see their immutable prediction receipt.
- Consensus is hidden from a user until that user has submitted a prediction.
- Consensus is split by fighter, method, and finish-round distributions.
- 5/3/2 scoring model and wrong-winner-zero rule are implemented.
- Public discussion/chat can show the author's winner/method prediction badge,
  never the exact finish detail.

### 3.5 Community posts and live chat

- Persistent matchup posts and nested replies live in Firestore.
- Posts are not copied from live chat; they are separate products and data paths.
- Mobile has a Posts tab and compact sticky composer affordance.
- Live matchup/event chat uses Firebase Realtime Database.
- Bounded initial/history reads and child-level live subscriptions are in place.
- Slow mode, idempotency, moderation, blocking, reports, room lifecycle, a
  six-hour post-completion chat window, and 30-day message retention are modeled.

### 3.6 Admin and grading

- `/admin` is protected by both a Firebase custom claim and Firestore user role.
- Audited admin dashboard, event list/editor, fighter tools, import, moderation,
  flags, audit, and board views.
- Individual matchup lock and guarded emergency reopen.
- Quick result dropdown on every event matchup row plus detailed result editor.
- Result versions and idempotent regrading.
- Prediction grades, profile aggregates, event/season boards, and achievements.
- Event boards rank every prediction participant without a graded-pick floor;
  `/leaderboards` defaults to the latest admin-completed event and provides a
  completed-event history selector.
- Season accuracy currently ranks every member with a graded pick by raw winner
  accuracy and has no participation floor.
- Manual **Mark event complete** plus automatic six-hour live-display safety
  buffer.
- Admin completion controls disclose how many fight results are not final.

### 3.7 Data and deployment

- Reviewed JSON fixture schema and validation.
- Audited admin import plus guarded production import/refresh scripts.
- Firestore, RTDB, Storage, and Functions rules/configuration.
- App Check/reCAPTCHA integration.
- Vercel Next.js configuration and branch previews.
- CI for Node 22/Java 21 install, typecheck, lint, tests, rules, staging
  simulation, and production build.
- Scalability work: sharded prediction counters, aggregate jobs, bounded chat and
  post reads, cached discussion previews, and one-time leaderboard construction.
- Production now has both required asynchronous prediction workers active:
  `processAdminJob` for queued result grading and
  `refreshPendingPredictionAggregates` for per-fight counter refresh.
- Guarded production audit and recovery commands are available as
  `audit:production:predictions` and `repair:production:grading`.

## 4. Settled behavior that must not regress

1. A user's confirmed prediction can never be edited or replaced.
2. The same user cannot contribute multiple consensus votes for one fight.
3. A user cannot see consensus until they have made their own prediction.
4. A matchup lock stops only that matchup; there is no bulk event lock.
5. Reopening accepts new users only; it does not unlock existing predictions.
6. Submitting a fight result grades that fight.
7. Marking an event complete does not grade fights.
8. Event standings include every member who predicted on that event.
9. Persistent posts and live chat remain separate collections and experiences.
10. Public prediction badges include fighter last name and method only, not round
    or decision detail.
11. Times are stored as UTC and displayed in the browser's local timezone.
12. Card movement changes `cardSegment`/`boutOrder`, never an existing fight ID
    or either participant ID; prediction linkage must survive every reorder.

## 5. Known limitations and intentional omissions

### 5.1 Manual data dependency

There is no licensed automated UFC data provider in the launch path. Accuracy
depends on the operator reviewing each JSON fixture. The current guarded
production import script was designed for the launch event and must be reviewed
before using it for a different event; `/admin/import` is the general audited
operator path.

### 5.2 Environment topology

The `.firebaserc` staging project is a placeholder, not a guaranteed isolated
cloud environment. Local Firebase emulators are the safe test environment.
Production is `mma-cortex`.

### 5.3 Test infrastructure

CI installs Java and runs Firebase rule tests. A local machine without Java can
run the application tests/build but cannot run the full emulator rule suite.
There is strong unit/integration coverage but no guarantee that every browser
journey has an automated end-to-end test; fight-day smoke testing remains
required.

### 5.4 Deliberately removed or deferred

- notification preferences and outbound reminders;
- following events or fighters;
- confidence scores;
- the prediction method `Other`;
- fighter photos until image rights and sourcing are settled;
- event-wide prediction locking;
- unattended scraping or ingestion;
- ad/affiliate revenue assumptions in core product behavior.

### 5.5 Operational limits

- Official results are entered manually.
- An administrator must monitor failed grading/aggregate jobs.
- Chat cleanup relies on deployed lifecycle/cleanup functions.
- Preview deployments only work correctly when their Vercel Firebase/App Check
  variables and authorized domains are configured.
- Some older files in `docs/` describe historical phases. The five root
  `FIGHTLOBBY_*.md` handoff documents and current code take precedence when an
  older statement conflicts.

## 6. Immediate fight-day priorities

1. Confirm the latest `codex/builder` preview is built from the expected SHA.
2. Run typecheck, lint, tests, build, and Firebase rules tests where Java is
   available.
3. Verify all 13 routes, schedule displays, and matchup switchers.
4. Test sign-up/sign-in/handle claim on the exact public domain.
5. Confirm Firebase authorized domains and reCAPTCHA/App Check domain coverage.
6. Test one new immutable pick and the consensus privacy gate.
7. Test posts, replies, live chat, moderation, and prediction badges.
8. Verify the admin account still has both authority sources.
9. During the event, lock each matchup at its walkout.
10. Enter every official result and verify grading before marking the event
    complete.
11. Monitor Vercel, Firebase Functions, Firestore, and RTDB errors during traffic.

## 7. Next implementation priorities

After the launch event:

1. document the actual fight-day incident log and resolve any observed failures;
2. make the generic recurring event-import path as explicit and guarded as the
   launch import;
3. provision a real isolated staging Firebase project if continued development
   warrants it;
4. add targeted browser E2E coverage for authentication, one-pick immutability,
   consensus gating, admin lock/result/grading, and event completion;
5. add operational dashboards/alerts for failed grading, prediction aggregate,
   and chat-retention jobs;
6. import the next reviewed UFC event while reusing verified fighter IDs;
7. revisit licensed data and image sources only when budget and rights are clear.

## 8. New-task handoff procedure

Use this initial instruction:

> Open the FightLobby repository, check out `codex/builder`, and read the
> FightLobby documentation before making changes. Verify the documentation
> against the current code and continue from `FIGHTLOBBY_CURRENT_STATE.md`.

Then verify:

```powershell
git fetch origin --prune
git switch codex/builder
git pull --ff-only origin codex/builder
git status --short --branch
git log -1 --oneline
```

Read in this order:

1. `FIGHTLOBBY_CURRENT_STATE.md`
2. `FIGHTLOBBY_DECISIONS.md`
3. `FIGHTLOBBY_PRODUCT_SPEC.md`
4. `FIGHTLOBBY_ARCHITECTURE.md`
5. `FIGHTLOBBY_OPERATIONS.md`

The documentation is a handoff aid, not a license to skip code verification.
For any high-risk change, trace the current server action, schema, rules, tests,
and deployment configuration before editing.
