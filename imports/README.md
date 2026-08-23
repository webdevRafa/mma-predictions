# Manual production imports

These normalized JSON cards are point-in-time, human-reviewed recovery inputs
for the audited manual-import path. They are not a live sports-data feed and do
not imply UFC affiliation or authorization to redistribute UFC media.

Before importing a card, recheck the official event page for opponent changes,
card order, event time, and cancellations. Validate an import with:

```powershell
pnpm exec tsx scripts/validate-fixture.ts imports/ufc/<file>.json
```

List active fights in the same top-to-bottom order used on the event card:
main event first, followed by the rest of the main card, prelims, and then early
prelims. `boutOrder` must be contiguous and start at `1`. Fight IDs identify the
matchup, not its position on the card, so keep an existing fight ID unchanged
when a bout moves and update only its card metadata. This preserves predictions,
which are linked to stable fight and fighter IDs.

Production imports require Firebase Admin credentials, the exact project ID,
and an explicit migration confirmation phrase. The importer prints a dry-run
inventory when the confirmation is absent.

New events must use the guarded create-only importer. It refuses event, fight,
or chat-room collisions, verifies any existing fighter identities before a
merge, and confirms that the protected launch event and every prediction remain
untouched after the atomic write:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
$env:FIGHTLOBBY_PRODUCTION_PROJECT_ID="mma-cortex"
pnpm add:production:event -- imports/ufc/<file>.json

# Run only after reviewing the dry-run inventory.
$env:FIGHTLOBBY_PRODUCTION_IMPORT_CONFIRM="ADD <event-id>"
pnpm add:production:event -- imports/ufc/<file>.json
```
