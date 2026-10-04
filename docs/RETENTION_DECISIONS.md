# Retention and deletion launch decisions

Client approved decision A exactly through the owner on 4 October 2026. This
supersedes the pending notice. B1 remains approved separately: no ordinary seller
verification badge in V1. No inactivity-based account deletion is authorized.

`npm run retention:inventory` produces counts and oldest dates only, in a
read-only database transaction. It never exports customer records or deletes
anything. Run after migrations and retain the aggregate report with the launch
record.

Existing automated cleanup covers expired sessions, used/expired verification
and reset tokens, old rate-limit buckets and abandoned uploads. Production
scheduling and backup recovery still need configuration.

The approved policy is:

| Records | Approved retention | Implementation |
|---|---|---|
| Account closure | Immediate public hide/session revocation/alert stop; 30-day recovery | Recovery-only authenticated sessions; after grace remove personal/linked data except necessary held evidence |
| Sold/expired/deleted ads | 12 calendar months after becoming inactive | Redact personal content and queue images for deletion; account closure or approved early deletion can shorten retention |
| Inspection/assistance | 12 calendar months after completion/cancellation | Remove address/phone, personal notes and messages; account closure can shorten retention |
| Resolved reports/moderation | 24 calendar months after resolution | Remove expired evidence, preserve open cases and explicit holds |
| Detailed contact activity | 90 days | Aggregate anonymously by month/type, remove detailed records |
| Terminal alert recipient/body | 90 days after delivery/suppression | Remove PII, keep minimal search/listing deduplication until search deletion |
| Backups | Rolling 30 days | Configure actual provider expiry and replay latest deletion ledger before reopening restored service |
| Complaint/legal holds | Necessary evidence only; review every 90 days | Document reason/responsible person; overdue review never automatically releases evidence |

## Account recovery and holds

Close accounts in account settings with explicit confirmation. Sign-in during
the 30-day window grants recovery-only access. Restoring preserves moderator
changes and expiry; suppressed queued alerts are not resent. Administrators need
an access handover through support before closure so operations retain an admin.

Manage record-specific holds at `/admin/retention`. An account hold preserves
necessary identity; unrelated ads and services still reach their own cutoffs.
Open listing reports also protect listing evidence and related identity. Holds
cannot recover already-deleted data. Records missing a reliable resolution date
remain retained for operator review rather than guessing a destructive cutoff.

## Operator commands

Supply DATABASE_URL securely in the environment. Every command requires the exact
target database name and an operator. The default is preview; output is counts.

```bash
npm run retention -- preview --database janiwheels --operator deployment-owner
npm run retention -- apply --database janiwheels --operator deployment-owner --limit 25
npm run retention -- media --database janiwheels --operator deployment-owner --limit 25
```

Optional `--cutoff ISO_DATE` cannot be in the future. Default batch size is 25
per category; maximum 100. Database redaction, receipts and media queue commit
together. Storage deletion runs afterward, retries failure and refuses to delete
referenced media. Review overdue holds and failed removals.

Enable authenticated `retention-cleanup` cron only after migrations and preview:
`RETENTION_ENABLED=true`, with `RETENTION_DATABASE_NAME` matching the database.
Schedule the media CLI separately. Live scheduler/provider configuration remains
a deployment gate; local acceptance does not delete production customer data.

## Backup restore

### Approved early deletion

After verifying a customer's request, an operator can override the ordinary
12-month listing/service retention period. Preview first, then apply the same
record and approved reason; active complaint/report/moderation holds block it:

```bash
npm run retention -- early-preview --database janiwheels --operator privacy-owner --resource listing --id 123 --reason "Approved customer request"
npm run retention -- early-apply --database janiwheels --operator privacy-owner --resource listing --id 123 --reason "Approved customer request"
```

Resources are `listing`, `inspection` and `assistance`. The operator is responsible
for verifying the request; this restricted database tool is not a public endpoint.
Account closure retains its approved 30-day recovery period. Drain queued media
and export the new restore ledger after applying an early deletion.

Configure the actual provider for 30-day rolling backup expiry. The environment
setting `BACKUP_RETENTION_DAYS=30` alone does not configure backups.

Continuously export the latest ledger into restricted durable storage independent
of database backups, especially after account closure or cleanup:

```bash
npm run retention -- export-ledger --database janiwheels --operator deployment-owner --file /secure/retention/ledger-new.json
```

The export refuses to overwrite files. Opaque IDs/actions, timestamps and database
instance identity support replay without exporting customer contact/message
payloads. Protect ledgers and expire obsolete copies with the backup window;
the latest ledger must survive a database incident independently.

Before restoring, set `RESTORE_REPLAY_REQUIRED=true`: middleware responds with
uncached 503 to keep the application offline. Restore/migrate, then run:

```bash
npm run retention -- replay --database janiwheels --operator restore-owner --file /secure/retention/latest.json
npm run retention -- media --database janiwheels --operator restore-owner
```

Replay is atomic and idempotent, rejects a different database instance/invalid
actions and preserves receipts for subsequent exports. It also advances restored
record sequences beyond ledger IDs so deleted identities cannot be reused for
new accounts or ads. Keep background writers stopped during the restore drill.
Restore current hold
records from the restricted operations record before cleanup resumes. Verify
closed/redacted records, drain failed media removals, export a new ledger and
record the drill before clearing maintenance. Without a current authentic ledger,
keep service offline.

Check Cloudflare/email-provider copies using actual configured deletion/retention
controls. Live provider confirmation, 30-day backup configuration and external
restore drills require hosting/provider access and remain deployment gates.
