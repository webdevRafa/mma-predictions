# FightLobby Product Specification

## Purpose and document authority

FightLobby is a UFC-focused prediction and community product. Members make permanent fight predictions, compare the revealed community consensus, participate in persistent matchup discussions and event-day live chat, and build a public prediction record after official results are graded.

This document describes the intended product behavior as of August 22, 2026. It is the concise product source of truth for future work. When an older document conflicts with this file, verify the behavior in the current code and update the older document instead of silently restoring legacy behavior.

The five root-level handoff documents should be read together:

- `FIGHTLOBBY_PRODUCT_SPEC.md`: user-facing and operator-facing behavior.
- `FIGHTLOBBY_ARCHITECTURE.md`: implementation and data architecture.
- `FIGHTLOBBY_OPERATIONS.md`: event-day and deployment procedures.
- `FIGHTLOBBY_CURRENT_STATE.md`: current branch state, limitations, and next work.
- `FIGHTLOBBY_DECISIONS.md`: settled product and engineering decisions.

## Launch scope

- The launch product supports UFC events only.
- Event, matchup, fighter, and schedule data are imported from manually reviewed JSON into Firebase. An automated provider is not required for launch.
- Each event has dedicated event and matchup pages.
- The product is responsive and supports desktop and mobile experiences.
- Times are stored as absolute timestamps and displayed in the visitor's local browser timezone.
- The current brand is **FightLobby**. The flat octagon/FightLobby asset is the navigation logo and browser icon.

## Primary public routes

| Route            | Purpose                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `/`              | Fight-day home page, current/next event card, card overview, and full-card prediction entry point. |
| `/events`        | Event discovery when multiple events exist.                                                        |
| `/events/[slug]` | Official event overview, schedule, fight card, event chat, and full-card prediction entry point.   |
| `/fights/[slug]` | Dedicated matchup, prediction flow, consensus, stats, posts, and live chat.                        |
| `/leaderboards`  | Scored member rankings and eligible event/season boards.                                           |
| `/u/[handle]`    | Public member profile and prediction record.                                                       |
| `/settings`      | Account, public profile, personal prediction history, privacy, safety, and deletion controls.      |
| `/admin`         | Server-authorized operations for the owner/admin.                                                  |

## Home page behavior

The home page prioritizes the next scheduled event or the currently live event.

- Before prelims begin, the event card is labeled **Next UFC event** and shows a countdown to prelims.
- Within 24 hours, the countdown uses a live clock with hours, minutes, and seconds.
- From prelims start through the live window, the event is presented as live/happening now.
- The automatic live window extends through six hours after the main card start unless the administrator marks the event complete earlier.
- A completed event must no longer remain the active hero event once another upcoming event exists.
- If there is no upcoming or live event, the page must render a stable empty state rather than a stale matchup.
- The hero event uses the full public title, for example `UFC Fight Night: Hernandez vs Rodrigues`.
- The primary CTA is `View event`.
- The full-card section offers `Lock in your predictions`, which opens the reusable event prediction modal without forcing the user through every dedicated matchup page.

## Event page behavior

An event page presents:

- Full event title, description, venue, and prelim/main-card schedule.
- A countdown or live state derived from the event timestamps and explicit event status.
- The official card order divided into main card and prelims.
- `Main event` and `Co-main event` labels only; generic `Bout 1`, `Bout 2`, and similar labels are not shown publicly.
- A result badge next to the winner after an official result is entered, using clear wording such as `Won by KO/TKO, R2`.
- Event-wide live chat access.
- A `Lock in your predictions` CTA opening the full-card prediction modal.

The full-card prediction modal:

- Uses the full event title prominently.
- Lists every matchup in card order.
- Lets the member open and complete any subset of matchups; predicting every fight is optional.
- Shows permanently locked predictions as a compact pill, for example `Anthony Hernandez · Submission · R3`.
- Disables already completed picks and never offers editing.
- Shows open, locked, or unavailable state per matchup.
- Uses the same confirmation and immutable submission semantics as the dedicated matchup page.
- Uses a custom, accessible scrollbar and remains usable on mobile.

## Dedicated matchup page

### Matchup identity and navigation

The page shows both fighters, division, and scheduled rounds. It does not show a fake individual bout start time or an unnecessary scheduled badge.

- Desktop breadcrumbs include the full event title and the current matchup.
- Desktop and mobile offer a matchup selector containing the other bouts in the same event.
- Mobile uses a sticky matchup name row and the tabs `Predictions`, `Stats`, `Posts`, and `Live chat`.
- Mobile tabs render their own section rather than scrolling to hidden duplicate sections.

### Predictions tab

The Predictions tab contains:

1. The prediction form or the member's locked-prediction receipt.
2. Community consensus, subject to the reveal rule below.
3. On mobile, the `Earn up to 10 points for this match` explanation.

### Prediction input

A prediction contains exactly:

- Winner: one of the two fighters.
- Method: `KO / TKO`, `Submission`, or `Decision`.
- Finish detail:
  - For KO/TKO or submission: round number within the fight's scheduled rounds.
  - For decision: unanimous, split, or majority decision.

Rules:

- No method is preselected.
- There is no `Other` prediction method.
- There is no confidence slider or confidence data.
- Selected winner and selected method use the same restrained active-selection language: a lighter surface and strong border. Selection controls must not visually compete with primary submission buttons.
- The submit CTA reads `Lock in my pick` and is only as wide as needed on desktop and mobile.
- Before writing, a centered, keyboard-accessible modal summarizes winner, method, and detail.
- The modal makes permanence explicit. `Review my pick` returns to the form; `Confirm and lock` performs the write.

### Immutable prediction rule

Predictions are create-only and permanently immutable.

- The first confirmed submission creates version 1 with status `locked` and a server lock timestamp.
- A member can have at most one prediction for a matchup.
- An identical retry using the same request ID is idempotent and returns the existing prediction.
- Any later attempt for the same user and matchup returns `prediction_already_locked`.
- A still-open matchup allows other members to predict; it never unlocks an existing member's prediction.
- Reopening a matchup only permits members who have never predicted that matchup to submit. Existing picks stay immutable.
- A locked matchup prevents all new predictions.

After submission, the form is replaced with a read-only receipt containing winner, method, detail, and lock time. There is no edit or save-changes action.

## Consensus privacy and presentation

The community consensus for an upcoming/open fight is hidden until the current signed-in member has permanently locked a pick for that matchup.

- This is the authoritative `hide upcoming picks` rule.
- The rule is based on the existence of that member's prediction document, not a general preference toggle.
- Guests and members without a pick see an explanation prompting them to make their own prediction.
- Once the member has picked, the consensus is revealed.
- After the matchup is locked and public picks are materialized, public presentation can follow the server-defined reveal state.
- Emergency reopening suppresses public-pick visibility again until the matchup is relocked.

Consensus presentation:

- Shows total community predictions and the winner split.
- Provides a separate method distribution for each fighter.
- Provides a separate finish-round distribution for each fighter.
- The three prediction method groups are KO/TKO, submission, and decision.
- Round labels are compact and uncluttered, such as `R1 20% · R2 40% · R3 40%`.
- A fighter's method or round percentages must never be visually assigned to the opposing fighter.

## Scoring and grading

Current scoring version: **1**.

Maximum score per fight: **10 points**.

- Correct winner: 5 points.
- Correct method group: 3 additional points.
- Correct exact detail: 2 additional points.
- Wrong winner: 0 points for the entire fight.

Exact detail means:

- KO/TKO or submission: correct round.
- Decision: correct decision type (unanimous, split, or majority).

The public explanation reads:

> Earn up to 10 points for this match. 5 pts for the winner · 3 pts for the method · 2 pts for the exact detail. Getting the winner wrong scores 0 for the fight.

Only an official result with a winner is scoreable. Draws, no contests, overturned results, and other non-winner outcomes are voided according to the grading rules. Result corrections create a new result version and trigger a regrade rather than mutating score history silently.

## Result presentation

When an administrator submits a fight result:

- The public event card identifies the winning fighter.
- A concise result badge communicates method and round when applicable.
- The dedicated matchup page shows the result adjacent to the winning fighter.
- Prediction receipts and profile history receive their grade once the background grading run completes.
- Event and season boards are updated by the grading process.

### Event leaderboard participation

- Every member who made at least one prediction for an event appears on that
  event's points board; event boards have no minimum graded-pick requirement.
- A participant whose only prediction was voided remains listed with zero graded
  picks and zero points.
- `/leaderboards` defaults to the most recent event explicitly marked
  `completed` by an administrator.
- **By event** lets members browse every completed event board. Scheduled or live
  events never replace the default completed-event standings.
- Season accuracy currently ranks every member with at least one graded pick.
  A participation floor may be introduced later when the community is larger.

## Persistent matchup posts

Posts are a durable discussion product and are **not** copied from live chat.

- Each matchup has its own persistent posts section.
- Root posts and replies have a clear visual hierarchy inspired by professional threaded comment systems.
- Replies appear under their root post with connector lines and expandable/collapsible reply groups.
- Sorting supports newest and oldest.
- Members can reply, report, and block where permitted.
- Guests can read posts.
- Creating a post or reply requires a signed-in, verified member with a public handle.
- The sign-in/create-account flow opens in an accessible modal on the same matchup page and returns the member to the same discussion context.
- Google sign-in creates a Firebase Auth account when one does not exist, then sends the new member through handle onboarding.
- Mobile exposes posts as its own `Posts` tab.
- After the full composer scrolls away on mobile, a compact sticky composer affordance appears beneath the tab row and expands on interaction instead of permanently consuming vertical space.

### Prediction transparency badges

A post or live-chat message can show the author's locked prediction for that same matchup.

- Format: fighter last name plus method, for example `Hernandez by Submission`.
- Finish detail and round are deliberately omitted.
- The badge is derived from a locked/graded/void public prediction representation; users cannot type or edit it.
- A post and a live-chat message remain separate records even when both show the same prediction badge.

## Live chat

FightLobby has event-wide and matchup-specific realtime chat rooms.

- Chat uses Firebase Realtime Database for low-latency message delivery.
- Firestore stores durable room metadata, moderation, lifecycle, and audit records.
- Guests can read an open room.
- Posting requires a signed-in, email-verified member with a public handle and an active, non-sanctioned account.
- Messages are limited to 240 characters.
- The UI keeps the latest message in view unless the member intentionally scrolls to older messages.
- No `Message sent` success banner is shown after each live message.
- Replies, reporting, and blocking are supported.
- Slow mode, rate limiting, App Check, request idempotency, and server authorization protect writes.
- The client loads a bounded latest window and streams child changes; it never downloads the entire room on every update.
- Event completion sets a six-hour post-event chat window.
- After the writable window closes, historical chat is read-only.
- Chat messages are purged after the configured 30-day retention period.

## Accounts, handles, and profiles

### Authentication

Members can use Google or email/password authentication. Browser authentication is exchanged for a server session cookie before protected application operations.

### Public handle onboarding

- Handles are 3–20 characters.
- Allowed characters are letters, numbers, and underscore.
- Handles are unique case-insensitively.
- Availability is checked after a short input debounce and again transactionally when claimed.
- The availability UI distinguishes live requirements (`3–20 characters` and `Unique`) from informational text (`Letters, numbers, underscore` and `One change per 30 days`).
- A handle cannot be claimed until validation, availability, and terms acceptance succeed.

### Public profile

`/u/[handle]` is the public member record. It contains eligible prediction history, accuracy/points data, achievements, and follow relationships without exposing private email or account data.

- Public prediction history shows only picks materialized after a matchup locks;
  an open pick is never disclosed early.
- Prediction history defaults to all participated events, offers a newest-first
  event selector, and recomputes points, graded picks, and winner accuracy for
  the selected scope.
- Desktop presents fight, event, pick, result, and points as a table. Mobile
  presents the same record as readable cards without horizontal scrolling.
- The private Settings workspace has a dedicated `Predictions` section that
  also includes the member's current submitted picks. The Public profile panel
  contains the single action for opening the public record.
- Members may follow other FightLobby members.
- Following events and fighters is intentionally not part of the launch product.
- Notification preferences and notification delivery are intentionally not part of the launch product.

### Account deletion

Account deletion is a real deletion workflow, not an indefinite soft-delete request. It removes the Firebase Auth user and eligible private Firestore, Storage, and RTDB user data. Records that must be retained for security or operational integrity are anonymized rather than left linked to the deleted identity.

## Admin product

The owner/admin uses `/admin`; authorization is enforced on the server and never inferred from a visible UI element.

Core areas include:

- Overview and event operations.
- Events and matchups.
- Fighters and identity review.
- JSON import and data sync.
- Moderation, flags, audit, and leaderboards/boards.

### Event operations

For each current/upcoming event, the admin sees matchup totals and open/locked counts. The event manager provides one operational row per fight.

Each row supports:

- `Details` for uncommon result wording, official clock time, correction, or emergency reopen.
- `Lock matchup` to stop new predictions at walkouts.
- A quick result dropdown containing common scoreable and void outcomes.
- `Submit result`, disabled until a result is selected.

There is no bulk or event-wide prediction lock. Matchups are locked individually as the event progresses.

### Matchup locking

- A confirmation modal explains that new predictions stop immediately.
- Existing user predictions remain immutable.
- Locking materializes public picks and records an audit entry.
- Emergency reopening requires a reason and typed confirmation from the detail page.
- Reopening never makes existing predictions editable; only users without a pick may submit.

### Results and grading

- Submitting a result marks that fight completed, increments its result version, and queues its grading job.
- The result operation is audited.
- Quick results cover ordinary winner/method/detail combinations.
- The detailed result editor supports official time-in-round, uncommon method wording, corrections, and void outcomes.
- Correcting a result creates a new version and regrades all affected predictions.

### Event completion

`Mark event complete` ends the event lifecycle and starts the six-hour post-event chat window. It does **not** invent results or grade unresolved fights. Each fight must receive its own official result to be graded.

The admin may mark an event complete even when unresolved fights remain, but the UI must warn about those fights.

## Accessibility and UX standards

- Modals use a portal/fixed viewport layer, remain centered on desktop and mobile, trap focus, restore focus on close, support Escape, and expose appropriate dialog labels.
- Sticky mobile headers and tabs must not hide the active content.
- Buttons have clear enabled, disabled, loading, success, and error states.
- A disabled action must explain the missing requirement.
- Destructive or irreversible actions require explicit confirmation.
- Public pages render stable loading, empty, and error states rather than blank screens.
- Text and controls meet reasonable contrast and touch-target requirements.
- Realtime experiences use bounded lists and intentional scroll behavior.

## Intentionally excluded or deferred

- Confidence percentages in predictions.
- `Other` as a member prediction method.
- Editing or replacing a locked prediction.
- Event-wide/bulk prediction locking.
- Automatic licensed-provider ingestion as a launch requirement.
- Fighter or event following.
- Notification preferences and reminder delivery.
- Fighter photo/avatar ingestion until image rights are settled.
- A promise that ad revenue will automatically cover infrastructure costs.

## Implementation anchors

When validating this specification, start with:

- `packages/domain/src/types/domain.ts`
- `packages/domain/src/scoring/prediction.ts`
- `apps/web/lib/predictions/firestore.ts`
- `packages/firebase-ops/src/prediction-control.ts`
- `apps/web/lib/admin/actions.ts`
- `apps/functions/src/grading/grade-fight-predictions.ts`
- `apps/web/components/fights/` and `apps/web/app/fights/[fightSlug]/`
- `apps/web/components/events/` and `apps/web/app/events/`
- `apps/web/components/admin/`, `apps/web/lib/admin/`, and `apps/web/app/admin/`
- `docs/predictions.md`
- `docs/grading-and-leaderboards.md`
- `docs/live-chat.md`
