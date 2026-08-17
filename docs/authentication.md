# Authentication and public identity

FightLobby uses Firebase Authentication for Google and email/password sign-in. The browser exchanges a fresh Firebase ID token for a five-day, HTTP-only session cookie. Protected pages and all account mutations verify that cookie on the server and load the current account status from Firestore.

## Firebase Console setup

1. Enable **Google** and **Email/Password** in Authentication → Sign-in method.
2. Add `fightlobby.com`, the active Vercel preview domains, and local development hosts to Authentication → Settings → Authorized domains.
3. Configure the public `VITE_FIREBASE_*` values and server-only `FIREBASE_ADMIN_*` values listed in `.env.example`.
4. Never prefix Admin credentials with `VITE_` or `NEXT_PUBLIC_`; those values must remain server-only.

Firebase web values use the existing `VITE_FIREBASE_*` names. Next.js maps the public Firebase configuration into the client bundle explicitly; server-only Admin credentials must remain unprefixed.

## Account boundaries

- `users/{uid}` is private and stores account state, roles, terms, preferences, and moderation data.
- `profiles/{uid}` is public-safe and stores only handle, optional display name/avatar, joined date, public prediction statistics, badges, and visibility.
- Email addresses and provider identifiers come from Firebase Authentication only in the signed-in member's private settings page. They are never written to a public profile.
- `handles/{normalized}` is server-only. A Firestore transaction prevents two accounts from claiming the same normalized handle and retains old records for redirects.
- Suspended, banned, and deleted accounts are rejected by the shared mutation policy. Deleted handles are quarantined rather than immediately recycled.

## Return context

Login and signup accept only same-site paths. The browser also preserves the guest prediction draft in session storage so the prediction flow can restore it after authentication without exposing it in a query string.

## Local verification

Java 21 is required for Firebase emulators. Run:

```bash
pnpm test:rules
```

The emulator suite verifies private/public Firestore boundaries, rejects profiles that contain private identity fields, proves concurrent handle claims produce one owner, and proves banned accounts cannot reserve handles. CI installs Java 21 before running this suite.
