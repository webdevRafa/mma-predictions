# Live chat and moderation

FightLobby fight rooms use Firebase Realtime Database for public messages and
presence. Firestore stores room lifecycle metadata, reports, sanctions, moderation
decisions, and audit records.

## Security boundary

Browsers may read the published message path and write only their own presence
record. They cannot create, edit, remove, or moderate messages directly. Publication,
reports, blocks, and moderation actions pass through authenticated, same-origin,
App Check-aware server endpoints or privileged Cloud Functions.

Posting requires a verified email, completed handle, active account, open room, and
enabled chat feature flags. The server normalizes Unicode, limits messages to 240
characters, blocks links and repeated spam, masks a small set of mild profanity, and
rejects high-risk phrases. React renders the resulting plain text; chat does not allow
HTML, media, files, or message editing.

## Rate limits and idempotency

Realtime Database transactions enforce the room slow-mode value plus these member
floors:

- New account: 15 seconds
- Normal member: 7 seconds
- Trusted member, moderator, or administrator: 3 seconds
- Maximum burst: 3 messages in 30 seconds
- Duplicate normalized body: blocked for 60 seconds

The server derives a deterministic message ID from the room, member, and client UUID.
Retrying the same client nonce returns the original message without increasing the
room count.

## Reader experience

Chat code and realtime listeners load only after a visitor opens the lobby. The
listener starts with the latest 50 messages and consumes incremental child add,
change, and removal events; readers can paginate upward 25 at a time. Incoming
messages do not force scroll when the reader has moved upward. The UI deliberately
shows a low-cost “Live room” state instead of maintaining one database presence write
and a full presence-tree subscription per visitor. Members hidden by the reader are
filtered locally and can be unblocked in Settings.

## Moderation and room lifecycle

Reports keep an immutable message snapshot in the private moderation queue and are
deduplicated per reporter and message. Moderator removals replace the public body and
preserve the original in a private action record. Mutes, suspensions, and bans are
audited; scheduled cleanup reconciles expired temporary sanctions.

Fight rooms open at their configured `opensAt` time and become read-only at
`writableUntil`. Imported rooms receive a conservative initial window. When an
administrator marks the event complete, every event and matchup room receives an
exact `writableUntil` six hours later. The message API checks this timestamp on every
write, the client closes its composer at the boundary, and an hourly lifecycle job
reconciles the stored room status. Administrators can also place a room in slow mode,
read-only, or closed state immediately.

Public messages remain available for 30 days after the room becomes read-only. A
daily retention job then removes the room's Realtime Database message history and
records `messagesPurgedAt` on its Firestore room document. Private moderation
evidence follows the separate account, abuse-prevention, and legal retention policy.
