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

## Release gates

Keep PR #6 open for independent review of the updated commit. Passing CI does not approve a merge. Live hosting/database/media/mail/Google configuration, backup restore rehearsal, external monitoring, representative staging load and real-device/screen-reader acceptance remain deployment and launch gates. Approved retention A and seller-badge B1 are unchanged.
