# Environment strategy

FightLobby uses three isolated Firebase projects: `fightlobby-local` for emulators, `fightlobby-staging`, and `fightlobby-production`. Replace the staging and production aliases in `.firebaserc` with the owner-created project IDs before deployment.

The web application defaults to `FIGHTLOBBY_DATA_SOURCE=fixture`. Set it to `firestore` only in an environment with valid server-side Admin credentials. Browser SDK configuration uses `NEXT_PUBLIC_*` values; Admin credentials and provider secrets are server-only.

`pnpm seed:emulator` refuses to run unless `FIRESTORE_EMULATOR_HOST` is set and the project ID starts with `fightlobby-local`.
