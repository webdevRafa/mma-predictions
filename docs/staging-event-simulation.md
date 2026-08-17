# Staging event simulation

`pnpm staging:simulate` starts isolated Firestore, Realtime Database, and Storage
emulators and replays the complete normalized UFC fixture. The runner has a hard
guard: it refuses to execute unless the project ID starts with `fightlobby-local`,
both database emulators are present, and `STAGING_SIMULATION=1` was set by the
wrapper command. It cannot target production.

## Replay sequence

The runner performs the following without manual database editing:

1. ingest the card through the mock implementation of the production provider
   boundary;
2. create three synthetic members and submit one prediction per member per fight;
3. post a chat message, report it, remove it, and resolve the report;
4. advance every fight through walkouts, in progress, and completed provider
   states;
5. lock and materialize predictions at walkouts;
6. grade each official result and rebuild profile/event/season rankings;
7. correct the first result, increment its result version, and reconcile prior
   grades;
8. repeat grading to prove member totals do not change twice;
9. send every provider transition through a secret-protected local revalidation
   probe and verify the homepage, event, fight, and sitemap paths; and
10. fail if any fight is unfinished, any prediction is ungraded, the report is
    unresolved, the message remains public, revalidation is incomplete, or a
    provider error is logged.

The successful JSON report includes transition, prediction, grading, moderation,
and revalidation totals plus counts of important Firestore document groups. These
counts are an operational footprint for comparing staging runs; they are not a
production Firebase billing quote.

## CI and local requirements

The CI workflow installs Node 22 and Java 21, runs rules/integration tests, then
runs this simulation before the production build. Local execution also requires a
Java 21 runtime because the Firebase Emulator Suite is Java-based.

Do not replace this replay with a production-data test. Provider production keys,
real user accounts, and real chat content are intentionally outside its scope.
