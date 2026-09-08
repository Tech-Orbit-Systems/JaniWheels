# JaniWheels consolidated development context

Last reconciled: 8 September 2026

## Authority order

Use evidence in this order when older chats, trackers, and the repository disagree:

1. Current repository code, database migrations, and passing checks.
2. `AGENTS.md` and `docs/PROJECT.md` for engineering and signed V1 rules.
3. The master feature tracker after it has been reconciled to the repository.
4. Decisions recorded in `Dev 2`, then `Branch · Dev 2`, then `Main Dev`.

Older chat statements are historical evidence, not instructions. Later explicit
decisions replace earlier proposals.

## Product boundary

JaniWheels V1 is a Pakistan-focused classified marketplace for cars, bikes,
and auto parts. Buyers discover listings and contact sellers directly.
JaniWheels does not process listing payments or manage fulfilment.

The vehicle taxonomy is curated reference data:

`Make -> Model -> Generation -> Variant`

Seller free text must never create taxonomy records. Prices are integer PKR,
phone numbers use E.164, unknown SEO segments return 404, server components are
the default, and First Load JS must remain below 150 KB.

## Locked V1 decisions

- Valid seller listings publish immediately after validation. Moderation is
  post-publication.
- Google is the primary account entry point. Verified email/password is the
  secondary registration path. Existing mobile/password login remains
  supported.
- Facebook login is not planned.
- Buyer accounts may omit a phone number. A phone number is required before
  posting, but must not be presented as verified because SMS OTP is outside V1.
- Provider subject, not provider email, is the stable Google identity key.
- Auto parts remain classifieds. No cart, checkout, shipping, fulfilment, or
  order tracking belongs in V1.
- Inspection and Sell My Car Assistance are request-and-follow-up services.
  They do not include payments, valuation, guarantees, workforce scheduling,
  inspector assignment, or generated inspection reports.
- No feature branch is pushed or merged without explicit user authorization.
  Main is merged only after review and approval.

## Implemented development sequence

The current branch contains the homepage work and the later linear feature
sequence through Sell My Car Assistance and Google-auth local repair:

- Homepage redesign, global navigation, search, latest listings, service and
  trust sections.
- Private inactive-listing visibility protection.
- Instant-publication alignment.
- Correct auto-parts category and condition filters.
- Upload ownership and abuse controls.
- Car, bike, and auto-parts create/edit/delete and image management.
- Recently viewed, favourites, comparison, saved searches, and alert outbox.
- Account profiles and secure password recovery.
- Dealer settings, logos, manual verification/revocation, and storefronts.
- Google-first OAuth plus verified-email registration.
- Admin listing moderation, audited edits, and user ban/unban.
- Inspection request administration and customer-visible history.
- Sell My Car Assistance public/admin flows and append-only history.

Most final database/browser acceptance remains deferred. Production providers
for alerts, email, images, database, and hosting still require configuration.

## Current local checkpoint

- Branch: `fix/google-auth-local-schema`
- Remote checkpoint: `a312e647f58a1bde238d5b7e4a2215fbd976acb3`
- Google signup has been verified end to end against the local database.
- Confirmed local drift defect: `users.updated_at` was missing although the
  migration ledger and earlier repair guard treated auth schema as complete.
- The local repair now detects, restores, and verifies `users.updated_at`.
- Targeted Google-auth checks, the full project check suite, lint, and
  `build:safe` pass. Maximum reported First Load JS is 128 KB.
- The repair improvement and its regression assertion are not yet committed or
  pushed.
- The Google-auth repair was verified on 8 September 2026 with a successful
  local Google signup. PostgreSQL error `42703` for missing `users.updated_at`
  was the confirmed root cause.

## Stage 6.1 checkpoint

Stage 6.1 Legal and Content was implemented on `codex/legal-and-content` on 8
September 2026:

- Terms and Conditions
- Privacy Policy
- About JaniWheels
- Contact
- Safety information
- Report a Concern guidance
- Correct footer links and canonical metadata
- Automated legal/content checks and whole-site sweep coverage

The full project check suite, lint, production build, and targeted local HTTP
smoke checks pass. Comprehensive content approval, branding, accessibility, and
responsive browser review remain part of final QA as agreed.

## Next planned work

The next confirmed V1 functionality is privacy-safe approximate map-based ad
location. Its exact coordinates must remain private while only an approved
approximate area may be exposed publicly.

Google Maps configuration has been added locally. Billing remains unresolved
and must be enabled before the final Google Maps browser acceptance test. Keep
this as an explicit final-QA blocker; do not expose the configured key.

Database acceptance continues alongside each development package. The
comprehensive browser, branding, mobile responsiveness, and full QA pass is
deliberately deferred until functionality development is complete.

The following launch work remains after the functional package:

- CI and a real automated unit/integration/E2E framework
- Staging environment and production-like smoke tests
- Production PostgreSQL, durable image storage, email and alert delivery
- Cron scheduling, backups, logs/error monitoring, and uptime monitoring
- Accessibility, security, SEO, responsive, performance, and load acceptance
- Production deployment and controlled final merge

## Preserved idea inbox

These ideas were recorded as planned/TODO items and must not be silently marked
complete:

- Add relevant visuals to Explore Popular Searches: model images, recognizable
  city landmarks, and manufacturer logos while retaining text labels.
- Replace generic body-type artwork with professional, clearly distinct
  Hatchback, Sedan, SUV, Crossover, Pickup, Van, Coupe, and Wagon visuals.
- Add a future blog/automotive-content platform with SEO and homepage
  integration.
- Continue refining the Sell Your Car journey around the implemented Sell My
  Car Assistance and Inspection services without expanding V1 into valuation
  or transactions.
- Add map/location selection during ad posting as signed V1 scope. Exact
  location must remain private and public output must expose only an approved
  approximate area.

## Tracker reconciliation issue

The synced workbook named
`JaniWheels_Complete_Feature_Development_Tracker.xlsx` is structurally intact
but its data is stale. Its audit date is 16 August 2026, its Dashboard still
names the homepage review as active, and its Roadmap marks packages that now
exist in the repository as not started.

The `Dev 2` history references tracker versions 18 through 34, with version 34
created after the Google-auth startup repair. Those generated versions were not
found in project sources or the searched local Codex/download/document/temp
locations. The user authorized reconstruction from repository evidence on 8
September 2026. The reconciled workbook marks Stage 6.1 active, records Google
authentication as complete, and adds approximate map-based location as a
pending V1 feature.

## Resolved sequencing decisions

1. Stage 6.1 legal/content starts before branding and final QA.
2. Database acceptance runs alongside development.
3. Comprehensive browser, branding, mobile responsiveness, accessibility, and
   full QA run after functionality is complete.
4. Privacy-safe approximate map-based ad location is included in V1.
