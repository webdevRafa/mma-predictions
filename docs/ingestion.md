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
