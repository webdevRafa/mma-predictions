# Environment strategy

FightLobby uses isolated Firebase environments. Local development uses the `fightlobby-local` emulator project, the production alias points to the owner-managed `mma-cortex` project, and the staging alias remains a placeholder until a dedicated staging project is created. Do not deploy with the staging alias until it is replaced with that project ID.

The web application defaults to `FIGHTLOBBY_DATA_SOURCE=fixture`. Set it to `firestore` only in an environment with valid server-side Admin credentials and compatible production data. Firebase browser SDK configuration uses the established `VITE_FIREBASE_*` names; `apps/web/next.config.ts` explicitly exposes those public values to the Next.js client bundle. Admin credentials and provider secrets are server-only and must never use a `VITE_` or `NEXT_PUBLIC_` prefix.

`pnpm seed:emulator` refuses to run unless `FIRESTORE_EMULATOR_HOST` is set and the project ID starts with `fightlobby-local`.
