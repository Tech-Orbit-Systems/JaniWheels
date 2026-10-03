# Saved-search alert operations

Apply migration 0014 before deploying. Run the authenticated
`saved-search-alerts` job to queue matches and `deliver-search-alerts` to send
them. The second job uses the existing Resend credentials and verified sender.
With missing credentials it reports `configured: false` and leaves the outbox
untouched. These jobs are not publicly accessible.

## Matching and delivery

- Matching shares marketplace predicates, scans 100 due searches and queues
  at most 100 unseen matches per search. Overflow remains due for the next run;
  the first result page no longer loses later matches. Daily searches wait
  23 hours after a complete scan; instant searches are checked each invocation.
- Unique search/listing pairs prevent duplicate queue entries. A search is
  locked during matching. Invalid saved states are counted as failures and
  rotated so they cannot permanently block other searches.
- Only verified, unbanned users with an email and enabled alerts are eligible.
  Delivery rechecks those conditions, the queued email and active listing
  status. Changes suppress queued rows. Disabling alerts cannot recall a
  provider request already in flight.
- Each delivery invocation claims at most 25 rows with locked, committed
  attempts and a one-minute lease. The immutable email body and provider
  idempotency key survive process crashes. Provider requests time out at ten
  seconds; retries back off to a maximum one hour.
- Attempts older than 23 hours require operator reconciliation and are
  suppressed automatically. Do not blindly resend: Resend retains idempotency
  keys for only 24 hours. `delivered` records provider acceptance, not inbox
  receipt; bounce/webhook and deliverability acceptance remain live gates.
- Do not delete delivered/suppressed deduplication rows until the retention
  policy defines how to preserve notification history.

## Launch checklist

Schedule queue then delivery frequently enough to drain normal volume; alert on
failed searches, delivery failures, suppressed retry windows and oldest pending
row age. Confirm opt-out through the saved-search dashboard, delivery to a
controlled verified mailbox, provider outage/retry, sender-domain verification
and expected daily volume. First scans can queue existing matching inventory;
review backlog before enabling production delivery.

No real emails are sent by the DB acceptance test. It injects a mock sender and
checks overflow, deduplication, concurrency, retry payload stability, opt-out,
ban/email changes and stale retry suppression.

Reference: [Resend idempotency window](https://resend.com/changelog/idempotency-keys).
