# Production launch

The repository is production-ready only when this document's owner-controlled
infrastructure gates are complete. A successful preview build is not production
sign-off. Keep ads disabled for the initial launch.

## 1. Provision isolated production infrastructure

Create or confirm a dedicated Blaze-plan Firebase project. Record its immutable
project ID in the `production` alias in `.firebaserc`; never point that alias at
staging. Enable Authentication, Firestore, Realtime Database, Storage, Cloud
Functions, and App Check. Choose data locations deliberately because moving them
later is disruptive.

In Firebase Authentication:

- enable Google and email/password providers;
- add the canonical FightLobby domain to Authorized domains;
- set public support and sender details; and
- keep test accounts out of the production user set.

Register the production web app with reCAPTCHA Enterprise App Check. Observe App
Check metrics before enabling enforcement, then enforce it for Authentication,
Firestore, Realtime Database, Storage, and callable Functions. Unverified traffic
is rejected after enforcement and the change can take time to propagate. See the
[Firebase enforcement guide](https://firebase.google.com/docs/app-check/enable-enforcement).

Deploy infrastructure from a clean, reviewed commit:

```bash
firebase use production
firebase deploy --only firestore:rules,firestore:indexes,database,storage
pnpm --filter @fightlobby/functions build
firebase deploy --only functions
```

Verify the deployed Functions `health` endpoint before enabling provider jobs.

## 2. Configure the Vercel project correctly

The Vercel project must use the repository root (`.`) as **Root Directory**. Do
not set it to `apps/functions`; that directory is a Firebase Functions package
and Vercel will report that no Next.js version can be detected. The checked-in
`vercel.json` then selects Next.js, installs from the monorepo lockfile, builds
`@fightlobby/web`, and reads `apps/web/.next`.

Use separate Preview and Production environment values. Changing an environment
variable only affects subsequent deployments, so redeploy after every production
environment change. Vercel documents that separation in
[Environments](https://vercel.com/docs/deployments/environments) and
[Environment variables](https://vercel.com/docs/environment-variables).

Configure all non-empty production values from `.env.example`, with these launch
constraints:

- `FIGHTLOBBY_DATA_SOURCE=firestore`;
- `MMA_PROVIDER=sportsdataio`;
- `SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED=true` only after licensed production
  rights are documented;
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`;
- `FIREBASE_APP_CHECK_ENFORCED=true` after the metrics review;
- `NEXT_PUBLIC_SITE_URL` is the bare HTTPS custom-domain origin;
- public and Admin Firebase project IDs match the production project;
- `REVALIDATION_SECRET` is an independently generated value of at least 32
  characters; and
- every AdSense publisher, client, and slot variable remains unset.

Never copy staging provider keys, service-account keys, App Check debug tokens, or
emulator settings into Production. Vercel project members who can view environment
variables should be limited to operators who need that access.

Run the secret-safe preflight against an environment file pulled from Production:

```bash
vercel env pull .env.production.local --environment=production
pnpm launch:preflight -- --env-file .env.production.local
```

The command prints variable names and issue codes, never values. Delete the local
production export after the launch session; it is ignored by Git but remains a
credential-bearing file.

## 3. Domain, deploy, and live verification

Add the apex custom domain to Vercel and configure `www` as a redirect to the apex.
Vercel applies a configured domain to the current production deployment; see
[Deploying and redirecting domains](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).
Confirm DNS and certificate issuance before changing `NEXT_PUBLIC_SITE_URL` and
redeploying.

Merge a CI-green commit to the configured Production Branch or deliberately
promote its verified deployment. Then run:

```bash
pnpm launch:verify -- https://fightlobby.com
```

This verifies the canonical HTTPS origin, public and legal routes, sitemap,
robots, security headers, `/api/health`, and the ads-off launch state. Also test
Google and email sign-in, one real prediction, one report, and one admin action
using designated production smoke-test accounts; remove their content afterward
through audited application controls.

## 4. Monitoring, budgets, and alerts

Before public traffic, assign a named primary and backup operator and configure:

- Vercel deployment failure notifications, function error alerts, and an external
  uptime check for `/api/health` and `/`;
- Firebase/Google Cloud alerts for Functions errors and latency, Firestore and
  Realtime Database usage, Storage growth, and App Check rejection rate;
- provider quota and error notifications;
- GA4 only behind analytics consent; and
- Google Search Console ownership and sitemap submission.

Create a project-scoped Cloud Billing budget approved by the owner. Start with
actual and forecast threshold notifications at 50%, 75%, 90%, and 100%, route
them to both operators, and review the amount after every event. Budget alerts do
not automatically cap spend, as the
[Cloud Billing documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets)
warns, so pair alerts with the feature-flag incident controls below.

## 5. Required owner sign-off

Record these outside the repository in the restricted operations system:

| Gate                | Required evidence                                                          |
| ------------------- | -------------------------------------------------------------------------- |
| Firebase production | project ID, region, billing owner, rules/functions deploy SHA              |
| Vercel production   | project, Production Branch, Root Directory `.`, deploy URL and SHA         |
| Domain              | registrar owner, DNS verified, HTTPS verified, canonical redirect verified |
| Provider            | contract owner, allowed uses, quota, production key rotation date          |
| Budget              | monthly amount, notification recipients, escalation owner                  |
| Monitoring          | uptime monitor URL, alert routes, test-alert timestamp                     |
| Moderation          | primary/backup coverage and contact channel                                |
| Backups             | schedules, retention, latest restore-drill record                          |
| Legal               | owner/counsel approval date for every published policy                     |

Launch is blocked until each row has an accountable owner and evidence. AdSense
approval, CMP deployment, and `adsEnabled=true` are a separate post-launch change.
