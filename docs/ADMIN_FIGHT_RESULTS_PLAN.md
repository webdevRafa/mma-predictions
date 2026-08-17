# FightLobby Admin Fight Results Plan

## Objective

Give the FightLobby administrator a fast, reliable way to record official UFC fight results while watching an event live. Result entry should live beside the existing per-matchup prediction controls, trigger idempotent prediction grading, preserve a complete audit trail, and provide a deliberately safer workflow for later corrections.

This plan builds on the existing implementation rather than replacing it. FightLobby already has:

- A result model containing winner, method, method detail, round, time in round, official status, and result version.
- A basic `Correct and regrade` form on `/admin/fights/[fightId]`.
- Server-side participant and no-winner validation.
- Audited result writes and version increments.
- An `adminJobs` regrade queue and idempotent grading logic.

The existing form is too far removed from live event operations and treats an initial result like a correction. The new workflow should make routine first-time entry easy without making result corrections casual.

## Product Experience

### Event control board

Extend `/admin/events/[eventId]` so every matchup row displays two distinct operational states:

- Prediction state: open, locked, grading, graded, or void.
- Result state: awaiting result, provisional, official, grading, graded, or grading failed.

Each row should retain `Details` and its individual matchup lock control. Once predictions are locked, it should also expose an `Enter result` button. After a result exists, the button becomes `View result`; corrections remain available from the detailed fight page.

The event header should summarize:

- Total bouts.
- Results still needed.
- Provisional results.
- Official results.
- Grading jobs in progress or failed.

There should be no bulk result entry or bulk grading action.

### Initial result modal

`Enter result` opens a keyboard-accessible dialog containing:

- Winner: fighter A, fighter B, or no winner where permitted.
- Result method:
  - KO/TKO
  - Submission
  - Unanimous decision
  - Split decision
  - Majority decision
  - Disqualification
  - Draw
  - No contest
  - Overturned
  - Other
- Method detail, such as punches, doctor stoppage, rear-naked choke, or technical decision.
- Round, constrained to the fight's scheduled round count.
- Time of round entered as `MM:SS`, then normalized to `timeInRoundSeconds` on the server.
- Result status: official or provisional.

The form should conditionally explain or require fields:

- A winner is required for KO/TKO, submission, decisions, disqualification, and other winner-bearing results.
- A winner is forbidden for draw, no contest, and overturned results.
- Round and time are required for stoppages, submissions, disqualifications, and no contests.
- Decision results show the scheduled final round and `5:00` by default, but the administrator can correct them when the official record differs.
- Time must be between `0:00` and `5:00`.

The confirmation step summarizes the complete result in plain language. A routine initial result uses a standard audited reason such as `Manual live result entry` and requires one explicit confirmation click.

### Result receipt and status

After submission, replace the form with a result receipt showing:

- Winner or no-winner outcome.
- Method and method detail.
- Round and formatted time.
- Official/provisional badge.
- Result version.
- Recorded time.
- Grading state and failure message, when applicable.

The row and modal should update only after the server confirms the write. While grading runs, show a non-blocking `Grading predictions` state. A failed job should expose `Review failure` and an audited retry from the fight detail page.

## Result Lifecycle

### Separate initial entry from correction

Introduce two server actions with different safety requirements:

1. `record_result`
   - Allowed only when the fight has no existing result.
   - Creates result version 1.
   - Uses the standard live-event audit reason.
   - Rejects duplicate initial submissions except an identical idempotent retry.

2. `correct_result`
   - Allowed only when a result already exists.
   - Requires a written audit reason and typed confirmation.
   - Increments `resultVersion`.
   - Preserves the prior result in immutable history.
   - Enqueues an idempotent regrade when the corrected result is official.

This prevents an accidental second click from silently becoming a result correction.

### Prediction locking dependency

An official or provisional result cannot be recorded while predictions are open. The UI should explain that the matchup must be locked first, and the server must independently enforce this rule. Result entry must never silently lock a matchup because live operators should see and confirm that state transition.

Existing user predictions remain immutable throughout result entry, correction, grading, and emergency reopening.

### Provisional versus official

A provisional result may be stored for operational visibility, but it must not grade or void predictions. It keeps predictions locked and waits for official confirmation.

Changing a provisional result to official creates the next result version and starts grading. An official result correction starts regrading. Draw, no-contest, and other non-winner outcomes follow the existing scoring rules and may void predictions where appropriate.

## Data Model

Retain the public fight result fields:

```ts
result: {
  winnerFighterId?: string;
  method: ResultMethod;
  methodDetail?: string;
  round?: number;
  timeInRoundSeconds?: number;
  official: boolean;
  resultVersion: number;
  updatedAt: string;
}
```

Add server-controlled metadata that is not accepted from the browser:

```ts
resultAdmin: {
  enteredBy: string;
  enteredAt: Timestamp;
  lastCorrectedBy?: string;
  lastCorrectedAt?: Timestamp;
}
```

Add immutable result revisions under either `fights/{fightId}/resultRevisions/{version}` or an equivalent dedicated collection. Each revision records:

- Fight ID and result version.
- Complete before and after result.
- Actor UID.
- Audit reason.
- Timestamp.
- Associated grading job ID.

The existing audit log remains the operator-facing system record; result revisions provide deterministic regrade and forensic history.

## Server and Grading Workflow

1. Require the same-origin authenticated session, Firebase admin custom claim, and matching Firestore admin role.
2. Strictly validate the result against the fight participants and scheduled rounds.
3. Reject result entry if predictions are still open.
4. Use a Firestore transaction to create the next result version, set fight status to completed, update provider override state, create the immutable revision, create the audit record, and enqueue the grading job when appropriate.
5. Use a client-generated `requestId` plus fight/result version as the idempotency boundary.
6. For official winner-bearing results, transition `predictionStatus` from `locked` to `grading` and then `graded`.
7. For official void outcomes, transition to `void` through the same grading core.
8. For provisional results, leave predictions locked and do not enqueue grading.
9. Make the background worker update the job with queued, processing, complete, or failed status and surface that state in the admin UI.
10. Ensure grading updates user totals, event aggregates, leaderboards, and public prediction visibility exactly once.

The existing `gradeFightPredictionsCore` remains the canonical scoring operation. Both initial grading and corrections should call it through the same deployed job processor.

## Public-Site Behavior

After an official result is recorded:

- Fight and event pages display the winner, method, round, and formatted time.
- User locked-prediction receipts display earned points after grading.
- Consensus remains available according to the existing lock/reveal rules.
- Leaderboards and profile aggregates update only after the grading job completes.

Provisional results should be labeled clearly and should not show earned points.

## Security and Operational Safety

- Never accept actor IDs, result versions, timestamps, grading status, or audit metadata from the client.
- Require both Firestore role and Firebase custom claim for every result mutation and retry.
- Keep result entry and correction server-authorized even when invoked from the admin UI.
- Do not allow the winner to reference a fighter outside the matchup.
- Do not allow no-winner methods to carry a winner.
- Preserve every official result correction and its reason.
- Rate-limit duplicate submissions and use idempotency keys to prevent duplicate grading jobs.
- Keep manual provider overrides so a later provider sync cannot overwrite an administrator-confirmed result without generating a conflict review.

## Testing

### Domain and API tests

- Valid KO/TKO, submission, decision, draw, no-contest, DQ, and other results.
- Winner-required and winner-forbidden validation.
- Scheduled-round and `MM:SS` validation.
- Initial result create-only behavior and identical retry idempotency.
- Duplicate initial result rejection.
- Result entry rejection while predictions are open.
- Provisional results do not grade or void predictions.
- Official results create exactly one grading job.
- Corrections increment versions and create immutable history.

### Integration tests

- Result write and matchup-lock race.
- Official grading, void grading, and correction regrading.
- Counters, user scores, leaderboards, and public result materialization.
- Failed job visibility and audited retry.
- Provider sync cannot overwrite a manual result override.
- Dual-role authorization denial when either role source is missing.

### UI and accessibility tests

- Modal focus trapping, Escape cancellation, and focus restoration.
- Conditional fields and human-readable validation.
- Initial result confirmation summary.
- Result receipt and grading states.
- No bulk result action.
- Mobile usability during a live event.

## Delivery Phases

### Phase 1: Result semantics and server safety

- Add `record_result` separately from `correct_result`.
- Add conditional validation, `MM:SS` normalization, idempotency, revision history, and provisional-result behavior.
- Verify and deploy the `processAdminJob` background function.
- Add domain, API, and emulator integration tests.

### Phase 2: Live event result controls

- Add event-level result counts and per-matchup result state.
- Build the accessible initial-result dialog and read-only receipt.
- Keep dangerous corrections and retries on the detailed fight page.
- Add pending, complete, void, and failed grading states.

### Phase 3: Public results and operational verification

- Verify public result presentation, prediction scores, profile aggregates, and leaderboards.
- Run a complete staged event replay covering locks, results, grading, a correction, a no-contest, and a failed/retried job.
- Run lint, type checking, unit tests, emulator integration tests, production build, Firebase deployment verification, and a Vercel Preview smoke test.

## Acceptance Criteria

- The administrator can record every standard UFC result from the event operations page without navigating away.
- A matchup must be individually locked before a result can be recorded.
- Initial result entry is fast, while corrections require an explicit reason and stronger confirmation.
- Provisional results never grade or void predictions.
- Official results grade exactly once, and corrections regrade exactly once per version.
- All result mutations are dual-role protected, idempotent, versioned, and audited.
- The UI clearly exposes pending and failed grading jobs.
- Public fight pages, prediction receipts, aggregates, and leaderboards reflect the official result after grading completes.
