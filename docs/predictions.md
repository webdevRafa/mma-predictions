# Prediction system

FightLobby stores one server-only prediction document per user and fight at `predictions/{fightId}_{uid}`. The browser can draft a pick, but only the Next.js server endpoint can create or update the canonical record.

## Submission flow

1. The client validates winner, method, detail, and confidence for immediate feedback.
2. A guest draft is stored in session storage with the fight ID and safe return path.
3. After sign-in and onboarding, the fight page restores the draft for confirmation.
4. `PUT /api/predictions/{fightId}` verifies App Check when enforcement is enabled, verifies the session and account status, reads the canonical fight in a Firestore transaction, and evaluates lock state using server time and provider status.
5. The transaction writes the active prediction, an immutable request-ID revision, and deterministic counter-shard deltas.
6. A conflict-safe aggregation transaction materializes the public summary and returns it only after the member has predicted or the fight has locked.

Direct Firestore writes to predictions, revisions, and counter shards remain denied by security rules.

## Lock policy

Submission is accepted only while `predictionStatus` is `open`, provider status is `scheduled` or `prefight`, data quality is not blocked, and server time is earlier than `predictionsLockedAt` when present. The UI intentionally says **Predictions lock at walkouts** because individual UFC bout times are approximate.

The admin-only, App-Check-enforced `lockFightPredictions` callable changes the canonical fight state first. Concurrent submissions then retry against the locked state. The task marks active predictions immutable and creates a public-safe record at `profiles/{uid}/publicPicks/{fightId}`. It is safe to run repeatedly.

## Counters and retries

Each UID hashes to one of 20 shards. Creating a prediction increments total and pick buckets; changing a pick decrements the old buckets and increments the new ones without changing total. Request UUIDs make retried submissions idempotent. Local fixture seeding creates a `baseline` shard so fictional demo consensus remains intact.

## Scoring version 1

- Correct winner: 5 points
- Correct method: 3 additional points
- Exact finish round or decision subtype: 2 additional points
- Wrong winner: 0 total points

Draws, no contests, overturned results, missing winners, and unofficial results are void. Confidence is stored for future calibration and does not affect points.
