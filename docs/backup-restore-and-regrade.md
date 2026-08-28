# Backup, restore, and regrade

Backups protect infrastructure data; result regrading protects FightLobby's
derived scoring integrity. They are separate procedures and both require an audit
record.

## Backup policy

For production Firestore, enable a daily scheduled backup and a weekly scheduled
backup with owner-approved retention. The backup contains database data and index
configuration but not security rules or TTL policies; those remain versioned in
this repository. Firestore scheduled backups require the Blaze plan and incur
storage and restore charges. Current commands, limits, roles, and restore behavior
are documented by Firebase in
[Back up and restore data](https://firebase.google.com/docs/firestore/backups).

Enable Realtime Database automated daily backups with Gzip compression and an
owner-approved lifecycle policy. These backups include database data and rules as
JSON. Keep the generated backup bucket restricted and monitor job failures. See
[Realtime Database automated backups](https://firebase.google.com/docs/database/backups).

Keep these source-controlled and protected by branch review:

- Firestore, Realtime Database, and Storage rules;
- Firestore indexes;
- normalized provider fixtures used for regression tests; and
- Functions and web releases identified by commit SHA.

Raw provider archives may be retained only as permitted by the provider contract.
Never copy production user data into local fixtures.

## Restore drill

Perform a quarterly drill and before a material data migration:

1. select a known Firestore backup and record its resource name and timestamp;
2. restore into a new non-production database or isolated project;
3. restore a Realtime Database backup into an isolated staging instance;
4. deploy the matching rules and indexes from the recorded release SHA;
5. compare counts for events, fights, predictions, grading runs, profiles, reports,
   moderation actions, and audit logs;
6. replay the staging event simulation and verify idempotent grading; and
7. record recovery time, data loss window, discrepancies, and approver.

Do not test an in-place restore against production. A production restore begins
with `siteReadOnly=true`, paused provider sync, a fresh backup, incident approval,
and a written cutover/rollback plan. Restore into isolation first and validate
before any traffic switch. Never delete the active Firestore database as an
improvised restore step.

## Official-result correction and regrade

Use this procedure when the provider or athletic commission corrects a result:

1. capture the authoritative source, affected fight, old result, new result, and
   incident owner;
2. if the event is active, set `siteReadOnly=true` or disable predictions while
   assessing scope;
3. open `/admin/fights/{fightId}` and compare the provider diff;
4. use **Correct and regrade**, enter the corrected result, and provide a specific
   reason;
5. confirm the result version increased and the background `regrade_fight` job
   completed;
6. verify `gradingRuns`, member totals, event and season leaderboards, and the
   immutable audit entry;
7. run the same regrade once more only as an idempotency check—the totals must not
   change; and
8. re-enable mutations and record member-facing communication if rankings moved.

Never edit prediction scores, profile totals, or leaderboard documents directly.
The grading transaction reverses the prior grade before applying the corrected
version and rebuilds derived boards.

## Emergency data controls

- `siteReadOnly=true`: stop normal authenticated mutations while preserving
  operator access.
- `predictionsEnabled=false`: stop new picks without hiding public pages.
- `chatPostingEnabled=false`: make fight rooms read-only while preserving evidence.
- `providerSyncEnabled=false` and `liveSyncEnabled=false`: stop provider writes
  during an upstream incident.
- `adsEnabled=false`: permanent initial-launch state and emergency ad kill switch.

Every flag change requires a reason and is written to the admin audit log. Restore
one subsystem at a time after verification.
