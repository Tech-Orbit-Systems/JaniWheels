import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { sessions } from "@/db/schema/users";

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

    return { sessions: dead.length };
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
