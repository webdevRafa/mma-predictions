# UFC event-day runbook

This runbook assumes the production gates in `production-launch.md` are signed and
the event exists through the licensed provider adapter. The primary operator owns
data and deployment decisions; the moderation lead owns community response. A
named backup must be available for both roles.

## T-7 days to T-24 hours

- Confirm the event, card order, fighter mappings, scheduled start, and licensed
  provider identifiers in `/admin/data-sync` and `/admin/events`.
- Resolve every provider diff; do not create duplicate fighters to bypass a
  mapping question.
- Verify the latest staging event simulation and CI production build are green.
- Confirm `/api/health`, homepage, event page, sitemap, provider jobs, and alert
  delivery.
- Confirm Firestore and Realtime Database backup schedules succeeded recently.
- Confirm budget usage, provider quota, and the primary/backup operator roster.
- Review open reports and sanctions; make sure moderator custom claims and private
  account roles agree.
- Keep `adsEnabled=false`.

## T-60 minutes

1. Run a dry provider sync and review the normalized diff.
2. Confirm all fights remain open only when their authoritative status permits it.
3. Verify one designated account can sign in, submit/update a pick, and receive an
   App Check token.
4. Verify the fight lobby opens, chat posting works, and a moderator can remove a
   smoke-test message through the audited flow.
5. Open Vercel logs, Firebase Functions logs, provider error views, moderation
   queue, and billing/quota dashboards.
6. Freeze nonessential deployments until post-event review.

## Live event

- Watch provider sync freshness, `providerErrors`, task failures, stale event/fight
  pages, prediction lock counts, grading jobs, chat report age, function latency,
  App Check failures, and spend/quota alerts.
- At walkouts or another authoritative lock transition, confirm picks are locked
  and public consensus is materialized. Never reopen a started fight merely to
  accept a late pick.
- After each official result, confirm the fight reaches `completed`, predictions
  reach `graded`, a grading run exists, and affected pages revalidate.
- Moderate from the report queue. Preserve evidence; use sanctions and removals
  through admin controls, never direct database edits.

### Incident levels

| Level | Example                                                       | Immediate action                                                          |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| SEV-1 | incorrect scoring across fights, data corruption, auth bypass | set `siteReadOnly=true`; stop provider/live sync; page primary and backup |
| SEV-2 | stale live card, one failed grade, chat abuse surge           | disable affected subsystem; retain public read access; investigate logs   |
| SEV-3 | isolated content or UI defect                                 | document, mitigate in admin, schedule reviewed fix                        |

For a stale page, first confirm the Firestore write and sync run, then the internal
revalidation response, then the canonical page. Do not repeatedly sync until the
cause is understood. For a wrong official result, use the correction/regrade
procedure in `backup-restore-and-regrade.md`.

For a bad web deployment, stop further promotions and use Vercel's instant
rollback to the last verified production deployment. A rollback does not reverse
database writes, so assess data changes separately.

## Post-event

1. Confirm every fight has a terminal status and all eligible predictions are
   graded exactly once for the current result version.
2. Verify event and season leaderboard snapshots and investigate drift before
   announcing winners.
3. Resolve or assign every report and confirm expired sanctions are processed.
4. Review provider errors, function errors/latency, cache revalidation, App Check
   rejections, usage, and estimated cost.
5. Confirm the next backups complete and raw provider archives follow contract
   retention.
6. Record incident notes, result corrections, peak concurrency, cost footprint,
   and changes required before the next UFC event.
7. End the deployment freeze only after the operator and moderation lead sign off.
