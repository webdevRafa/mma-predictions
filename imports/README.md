# Manual production imports

These normalized JSON cards are point-in-time, human-reviewed recovery inputs
for the audited manual-import path. They are not a live sports-data feed and do
not imply UFC affiliation or authorization to redistribute UFC media.

Before importing a card, recheck the official event page for opponent changes,
card order, event time, and cancellations. Validate an import with:

```powershell
pnpm exec tsx scripts/validate-fixture.ts imports/ufc/<file>.json
```

Production imports require Firebase Admin credentials, the exact project ID,
and an explicit migration confirmation phrase. The importer prints a dry-run
inventory when the confirmation is absent.
