# V1 operations handoff

## Approved retention rollout

Decision A is approved; use `RETENTION_DECISIONS.md` for exact windows and commands.
Apply migrations, run a read-only preview, review holds, then configure authenticated
`retention-cleanup` scheduling with an exact database-name guard. Schedule media
queue draining and independent restricted ledger exports. Configure actual rolling
30-day backup expiry, provider deletion and the restore-maintenance/replay drill.
Keep cleanup disabled until deployment configuration is checked. Never enable a
restored public application before applying the current deletion ledger and holds.

`POST /api/cron/retention-media` provides bounded media draining under the same
bearer authentication, retention-enabled and exact-database guard as cleanup.
Failed deletions remain queued. Inspect retry counts before increasing scheduling
frequency; do not treat a completed worker invocation as live-provider acceptance.

## Health and errors

Monitor `GET /api/health` from the selected external monitor. It returns 200
with `ready` only when the application can query PostgreSQL; failures return
503 with `unavailable`, never connection details. It is uncached and noindexed.
This does not verify image storage, email delivery, OAuth or Maps.

Next's request-error hook emits a JSON event with a timestamp, method, route
template and error category. It omits request bodies, query strings, cookies
and error messages. Configure the host's log collection, access controls,
retention and alert routing; also review framework/provider logs, which are
separate from these structured events. Do not expose logs publicly.

## Scheduler and backups

Configure the existing authenticated expiry, cleanup, alert queue and alert
delivery endpoints in the chosen hosting scheduler. Keep the bearer secret
server-side. Record success/failure counts, duration and last successful run;
alert if a job stops running or delivery backlog grows. Review the alert
runbook before enabling outbound mail.

Before production customer data exists, configure encrypted database backups
and a restore drill into a separate environment. Record the actual provider,
backup interval/retention, recovery point/time objectives, access list and drill
results. Back up durable media references and verify provider restoration
semantics. These settings depend on the selected host and retention decisions;
local development checks are not backup or uptime sign-off.

## Basic V1 measurement

Run `npm run ops:report -- --database EXACT_DATABASE_NAME` for a read-only
aggregate JSON snapshot of inventory, activity, services/reports, email backlog,
overdue evidence holds and media retries. It excludes personal customer payloads.
Record a production reporting cadence and alert recipients after hosting selection.

Use existing database aggregates for new verified accounts, new published ads
by vertical, active inventory, phone/WhatsApp contact events, open reports and
service-request states. Alert statistics mean provider acceptance, not inbox
delivery. Raw listing view counters include repeated renders/crawlers and must
not be labelled unique human visitors or used for conversion rates.

No external tracking provider or new analytics identifiers are introduced.
Defining a unique-visitor policy and any external analytics/consent setup is a
separate owner decision; advanced analytics remains outside signed V1.

Reference: [Next.js 15 instrumentation](https://nextjs.org/docs/15/app/api-reference/file-conventions/instrumentation).
