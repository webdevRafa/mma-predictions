# FightLobby cost guardrails

Use `/admin/costs` before, during, and after every UFC card. The page shows
logical application counters; provider consoles remain the source of truth for
billable reads, writes, executions, storage, egress, and hosting usage.

## One-time owner setup

1. In Google Cloud Billing, create actual-cost notifications at **$10, $25, $50,
   and $100**. Send every threshold to the primary and backup operator.
2. In Vercel Spend Management, enable usage notifications and select an
   account-appropriate hard limit or pause action. Budget alerts without an
   enforcement action do not protect against an unexpectedly large invoice.
3. In Firebase, keep App Check registered for the production web app. Review App
   Check rejection rates before enabling enforcement for an additional product.
4. Configure Cloud Monitoring alerts for Functions errors and latency. Review
   Firestore document operations, Realtime Database downloads/connections,
   Storage growth, and App Check metrics after each event.

## Event-day review

- Before prelims: confirm `/admin/costs` reports App Check as configured and the
  prediction aggregate queue is empty or draining.
- During the card: compare logical chat/pick growth with Firebase usage. Use the
  existing audited feature flags if abuse or a cost spike requires temporary
  read-only operation.
- After the final bout: mark the event complete. Chat remains writable for six
  hours, becomes read-only at the server timestamp, and its public RTDB history
  is removed 30 days later.
- The next day: verify aggregate jobs drained, Functions have no retry storm,
  and provider usage matches the event's observed participation.

## Implemented efficiency controls

- Realtime chat consumes incremental child events; it does not redownload the
  full message window for every new message.
- Per-user presence writes and full presence-tree reads are disabled.
- Discussion pages initially load three reply previews and fetch the complete
  thread only when a visitor expands it.
- Prediction submissions update one shard and queue a coalesced background
  aggregate instead of reading every shard in the request.
- Grading rebuilds event and season boards once after a grading batch.
- Safe public event, fight, and fighter reads use short shared caches; account
  and admin surfaces remain dynamic.
