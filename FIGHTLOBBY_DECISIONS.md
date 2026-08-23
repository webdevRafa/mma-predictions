# FightLobby Product and Engineering Decisions

Last verified: 2026-08-22

This log records settled choices so future work does not repeatedly reopen them
without new evidence. A decision may change, but the change should be explicit,
documented, tested, and reflected across all five handoff documents.

## Decision 01 — UFC-only launch scope

**Decision:** FightLobby launches for UFC events only.

**Reason:** A narrow scope makes event operations, terminology, scoring, and
quality control manageable. Other promotions require their own provider rights,
identity mapping, scheduling conventions, and product review.

## Decision 02 — Operator-reviewed JSON is an approved production source

**Decision:** The owner may manually build and review event JSON against official
UFC information, validate it, and import it into Firestore.

**Reason:** A careful manual workflow is acceptable for one event at a time and
avoids shipping an unreliable scraper or paying for a provider before launch.

**Guardrail:** Imports must preserve stable identities, UTC instants, provenance,
schema validation, project/overwrite protections, and audit records. “Manual”
does not mean editing Firestore ad hoc.

## Decision 03 — Next.js App Router remains the web framework

**Decision:** Keep the application on Next.js rather than converting it to a
client-only React/Vite app.

**Reason:** The product uses server rendering, metadata/SEO, route handlers,
server sessions, admin actions, and server-only Firebase Admin access. React is
already the UI layer inside Next.js.

## Decision 04 — Existing VITE Firebase variable names remain operator-facing

**Decision:** Vercel and local setup continue using `VITE_FIREBASE_*` public
configuration names.

**Reason:** They are already configured and working. `next.config.ts` maps them
to the `NEXT_PUBLIC_FIREBASE_*` build identifiers consumed by Next client code.
There is no new `VITE_PUBLIC_FIREBASE_*` family.

## Decision 05 — Predictions are permanently immutable

**Decision:** A confirmed prediction is final, even if the fight remains open or
is later reopened.

**Reason:** FightLobby is a public record of calls, not a rolling odds form.
Immutability makes consensus, discussion badges, scoring, and user reputation
credible.

**Implementation rule:** The deterministic document is `${fightId}_${uid}`;
first write creates locked version 1, identical request retries are idempotent,
and later submissions return `prediction_already_locked`.

## Decision 06 — Exactly one consensus vote per account per fight

**Decision:** Retries, App Check failures, double clicks, or multiple domains may
not create additional votes.

**Reason:** Consensus must count unique user predictions. The deterministic
prediction document, transaction, idempotency revision, and sharded counter
update are the server authority; UI state is not the safeguard.

## Decision 07 — Consensus is earned by making a pick

**Decision:** Upcoming matchup consensus is hidden until the current user has
locked their own prediction.

**Reason:** This prevents the crowd from anchoring a user's call and is the only
“hide picks” privacy behavior required for launch.

**Clarification:** It is not a user setting. Public prediction materialization
after matchup lock and per-author discussion badges are separate behavior.

## Decision 08 — Confidence is removed

**Decision:** There is no confidence slider, field, analytics dimension, or
stored confidence value.

**Reason:** It did not affect scoring and added friction/noise.

## Decision 09 — Prediction methods are intentionally narrow

**Decision:** Users choose only KO/TKO, Submission, or Decision. Generic `Other`
is not a prediction option.

**Reason:** These groups map cleanly to the scoring system and consensus. The
admin result model remains broader so it can record draws, no contests,
disqualifications, overturns, and unusual official outcomes.

## Decision 10 — Scoring is 5/3/2

**Decision:** Correct winner earns 5 points, correct method group adds 3, and
correct exact detail adds 2. A wrong winner earns zero for that fight.

**Exact detail:** Round for KO/TKO/submission; decision type for decisions.

**Reason:** Winner remains the dominant call while method and detail reward
specificity. Confidence never changes points.

## Decision 11 — Matchups lock individually

**Decision:** Admin locks each matchup at its walkout. There is no bulk or
event-wide lock.

**Reason:** UFC cards move unpredictably. Individual locking preserves maximum
participation without allowing picks after a fight is visibly underway.

## Decision 12 — Reopen is exceptional and does not unlock picks

**Decision:** An authorized admin may reopen a matchup with a typed confirmation
and required reason regardless of provider fight status.

**Effect:** Existing predictions remain immutable. Only users without a pick may
submit. Public-pick visibility is suppressed while reopened and restored on the
next lock.

## Decision 13 — Fight result submission and event completion are separate

**Decision:** Saving an official result grades/regrades that fight. Marking the
event complete only changes event/chat lifecycle.

**Reason:** An event cannot safely infer detailed results, and grading must be
versioned per fight. Event completion must never fabricate or silently grade
missing outcomes.

## Decision 14 — Result corrections regrade from source truth

**Decision:** Correct the official fight result and rerun idempotent grading;
never patch user totals or leaderboards directly.

**Reason:** Predictions, profile aggregates, boards, achievements, and audit
history must remain reproducible from a versioned result.

## Decision 15 — Six-hour event/chat safety windows remain

**Decision:** Public live state has a six-hour main-card fallback. When the admin
marks an event complete, chat remains writable for six hours and is then
read-only.

**Reason:** Actual card end time cannot be known in advance, and fans may discuss
the conclusion. The owner can mark completion immediately for accurate event
lifecycle without abruptly ending conversation.

## Decision 16 — Live chat messages expire after 30 days

**Decision:** RTDB live chat is ephemeral and purged 30 days after its write
window closes.

**Reason:** This bounds cost, limits stale-room activity, and distinguishes live
conversation from persistent matchup analysis.

## Decision 17 — Posts and live chat are separate products

**Decision:** Persistent posts/replies use Firestore discussion collections;
live event/matchup messages use RTDB room paths. Messages are never automatically
copied between them.

**Reason:** Posts support durable threaded analysis. Live chat supports a fast,
bounded, event-time stream with different retention and moderation needs.

## Decision 18 — Public prediction badges show only winner and method

**Decision:** On matchup posts and live chat, an author's badge may say, for
example, `Hernandez by Submission`.

**Guardrail:** Never show the predicted round or exact decision detail in that
badge.

**Reason:** Winner/method makes discussion playful and accountable without
turning every message header into a full prediction receipt.

## Decision 19 — Public result badges are user-friendly

**Decision:** After an official result, event and matchup pages place a concise
badge with the winner, method, and appropriate round/detail near the winner.

**Reason:** Users should understand the outcome without opening admin data or a
raw result document.

## Decision 20 — Viewer-local time is the display default

**Decision:** Store UTC instants and render them using the browser's IANA
timezone. Do not hardcode Pacific, Central, or venue time for all users.

**Reason:** FightLobby serves the whole country and beyond. The same instant must
appear correctly for each visitor. Venue timezone remains data for context and
admin review.

## Decision 21 — No fabricated individual bout times

**Decision:** Publish prelim and main-card start times only. Individual matchup
pages show division and rounds, not an “event start” date or approximate bout
clock.

**Reason:** Bout duration and broadcast pacing make individual starts unknown.

## Decision 22 — Fight Night numbering follows official branding

**Decision:** Do not invent a UFC Fight Night sequence number when UFC's official
event branding omits it. Numbered PPV events retain their official number.

**Reason:** External databases use inconsistent unofficial Fight Night numbering.
FightLobby should match the reviewed official source.

## Decision 23 — Fighter identity never relies on name alone

**Decision:** Link an imported fighter through a stable official/provider mapping
or reviewed multi-field identity evidence. Same-name athletes receive separate
IDs.

**Reason:** Names, weight classes, records, and even nationalities can collide or
change. Identity errors would corrupt years of stats and prediction history.

## Decision 24 — Fighter photos are deferred pending rights

**Decision:** Do not scrape or upload fighter images merely because the app is
free. The UI works without circular initial placeholders.

**Reason:** Copyright/publicity rights still apply to a noncommercial launch.
Use licensed, permissioned, press-kit, or user-supplied assets only after a clear
policy and attribution record exist.

## Decision 25 — Handles are public, normalized, and transactional

**Decision:** Handles are 3–20 characters, use supported letters/numbers/
underscore rules, are checked with a debounced availability endpoint, and are
claimed transactionally through `handles/{normalized}`.

**Reason:** A UI check improves feedback but only the transaction can guarantee
uniqueness under concurrency. Handle-change cooldown remains a product rule.

## Decision 26 — Admin authority is dual-source and server-enforced

**Decision:** Admin access requires both a Firebase custom claim and the matching
private Firestore role. Every mutation also requires a valid session, same-origin
request, action confirmation/reason where applicable, and audit record.

**Reason:** A route hidden in the UI is not security. Dual-role checks protect
against stale or partially compromised state.

## Decision 27 — Admin UID is not hardcoded in application source

**Decision:** Grant admin through the guarded bootstrap process and refresh the
user's token by signing out/in.

**Reason:** Source-level identity lists are brittle, leak operational identity,
and bypass auditable role management.

## Decision 28 — User following remains; event/fighter following is removed

**Decision:** Members may follow other FightLobby members to keep up with their
public record. Event and fighter follow controls are removed until they power a
real experience.

**Reason:** Storing unused follows creates misleading UI and dead data.

## Decision 29 — Notification preferences are removed for launch

**Decision:** Do not show notification settings until FightLobby can actually
deliver the corresponding reminders/results.

**Reason:** A preference UI that has no delivery system is deceptive.

## Decision 30 — Account deletion is real deletion, not a dormant request

**Decision:** A confirmed deletion removes the Firebase Auth user and eligible
private/public data across Firestore, RTDB, and Storage.

**Guardrail:** Required audit/moderation evidence is retained only as designed and
anonymized where appropriate.

## Decision 31 — Cost-sensitive reads are bounded

**Decision:** Live chat uses bounded pages and child listeners, discussion uses
paginated roots/replies and cached previews, prediction consensus uses sharded
counters/background aggregation, and grading constructs boards once per run.

**Reason:** An event-time product can spike abruptly. Correct data structures are
more reliable than hoping advertising immediately covers unbounded Firebase
usage.

## Decision 32 — `codex/builder` is the integration branch

**Decision:** Build, verify, and preview changes on `codex/builder`; merge into
`main` only after preview review and checks.

**Reason:** `main` is production. Vercel branch aliases can lag during provider
incidents, so deployments are verified by Git SHA rather than name alone.

## Decision 33 — Vercel and Firebase deploys are independent

**Decision:** Merging/pushing web code deploys through Vercel, but Firebase rules,
indexes, Storage/RTDB rules, and Functions are deployed explicitly when changed.

**Reason:** Assuming Vercel deploys backend infrastructure causes silent version
drift and production failures.

## Decision 34 — Documentation is verified, not blindly trusted

**Decision:** The root handoff package is the current written authority, but a
new task must verify it against code before a high-risk change.

**Reason:** Documentation can age. Schemas, server actions, rules, tests, and the
deployed commit remain the executable truth.

## Decision 35 — Member avatars are optional and user-controlled

**Decision:** A Google profile-photo URL may be shown as the member's current
avatar without copying the source image. Members can replace it with a locally
cropped 512 × 512 WebP upload or remove it completely from onboarding and
Profile settings. Custom uploads use one owner-writable Storage object at
`avatars/{uid}/avatar.webp`; the server validates the stored object before it
updates the public profile version and Firebase Auth photo URL.

**Reason:** Signed-in identity should be recognizable without turning a provider
photo into an irreversible data import. A deterministic, size-limited object
keeps access control, replacement, cache invalidation, and deletion auditable.

## Decision 36 — Card order is mutable metadata, not matchup identity

**Decision:** Active fights in reviewed fixtures are listed in one contiguous,
top-to-bottom sequence. Moving a bout changes only `cardSegment` and
`boutOrder`; existing fight IDs and participant IDs remain stable.

**Reason:** Predictions store stable fight and winner-fighter IDs. Treating card
position as identity would detach or misattribute picks whenever UFC moves a
bout. Validation and guarded refresh checks therefore fail closed on identity
changes while allowing audited card-order corrections.

## Decision 37 — Prediction workers are required production infrastructure

**Decision:** Result submission remains a durable Firestore job workflow, and
prediction counts remain sharded with asynchronous materialization. Production
must deploy and monitor both `processAdminJob` and
`refreshPendingPredictionAggregates`; callable prediction functions alone are
not a complete prediction backend.

**Reason:** The web admin can safely persist results and jobs even during a
worker outage, but visible results do not prove that grades, profiles,
leaderboards, or row counters were materialized. Keeping durable jobs preserves
the source data, while explicit worker verification and guarded reconciliation
make recovery deterministic without editing points by hand.

## Decision 38 — Event standings rank every participant

**Decision:** An event board includes every member who submitted at least one
prediction for that event. It has no graded-pick or card-participation floor.
The public leaderboard defaults to the newest admin-completed event and exposes
other completed events through one **By event** selector.

**Reason:** Event standings are a record of that event's community, especially
when a launch has a small group or members join during the card. Applying a
volume threshold can hide every real participant and make valid grading look
broken.

## Decision 39 — Early season accuracy includes every graded member

**Decision:** The season accuracy board has no participation floor while the
community is small. Every member with at least one graded pick is ranked by raw
winner accuracy, followed by deterministic volume, points, exact-pick, and UID
tie breaks. A statistical eligibility rule may be introduced later as a
separate product decision.

**Reason:** A 20-pick threshold produced an empty launch leaderboard and exposed
statistical language that did not help members understand their rank. Showing
the active community now is more useful, while calculation versioning preserves
a clean path to change the model later.

## Decision 40 — Prediction history belongs to member profiles

**Decision:** Personal prediction history is a dedicated section of the private
Settings workspace and an event-filterable record on public member profiles; it
is not another global navigation destination. Private history may include a
member's submitted open-event picks. Public history reads only materialized
`publicPicks`, which exist after the matchup locks. Both views use a desktop
table and mobile cards and can be filtered across participated events in
newest-first order.

**Reason:** Prediction history is account context, while the global navigation
is for site-wide event discovery and rankings. Reusing the post-lock public read
model prevents early pick disclosure, and lazy-loading the private record avoids
charging full-history reads on every routine Settings visit.

## Decision 41 — Forum topics use immutable IDs and page-bucketed replies

**Decision:** Site-wide discussion topics use
`/discussions/{immutableThreadId}/{titleSlug}`. Author handles never identify a
topic. Replies are assigned transactionally to immutable 20-reply page buckets,
and the directory loads at most 40 topics ordered by latest activity. Directory
search filters that bounded client payload rather than issuing search reads on
each keystroke.

**Reason:** Handle changes must not break shared links, canonical metadata, or
search indexing. Stable page buckets provide understandable numbered pagination
without Firestore offset costs, while bounded directory reads keep forum cost
predictable as activity grows.
