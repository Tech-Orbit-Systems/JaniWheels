# JaniWheels V1 regression checklist

Use this checklist for each release candidate. The [master tracker](./JaniWheels_Complete_Feature_Development_Tracker.xlsx) Test Matrix owns case status; this document gives the repeatable steps and evidence needed to sign it off. A local pass does not replace staging, provider, or real-device acceptance.

## Record the run

| Field | Value |
| --- | --- |
| Branch and commit SHA | |
| PR and CI run | |
| Date, tester, environment | |
| Database seed/migration version | |
| Browser, OS, screen size | |
| Image/email/OAuth providers | |
| Defect links and retest SHA | |

Mark each row **Pass**, **Fail**, **Blocked**, or **Not run**. Attach a short observation and a screenshot, trace, log excerpt, or database assertion where useful. Record expected and actual behavior for failures. Use test accounts and synthetic listings; do not copy production customer data, credentials, session tokens, or private request notes into evidence.

## Automated gate

Run from the candidate commit with a disposable seeded database:

```bash
npm run check
npm run lint
npm run build:safe
npm run test:acceptance
```

`test:acceptance` performs fresh migration/seed, database assertions, build, route sweep, desktop/mobile Chromium browser tests, and an iPhone WebKit smoke test. The WebKit smoke uses a test-only session-cookie injection for local HTTP; real Safari cookie behavior requires HTTPS staging. It requires the isolated acceptance database described in the project scripts. If routes or interactive behavior changed, also run `npm run sweep` against the actual staging application with seeded data. Record the command results, failing case names, URL count, browser pass/skip count, and maximum First Load JS. Do not convert a planned skip into a pass.

## Manual module checks

| Module and Test Matrix cases | Steps to perform on the candidate deployment | Pass evidence |
| --- | --- | --- |
| Account and authentication (T-001–T-005, T-055) | Register with verified email; reject malformed/duplicate account; sign in/out; try banned and unverified accounts; use reset link once, then retry it; start and complete configured Google sign-in. | Only eligible users gain sessions; expired/reused links fail; other sessions close after reset. |
| Profile and seller identity (JW-050–JW-054) | Edit name/contact, change password, upload a profile photo, replace it, remove it, then visit the public seller page. | Only the owner can change details; image changes appear and old media is unavailable. |
| Car, bike, parts publishing (T-007–T-013) | Create each vertical with valid photos; repeat with empty/invalid required fields; edit title, location, price and applicable taxonomy; mark sold; delete one listing. Include an electric bike and part compatibility case. | Correct active detail/search result and facets; useful field errors; no orphaned rows or publicly visible deleted ad. |
| Ownership, uploads and media (T-006, T-016–T-018) | Try another seller's edit/detail/media reference and attach another user's upload key; upload a valid image and reject an oversized/spoofed file; replace and remove listing photos. | No cross-user write/read or media attachment; rejected bytes are not stored; remaining gallery order and cover image are correct. |
| Search, detail and SEO (T-019–T-025, T-044–T-046) | Search all three verticals with multiple filters, sorting and pagination; open detail pages; try unknown/reordered facet URLs; inspect canonical, robots, sitemap and JSON-LD on public staging. | Correct result set and stable pages; unknown route 404; expected canonical/indexation; visible facts match structured data. |
| Buyer tools and contact (T-025–T-030) | Reveal phone on an active ad, try unavailable ad, save/unsave, compare 2–3 compatible vehicles, view recent history and manage a saved search. Exercise configured alert delivery only when its provider exists. | One lead event per intended action; private buyer state is isolated; stale listings disappear from buyer tools; alert matches saved filters. |
| Dealer (T-031–T-033) | Register, edit identity and logo, inspect storefront and active counts, approve/revoke verification as admin, then inspect all badge locations. | Unique profile/slug, correct counts, badge only when verified, append-only admin decision history. |
| Inspection and Sell My Car Assistance (T-034–T-036) | Submit standalone and listing-linked requests, reject a forged listing ID, change status as admin, enter public and private follow-ups, then check customer dashboard. | Valid lifecycle and append-only events; customer sees public updates but never private notes. |
| Reports and moderation (T-037–T-040) | Submit duplicate/invalid reports, reach the five-report hold threshold, approve/reinstate/remove as admin, edit an ad, ban/unban a user and retry their old session. | One report per identity; held ad hidden; only admin mutations succeed; every change is audited. |
| Homepage, mobile and accessibility (T-041–T-043) | Inspect desktop, tablet and iPhone/Safari layouts; use keyboard only for navigation, forms and dialogs; check focus, zoom, reduced motion and a screen reader spot check. | No clipped content or horizontal overflow; every control has an understandable name and visible focus; key journeys work on a real device. |
| Operations and performance (T-047–T-054) | Check rate limit/recovery, security headers, 20k listing query plans, 500-user ramp/soak, backups and restore, authorized cron jobs, logs/alerts, and production smoke/rollback on the chosen infrastructure. | Agreed latency/error and recovery thresholds met; unauthorized cron denied; monitoring and rollback demonstrated. |

## Sign-off rule

For each completed feature in the master tracker, link its automated or manual evidence to the matching Test Matrix case. Keep cases **Blocked** where provider, staging, real-device, legal, or infrastructure setup is absent; write the exact dependency. A defect is closed only after its fix is retested on the new commit. Before proposing a merge, record passing CI for that commit, the outstanding blockers, and the reviewer decision. Pushing the branch does not approve a merge.
