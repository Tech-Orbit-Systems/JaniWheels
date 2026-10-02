# CI and acceptance

Every pull request and main push runs `.github/workflows/quality.yml`. The job
creates an isolated PostgreSQL service, applies migrations, seeds curated data
and demo inventory, runs database assertions, checks, lint, a production build,
the route sweep, desktop/mobile Chromium tests, iPhone WebKit smoke tests, and a production dependency
audit. A failing step fails the
required check; repository branch protection must mark **Quality and
acceptance / acceptance** as required before a failure can block merging.

Run the same checks locally with a working local PostgreSQL server:

```bash
npm run test:acceptance:prepare
npx playwright install chromium webkit
npm run test:acceptance
```

The prepare command creates `janiwheels_acceptance_test` only if absent. The
acceptance runner uses this database, never the normal development database.
Demo seeding replaces demo sellers' listings within that isolated database.
It starts the production build on port 3101, runs the sweep and browser tests,
then stops its server. `--browser-only` skips migrations, reseeding and build
when only the browser tests need another run.

CI is an ephemeral staging environment. A persistent online preview, durable
staging media storage, external uptime monitor, and branch protection still
need hosting and repository configuration before Stage 6.2 can be signed off.
