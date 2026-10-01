import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings, pendingUploads } from "@/db/schema/listings";
import { emailVerificationTokens, passwordResetTokens, sessions } from "@/db/schema/users";
import { users } from "@/db/schema/users";
import { savedSearchNotifications, savedSearches } from "@/db/schema/analytics";
import { searchListings } from "@/lib/listings/search";
import type { FacetState } from "@/lib/seo/facets";
import { removeStoredImage } from "@/lib/images/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled jobs, triggered by an external scheduler (cron, Vercel Cron,
 * GitHub Actions) hitting this endpoint with the shared secret.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://site/api/cron/expire-listings
 *
 * Authenticated by a constant-time secret compare rather than left open —
 * `expire-listings` is destructive, so an unauthenticated endpoint would be
 * a way to quietly unpublish the whole catalogue.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const JOBS = {
  /**
   * Expire listings past their publication window. Without this the site slowly
   * fills with cars that sold months ago, which is the fastest way to lose
   * buyer trust — and every stale listing is also an indexed page that
   * disappoints whoever clicks it.
   */
  "expire-listings": async () => {
    const expired = await db
      .update(listings)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        sql`${listings.status} = 'active' AND ${listings.expiresAt} < NOW()`,
      )
      .returning({ id: listings.id });
    return { expired: expired.length };
  },

  /** Housekeeping for expired sessions. */
  "purge-expired": async () => {
    const dead = await db
      .delete(sessions)
      .where(sql`${sessions.expiresAt} < NOW()`)
      .returning({ id: sessions.id });

    const resetTokens = await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW() - INTERVAL '24 hours' OR ${passwordResetTokens.usedAt} IS NOT NULL`)
      .returning({ id: passwordResetTokens.id });

    const verificationTokens = await db
      .delete(emailVerificationTokens)
      .where(sql`${emailVerificationTokens.expiresAt} < NOW() - INTERVAL '24 hours' OR ${emailVerificationTokens.usedAt} IS NOT NULL`)
      .returning({ id: emailVerificationTokens.id });

    // Lock each old upload before touching storage so a concurrent publish
    // cannot claim an image while cleanup is deleting it.
    const uploads = await db.transaction(async (tx) => {
      const abandoned = await tx.select({ key: pendingUploads.storageKey })
        .from(pendingUploads)
        .where(sql`${pendingUploads.claimedAt} IS NULL AND ${pendingUploads.createdAt} < NOW() - INTERVAL '24 hours'`)
        .orderBy(asc(pendingUploads.createdAt))
        .limit(25)
        .for("update", { skipLocked: true });
      let removed = 0;
      let failed = 0;
      for (const upload of abandoned) {
        try {
          if (await removeStoredImage(upload.key)) {
            await tx.delete(pendingUploads).where(eq(pendingUploads.storageKey, upload.key));
            removed++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error("Abandoned upload cleanup failed", error);
          failed++;
        }
      }
      return { checked: abandoned.length, removed, failed };
    });

    return {
      sessions: dead.length,
      passwordResetTokens: resetTokens.length,
      emailVerificationTokens: verificationTokens.length,
      abandonedUploadsChecked: uploads.checked,
      abandonedUploadsRemoved: uploads.removed,
      imageCleanupFailures: uploads.failed,
    };
  },

  /**
   * Finds new matches and places provider-neutral notifications in an outbox.
   * The unique match key makes retries safe. A production email adapter can
   * deliver pending rows without coupling marketplace search to a vendor.
   */
  "saved-search-alerts": async () => {
    const searches = await db.select({ search: savedSearches, email: users.email })
      .from(savedSearches).innerJoin(users, eq(savedSearches.userId, users.id))
      .where(and(ne(savedSearches.alertFrequency, "off"), sql`${users.email} IS NOT NULL`, sql`(${savedSearches.alertFrequency} = 'instant' OR ${savedSearches.lastNotifiedAt} IS NULL OR ${savedSearches.lastNotifiedAt} < NOW() - INTERVAL '23 hours')`));
    let queued = 0;
    for (const { search, email } of searches) {
      const stored = search.filters as { state?: FacetState };
      if (!stored.state || !email) continue;
      const result = await searchListings({ ...stored.state, page: 1, sort: "recent" });
      const newRows = result.rows.filter(row => !search.lastNotifiedAt || (row.publishedAt && new Date(row.publishedAt) > search.lastNotifiedAt));
      if (newRows.length) {
        const inserted = await db.insert(savedSearchNotifications).values(newRows.map(row => ({ savedSearchId: search.id, listingId: row.id, recipientEmail: email }))).onConflictDoNothing().returning({ id: savedSearchNotifications.id });
        queued += inserted.length;
      }
      await db.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, search.id));
    }
    return { searchesChecked: searches.length, notificationsQueued: queued };
  },
} as const;

type JobName = keyof typeof JOBS;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  if (!(job in JOBS)) {
    return NextResponse.json(
      { error: "Unknown job", available: Object.keys(JOBS) },
      { status: 404 },
    );
  }

  const started = Date.now();
  try {
    const result = await JOBS[job as JobName]();
    return NextResponse.json({
      job,
      ok: true,
      durationMs: Date.now() - started,
      result,
    });
  } catch (err) {
    console.error(`cron job ${job} failed`, err);
    return NextResponse.json(
      { job, ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}

/** Most schedulers issue GET; same auth, same behaviour. */
export const GET = POST;
