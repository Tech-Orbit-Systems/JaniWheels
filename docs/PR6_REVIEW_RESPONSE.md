# PR #6 independent review response

Review source: [numbered independent report](https://github.com/Tech-Orbit-Systems/JaniWheels/pull/6#issuecomment-6048086118).
Reviewed baseline: `e4170b245b3eda566580c987aeae91dd2c458770`.
Response date: 8 October 2026.

## Findings and disposition

The nine confirmed defects were reproduced or verified against the application paths and accepted. Finding 10 is a policy risk consistent with the existing public profile restrictions and was addressed without deleting inventory or changing the signed V1 scope.

| # | Priority | Finding | Repair and regression coverage |
| --- | --- | --- | --- |
| 1 | P1 | Seller deletion missing from restore ledger | Ad deletion and its `seller-delete` receipt commit atomically. Replay hides the ad and retains evidence. Browser lifecycle simulates a pre-delete backup, repeats replay, and checks public detail/media denial and admin evidence access. |
| 2 | P1 | Closure replay can undo later moderation | Replay skips receipts already included in the backup and preserves an existing closure snapshot. Isolated DB test restores a during-closure backup with a later rejection and confirms that rejection survives. |
| 3 | P1 | Closed verified dealer appears on homepage | Homepage joins the account and excludes banned/closed owners. Browser test closes, restores and bans a verified dealer, checking homepage and storefront visibility. |
| 4 | P2 | Close/restore replay can send cancelled alerts | Replayed closure suppresses undelivered notifications before restoring preferences. DB regression verifies suppression and idempotent replay from pre-closure and during-closure backups. |
| 5 | P2 | Reactivation bypasses quota and publication races | Publication across all three verticals, reactivation and rejected-ad resubmission acquire the same owner row lock and enforce the quota inside the transaction. DB concurrency test allows only one of three competing publications at two live ads. Dealer exemption is tested. Browser regressions check denial without writes and successful reactivation/resubmission after freeing capacity. |
| 6 | P2 | Car publication accepts bike taxonomy | Supplied variant IDs must resolve to active curated make/model/variant records in the requested vertical. Invalid supplied IDs cannot fall back to custom text. DB regression verifies rejection before upload claims and valid car publication. |
| 7 | P2 | Publication accepts an area in another city | Every publication transaction validates the city/area relationship before writing or claiming uploads. DB test covers cars, bikes and parts and verifies rollback. |
| 8 | P2 | Return destination permits an external redirect | All seven auth paths use one bounded URL parser with same-origin checks and rejection of slash/backslash/control encodings and network paths produced by dot-segment normalization. Helper cases and authenticated HTTP redirects cover the reported payload and valid local paths. |
| 9 | P2 | Handled database errors expose private query parameters | Lead logging emits fixed event names and allowlisted SQLSTATE codes only. Similar handled raw-error logging paths use the same helper. Lead source is bounded to known values. DB suite checks that message/query/parameter markers never reach the emitted record. |
| 10 | Policy risk | Banned seller inventory remains public | Shared listing eligibility hides banned/closed/anonymized owner inventory from search, saved/recent ads, dealer/seller inventory, sitemap and alert matches. Detail, media, contact and linked inspection paths check the same account availability. Unban exposes only still-active inventory. Browser and distinct seller/buyer alert regressions cover these paths. |

The quota retry regression also exposed an edit-form reset after a resolved error state. The edit form now preserves correction inputs and taxonomy selection until a successful save redirects. The resubmission test asserts input retention before retrying.

## Verification

Local verification passed: `npm run check`, `npm run lint`, `npm run build:safe` (maximum First Load JS 128 KB), 18 isolated DB acceptance cases, 14 focused desktop/mobile browser cases across the final targeted runs, and a 103-URL sweep with zero issues. The form retry cases verify preserved inputs, denied writes at capacity and successful resubmission after capacity is freed.

The earlier full local browser run was interrupted after timeouts and connection resets; it is not recorded as a pass. The updated commit's GitHub Quality and acceptance workflow is the full-suite gate. The independent baseline review is not approval of these new changes.

GitHub run 55 on `7c9a1e1` stopped at the production dependency audit before application tests. Its two Next.js cache-poisoning advisories are addressed by updating Next.js and the matching ESLint configuration to 15.5.27. The production audit subsequently reports zero vulnerabilities. Sources: [GHSA-4jqv-mc3x-m676](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676) and [GHSA-mcj8-r9mp-w47p](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p). The follow-up commit must pass the full workflow.

The 15.5.27 patch passed local audit, checks, lint, production build, 103-URL sweep and both desktop/mobile resubmission cases. The first local build worker ran out of memory; the bounded-heap retry passed.

[GitHub run 56](https://github.com/Tech-Orbit-Systems/JaniWheels/actions/runs/37753334311) passed on `df422a7`: 18 DB cases, checks, lint, build, 101 URLs with zero issues and 129 browser cases (127 passed, one passed on retry, one planned skip). The retry came from the mobile accessibility scanner selecting another test's temporary ad while its cleanup deleted it. The scanner now selects stable seeded demo inventory; it still asserts HTTP 200 and no axe violations, without adding retries or weakening assertions. The follow-up test-only commit must pass the full workflow again.

## Fresh independent review of `5918a8a`

The [8 October fresh re-review](https://github.com/Tech-Orbit-Systems/JaniWheels/pull/6#issuecomment-6057807061) found two remaining P2 blockers. Vehicle edits now reject a supplied variant unless its curated make, model and variant are all active and in the matching vertical; a nonexistent ID cannot fall back to ad-local labels. Edit and rejected-ad correction transactions now acquire the retention advisory lock before the owner row lock, matching account closure's order. Migration 0018 limits the active-listing owner guard to insertion, activation and seller changes, so view-count updates do not take the seller lock after the listing lock. The closed-account publication guard remains in force. The offscreen lazy-image browser assertion scrolls the image into view before checking that it loaded.

Focused desktop/mobile browser regressions passed for car and bike edits with inactive make/model/variant IDs, forged IDs, and valid curated edits, plus concurrent account closure and edit (6/6). The upload/media authorization test passed in both viewports after rebuilding with the acceptance site URL (2/2). A controlled database barrier queues a view-count write before closure behind the same listing lock; both operations finish without a deadlock, the count persists and the listing closes. On the latest code, migration 0018, 19 isolated DB tests, `npm run check`, lint, production build (maximum First Load JS 128 KB), and a 101-route sweep passed. The local Node runtime required a temporary user-info workaround and a bounded heap because of host memory errors; the first unbounded build and a broader parallel browser attempt failed from host memory pressure. These are not recorded as application passes. Full latest-head CI and independent re-review remain pending; WebKit, providers, deployment and production readiness remain unverified.

## Fresh independent re-review of `73c1974`

The [second fresh re-review](https://github.com/Tech-Orbit-Systems/JaniWheels/pull/6#issuecomment-6063273882) confirmed the earlier edit, correction, view-count and lazy-image repairs, but found a P2 deadlock between admin approve/reinstate and account closure, plus a P3 malformed variant-ID error. Admin moderation now reads the candidate seller without a row lock, locks that seller before the listing, and rechecks seller identity and current status under the listing lock. Approval and reinstatement reject closed, banned or anonymized sellers with a handled result. The report auto-hide path also uses seller-before-listing order because its audit insert references the seller after taking the listing lock. The database publication guard remains unchanged.

Car and bike create/edit actions now distinguish an empty variant selection from a malformed nonempty value. The shared schemas cap IDs at PostgreSQL's integer maximum and return a `variantId` field error for malformed or out-of-range input. Intentional empty-ID ad-local fallback remains available.

Fresh local verification on these changes passed `npm run check`, `npm run lint`, production build (maximum First Load JS 128 KB), 19 isolated DB tests and a 101-route sweep. Deterministic real-action approve/reinstate versus closure checks passed in both forced schedules on desktop and mobile (8/8), with no unexpected Flight error, no partial audit and no public listing after closure. Car/bike edit checks covered inactive and forged IDs, malformed IDs with supplied custom labels, the integer overflow boundary, intentional empty fallback and valid curated edits (6/6 including concurrent closure). The report auto-hide browser cases passed on desktop and mobile (2/2). Full latest-head GitHub CI and independent re-review remain pending; local WebKit, live providers and production readiness remain unverified.

## Independent re-review of `082c2d2`

The [third independent re-review](https://github.com/Tech-Orbit-Systems/JaniWheels/pull/6#issuecomment-6066745782) confirmed the previous admin/closure and malformed variant-ID fixes, but reproduced a P2 deadlock between reciprocal authenticated reports. Each report locked the target seller `FOR UPDATE`, then its reporter foreign key requested `FOR KEY SHARE` on the other seller. The two transactions could wait on each other, losing one valid fifth report and its automatic review hold.

The report path now requests `FOR NO KEY UPDATE` on the target seller. This still conflicts with account closure's `FOR UPDATE`, while allowing the other report's foreign-key `FOR KEY SHARE`. Admin decisions retain `FOR UPDATE`. Target-owner eligibility and listing state are rechecked in the transaction.

Real HTTP browser regressions now force both reciprocal reports to queue behind the two listing rows. With three prior reports, both submissions reach four without hiding either ad; with four prior reports, both reach five, hide both ads and create exactly one automated queue audit per ad. Duplicate replay remains idempotent. These four desktop/mobile cases pass without an unexpected Flight error. Separate forced report/closure schedules pass in both orders on desktop/mobile (4/4), as do the earlier approve/reinstate versus closure schedules (8/8). The first reciprocal run exposed a synthetic fixture cleanup error from cross-account report foreign keys; cleanup was corrected and all four cases passed on rerun. Fresh isolated migration, 19 DB tests, `npm run check`, lint, production build (maximum First Load JS 128 KB) and 101-route sweep passed. Exact replacement-head CI and independent re-review remain pending; live providers, local WebKit and production readiness remain unverified.

## Release gates

Keep PR #6 open for independent review of the updated commit. Passing CI does not approve a merge. Live hosting/database/media/mail/Google configuration, backup restore rehearsal, external monitoring, representative staging load and real-device/screen-reader acceptance remain deployment and launch gates. Approved retention A and seller-badge B1 are unchanged.
