# V1 operations handoff

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

Use existing database aggregates for new verified accounts, new published ads
by vertical, active inventory, phone/WhatsApp contact events, open reports and
service-request states. Alert statistics mean provider acceptance, not inbox
delivery. Raw listing view counters include repeated renders/crawlers and must
not be labelled unique human visitors or used for conversion rates.

No external tracking provider or new analytics identifiers are introduced.
Defining a unique-visitor policy and any external analytics/consent setup is a
separate owner decision; advanced analytics remains outside signed V1.

Reference: [Next.js 15 instrumentation](https://nextjs.org/docs/15/app/api-reference/file-conventions/instrumentation).
