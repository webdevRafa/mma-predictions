# Admin operations

FightLobby's `/admin` workspace is a server-rendered operations surface for UFC
event data, editorial publishing, prediction grading, identity review,
moderation, and emergency controls. Browser clients never receive Firebase Admin
credentials, provider credentials, or raw provider identifiers.

## Authorization and bootstrap

Admin pages and mutations require the `admin` role in both the private Firestore
user record and Firebase Authentication custom claims. A mismatch is denied. This
deliberate two-source check prevents either a stale database role or a stray token
claim from granting access on its own.

Bootstrap an administrator from a trusted environment with Firebase Admin
credentials:

```powershell
$env:FIGHTLOBBY_ADMIN_BOOTSTRAP_CONFIRM="the-firebase-uid"
pnpm admin:grant -- the-firebase-uid
```

The command requires the environment confirmation to exactly match the supplied
UID, writes both authorization sources, and creates an audit entry. The user must
sign out and back in to receive a refreshed ID token.

## Safety model

Every admin mutation requires:

- a reason of at least five characters;
- an action-specific confirmation phrase;
- a same-origin authenticated request;
- matching server-side role and custom-claim authorization; and
- an immutable entry in `auditLogs` containing the actor, target, reason, and
  before/after context.

Provider-backed event, fight, and fighter edits are also stored in the private
`providerEntityState.manualOverrides` map. Later syncs reapply those overrides
instead of silently replacing an editor's work. Provider comparisons expose field
differences in the admin UI without publishing vendor IDs or raw payloads.

## Operational surfaces

- **Dashboard:** counts, open moderation work, provider failures, background jobs,
  and emergency state.
- **Events and fights:** canonical metadata, original editorial content, card
  ordering, provider diffs, prediction locks, official-result correction, and
  idempotent regrading.
- **Fighters:** profile correction, provider diff, and guarded duplicate identity
  merge. Large or conflicting merges stop for a reviewed migration.
- **Data sync:** recent licensed-provider runs and failures.
- **Manual import:** domain-validated JSON fixtures for emergency recovery.
- **Moderation:** report disposition, message removal/restoration, room lifecycle,
  slow mode, account sanctions, and moderator/admin role management.
- **Leaderboards:** grading job health and recent ranking snapshots.
- **Feature flags:** read-only, auth, predictions, chat, ingestion, ads, email, and
  social-card kill switches.
- **Audit:** the recent append-only administrator action trail.

## Emergency behavior

`siteReadOnly` blocks normal authenticated mutations while preserving admin access
to the controls needed for recovery. The auth, predictions, chat posting, provider
sync, and live sync flags are enforced at their server entry points; UI state alone
is never the control boundary. Prediction reopening is refused once a fight is no
longer scheduled or prefight.

Correcting an official result increments its version and enqueues an `adminJobs`
record. The Firestore-triggered worker calls the existing idempotent grader, so a
retry cannot double-apply user statistics. Failed jobs remain visible for operator
review.

Keep advertising disabled until editorial completeness, provider rights, and event-
night moderation coverage have all been reviewed for launch.
