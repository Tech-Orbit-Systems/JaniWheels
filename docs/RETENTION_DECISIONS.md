# Retention and deletion launch decisions

`npm run retention:inventory` produces counts and oldest dates only, in a
read-only database transaction. It never exports customer records or deletes
anything. Run after migrations and retain the aggregate report with the launch
record.

Existing automated cleanup covers expired sessions, used/expired verification
and reset tokens, old rate-limit buckets and abandoned uploads. Production
scheduling and backup recovery still need configuration.

The following decisions are required before implementing destructive lifecycle
cleanup. No durations or consent decisions have been invented for the owner.

| Records | Decision needed | Technical consequence |
|---|---|---|
| Accounts and identity images | Closure grace period, outstanding complaints, minimum records to retain | Revoke sessions/OAuth/tokens, remove public inventory and identity photos; choose anonymization versus deletion |
| Reports and moderation audit | Dispute retention and legal holds | Preserve necessary evidence and audit references; redact fields rather than break history |
| Inspection/assistance requests and event history | Retention after completion/cancellation | Address/phone, customer messages and staff notes need a consistent policy |
| Analytics and delivered/suppressed alerts | Measurement window and purpose | Aggregate where appropriate; avoid recreating already-notified listing/search pairs |
| Backups and third-party copies | Backup expiry, restore procedure and provider deletion obligations | Restored backups must replay deletion records before public service resumes |

After those decisions are recorded, implement a preview-first bounded cleanup
with an explicit target database, cutoff, legal-hold exclusions, operator audit,
storage deletion retry and rollback/recovery acceptance. A request handler must
not delete evidence before checking these conditions. Provider configuration,
policy approval and real-device/production acceptance remain launch gates.
