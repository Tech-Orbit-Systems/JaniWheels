import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedSearches, savedSearchNotifications as notifications, listings, users } from "@/db/schema";
import { buildWhere } from "@/lib/listings/search";
import { buildListingPath } from "@/lib/listings/slug";
import type { FacetState } from "@/lib/seo/facets";
import { buildAlertEmail, sendAlertEmail, type AlertEmail } from "@/lib/email/saved-search";

interface DeliveryPayload { message: AlertEmail; key: string }

export async function queueSavedSearchAlerts() {
  let queued = 0;
  let failed = 0;
  // Bounded work per invocation; searches with overflow stay due until drained.
  const due = await db.select({ id: savedSearches.id }).from(savedSearches)
    .where(and(ne(savedSearches.alertFrequency, "off"), sql`(${savedSearches.alertFrequency} = 'instant' OR ${savedSearches.lastNotifiedAt} IS NULL OR ${savedSearches.lastNotifiedAt} < NOW() - INTERVAL '23 hours')`))
    .orderBy(sql`${savedSearches.lastNotifiedAt} ASC NULLS FIRST`, asc(savedSearches.id)).limit(100);
  for (const candidate of due) {
    try {
      queued += await db.transaction(async tx => {
        const [row] = await tx.select({ search: savedSearches, user: users }).from(savedSearches)
          .innerJoin(users, eq(users.id, savedSearches.userId)).where(eq(savedSearches.id, candidate.id))
          .for("update", { skipLocked: true });
        if (!row || row.search.alertFrequency === "off") return 0;
        if (row.user.isBanned || !row.user.emailVerifiedAt || !row.user.email) {
          await tx.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, candidate.id));
          return 0;
        }
        if (row.search.alertFrequency !== "instant" && row.search.lastNotifiedAt && row.search.lastNotifiedAt.getTime() > Date.now() - 23 * 3600_000) return 0;
        const state = (row.search.filters as { state?: FacetState }).state;
        if (!state || state.vertical !== row.search.vertical) throw new Error("Invalid saved search");
        const matches = await tx.select({ id: listings.id }).from(listings)
          .where(and(...buildWhere(state), sql`NOT EXISTS (SELECT 1 FROM ${notifications} WHERE ${notifications.savedSearchId}=${candidate.id} AND ${notifications.listingId}=${listings.id})`))
          .orderBy(asc(listings.id)).limit(100);
        if (matches.length) await tx.insert(notifications).values(matches.map(match => ({ savedSearchId: candidate.id, listingId: match.id, recipientEmail: row.user.email! }))).onConflictDoNothing();
        if (matches.length < 100) await tx.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, candidate.id));
        return matches.length;
      });
    } catch {
      failed++;
      // A malformed old search must not starve all other searches in the batch.
      await db.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, candidate.id));
    }
  }
  return { searchesChecked: due.length, notificationsQueued: queued, searchesFailed: failed };
}

export async function deliverSavedSearchAlerts(send: typeof sendAlertEmail = sendAlertEmail, limit = 25) {
  if (send === sendAlertEmail && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    return { delivered: 0, failed: 0, suppressed: 0, configured: false };
  }
  let delivered = 0;
  let failed = 0;
  let suppressed = 0;
  for (let i = 0; i < Math.min(25, limit); i++) {
    const claim = await db.transaction(async tx => {
      const [row] = await tx.select({ notification: notifications, search: savedSearches, user: users, listing: listings })
        .from(notifications).innerJoin(savedSearches, eq(savedSearches.id, notifications.savedSearchId))
        .innerJoin(users, eq(users.id, savedSearches.userId)).innerJoin(listings, eq(listings.id, notifications.listingId))
        .where(and(eq(notifications.delivered, false), isNull(notifications.suppressedAt), lte(notifications.nextAttemptAt, new Date())))
        .orderBy(asc(notifications.id)).limit(1).for("update", { of: notifications, skipLocked: true });
      if (!row) return null;
      const n = row.notification;
      const expiredRetry = n.firstAttemptAt && Date.now() - n.firstAttemptAt.getTime() >= 23 * 3600_000;
      if (row.search.alertFrequency === "off" || row.user.isBanned || !row.user.emailVerifiedAt || row.user.email !== n.recipientEmail || row.listing.status !== "active" || expiredRetry) {
        await tx.update(notifications).set({ suppressedAt: new Date(), lastError: expiredRetry ? "Retry window expired; reconcile with provider before any resend" : "Recipient preference, eligibility or listing availability changed" }).where(eq(notifications.id, n.id));
        return { suppressed: true as const };
      }
      const payload = n.payload as DeliveryPayload | null ?? {
        message: buildAlertEmail(n.recipientEmail, row.listing.title, buildListingPath(row.listing.vertical, row.listing.slug, row.listing.id)),
        // Numeric IDs can overlap across staging/production sharing a provider.
        key: `saved-search-${randomUUID()}`,
      };
      const attempt = n.attempts + 1;
      // Commit the attempt and immutable payload before network I/O. A crash
      // retries the same provider key/body and never resets the retry window.
      await tx.update(notifications).set({ attempts: attempt, firstAttemptAt: n.firstAttemptAt ?? new Date(), nextAttemptAt: new Date(Date.now() + 60_000), payload }).where(eq(notifications.id, n.id));
      return { suppressed: false as const, id: n.id, attempt, payload };
    });
    if (!claim) break;
    if (claim.suppressed) { suppressed++; continue; }
    try {
      await send(claim.payload.message, claim.payload.key);
      await db.update(notifications).set({ delivered: true, deliveredAt: new Date(), lastError: null }).where(and(eq(notifications.id, claim.id), eq(notifications.attempts, claim.attempt)));
      delivered++;
    } catch {
      await db.update(notifications).set({ lastError: "Delivery failed; scheduled retry", nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** Math.min(claim.attempt, 6)) * 1000) }).where(and(eq(notifications.id, claim.id), eq(notifications.attempts, claim.attempt)));
      failed++;
    }
  }
  return { delivered, failed, suppressed };
}
