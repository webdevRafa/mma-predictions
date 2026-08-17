# UFC provider ingestion

FightLobby's production ingestion boundary is `@fightlobby/providers`. The web app imports only canonical domain models. The first real adapter targets SportsDataIO's documented MMA v3 endpoints and is gated behind all three of:

- `MMA_PROVIDER=sportsdataio`
- `SPORTSDATAIO_MMA_KEY`
- `SPORTSDATAIO_COMMERCIAL_RIGHTS_CONFIRMED=true`

The rights flag is an operational acknowledgement, not a substitute for a signed provider agreement. Keep it false until the production license permits FightLobby's storage, display, and archive behavior.

## Pipeline

`discoverUpcomingEvents` runs every six hours and enqueues one `syncEventCardTask` per UFC event. Near event time, `syncLiveEvents` re-enqueues current cards every five minutes. Cloud Tasks applies bounded exponential retry and the sync run checksum makes retries idempotent.

Each task validates the vendor payload with Zod, normalizes US Eastern datetimes to UTC, resolves external identifiers through `providerMappings`, computes a diff, applies allowlisted `manualOverrides`, writes canonical event/fight/fighter documents, archives the raw response, creates a manifest, and calls the internal revalidation endpoint. A completed official result invokes the existing idempotent prediction grader.

Raw objects use:

`raw/{providerKey}/{entityType}/{yyyy}/{mm}/{dd}/{externalId}/{timestamp}.json.gz`

Raw responses and manifests are private. Set `RAW_PROVIDER_ARCHIVE_ENABLED=false` only where the provider contract forbids archiving; manifests still record that archive storage was disabled.

## Identity and overrides

Provider IDs never become canonical IDs. `providerMappings` owns the association. Fighter dedupe permits an exact normalized-name plus birth-date match; ambiguous matches stop ingestion for manual review. A name alone is never enough to merge fighters.

Provider values and editor overrides are retained in the private `providerEntityState` collection. Editors write to `manualOverrides` there; only allowlisted roots are projected onto canonical public fields, and every later provider sync reapplies those overrides. Provider IDs and raw source values are not stored on public event, fight, or fighter documents.

## Operations

The admin-only `/admin/sync` page shows recent runs, errors, and archive state without exposing keys or raw payloads. `runEventSync` supports a default dry-run and an explicit production run for trusted admin tooling. `nightlyIntegrityCheck` records missing event/fighter references. `reconcileProviderChanges` performs a daily discovery sweep. `refreshFighterTask` pulls full fighter profiles independently of event-card summaries.

## Manual event schedule contract

Reviewed JSON imports store broadcast starts as ISO 8601 UTC timestamps:

- `prelimsStartsAt` is the first scheduled prelim and controls the public transition from **Next UFC event** to **Happening now**.
- `mainCardStartsAt` is the advertised main-card start.
- `startsAt` temporarily mirrors `mainCardStartsAt` for legacy readers and Firestore ordering.
- `venueTimezone` is an IANA zone such as `America/Chicago`; it labels the event's local zone but is not used as an ambiguous timestamp.

The UI compares the visitor's clock with those absolute instants. `Intl.DateTimeFormat` then renders both starts in the visitor's own time zone, including Eastern, Central, Mountain, Pacific, Alaska, and Hawaii. Do not write display strings such as `8/22/2026 5 PM` to the fixture; they lose the originating zone and daylight-saving offset.

Before a reviewed JSON refresh may write production, the guarded script verifies the exact Firebase project, event identity, and live Firestore fight-ID set. It merges schedule and fighter metadata while preserving live event/fight state, prediction counts, and results. The stored manual-import fixture and audit record are the provenance trail.

## Fighter statistic provenance

Each manually reviewed fighter includes `sourceUrl`, pointing to the official UFC athlete profile used for the record and available statistics. Physical measurements and career rates remain absent when UFC does not publish them; importers must never infer or fabricate a debutant's values. The public Tale of the Tape renders those gaps as unavailable until a later reviewed refresh supplies them.
