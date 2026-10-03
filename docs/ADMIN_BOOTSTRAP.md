# First administrator provisioning

Use this operator-only command on the intended deployment host after migrations
and normal account registration/email verification. It does not create an
account, set a password or use seed credentials. Keep database credentials in
the deployment environment; never paste the connection string into the command.

1. Confirm the intended database host/name in the deployment control panel.
2. Have the designated owner register normally and verify their email.
3. Preview the existing account, substituting its real email and database name:

   ```bash
   npm run admin:bootstrap -- --email owner@example.com --database janiwheels
   ```

4. Check the returned database name and user ID against the intended account.
   Then repeat with `--apply` to grant the first administrator role:

   ```bash
   npm run admin:bootstrap -- --email owner@example.com --database janiwheels --apply
   ```

5. Sign in again and verify administrator access. Existing sessions for the
   promoted account are revoked. Check the `admin_bootstrap` event in
   `moderation_log`; retain the operator identity, change-ticket reference and
   command outcome in the deployment record. The database event has no browser
   moderator because this action is performed by an operator.

The default is a dry run. The explicit database-name argument must match
`DATABASE_URL`. Banned, unverified, missing or ambiguous accounts are rejected.
If another administrator exists, bootstrap refuses to add a second. Repeating
the command for the existing administrator is an idempotent no-op. Role grant,
audit record and session revocation are one transaction; concurrent first-admin
attempts are serialized.

This is an initial-provisioning tool, not an ongoing administrator-management or
account-recovery tool. Production execution and access review remain launch
tasks; automated tests run only against isolated test tables/databases.
