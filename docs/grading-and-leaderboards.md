# Grading and leaderboards

FightLobby grades predictions only from an official fight result. `gradeFightPredictions`
and `regradeFightPredictions` are App Check-protected admin callables; both delegate to
the same idempotent grading core.

## Scoring V1

- Correct winner: 5 points
- Correct method group: 3 additional points
- Correct finish round or decision type: 2 additional points
- Maximum: 10 points
- Draws, no contests, overturned results, unofficial results, and results without a
  winner are void. Voids do not count as graded picks and do not affect streaks.

Every run is keyed by fight ID, result version, and scoring version. Repeating a
completed run returns its stored summary. A result correction must increment
`result.resultVersion`; the next run archives the previous grade, replaces it, and
recomputes user totals and boards from source predictions. No score totals are
incremented in place.

## Reconciled aggregates

Profile totals, winner streaks, badges, event championships, and rank summaries are
derived again after each grading run. This makes replay and correction safe and keeps
the profile total equal to the sum of current graded prediction documents.

The public boards are:

- Event: points from every member who made at least one prediction on the event;
  void-only participation remains visible with zero graded picks.
- Season points: total points, then deterministic scoring tie breaks.
- Season accuracy: every member with at least one graded pick, ranked by winner
  accuracy and deterministic tie breaks.
- Streak: current correct-winner streak, with voids ignored.

Only completed events award an event championship. Correcting or voiding a result
recalculates the event champion and removes a stale championship before badges are
rebuilt.

## Verification

Pure domain tests cover scoring, void outcomes, inclusive accuracy ranking, streaks,
and badges. The Firestore emulator integration test covers an initial grade, repeated
idempotent execution, a winner correction, grade history, leaderboard reconciliation,
champion replacement, and a later no-contest void.
