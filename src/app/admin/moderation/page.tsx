import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { listingReports } from "@/db/schema/trust";
import { users } from "@/db/schema/users";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { buildListingPath } from "@/lib/listings/slug";
import { formatPkr, relativeTime } from "@/lib/format";
import { ModerationActions } from "./ModerationActions";

export const metadata: Metadata = {
  title: "Moderation queue",
  robots: { index: false, follow: false },
};

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/moderation");

  const [me] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Redirect rather than 403 — a 403 confirms the route exists.
  if (!me?.isAdmin) redirect("/");

  const [pending, reported] = await Promise.all([
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        title: listings.title,
        pricePkr: listings.pricePkr,
        vertical: listings.vertical,
        createdAt: listings.createdAt,
        cityName: cities.name,
        sellerPhone: users.phone,
      })
      .from(listings)
      .innerJoin(cities, eq(listings.cityId, cities.id))
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(eq(listings.status, "pending_review"))
      .orderBy(desc(listings.createdAt))
      .limit(50),

    db
      .select({
        listingId: listingReports.listingId,
        title: listings.title,
        slug: listings.slug,
        vertical: listings.vertical,
        status: listings.status,
        reports: sql<number>`COUNT(*)::int`,
        reasons: sql<string>`STRING_AGG(DISTINCT ${listingReports.reason}::text, ', ')`,
        latest: sql<Date>`MAX(${listingReports.createdAt})`,
      })
      .from(listingReports)
      .innerJoin(listings, eq(listingReports.listingId, listings.id))
      .where(eq(listingReports.status, "open"))
      .groupBy(
        listingReports.listingId,
        listings.title,
        listings.slug,
        listings.vertical,
        listings.status,
      )
      .orderBy(desc(sql`COUNT(*)`))
      .limit(50),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Moderation</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {pending.length} awaiting review · {reported.length} reported
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Awaiting review
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Queue is clear.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={buildListingPath(l.vertical, l.slug, l.id)}
                    className="line-clamp-1 font-medium text-slate-900 hover:text-blue-700"
                  >
                    {l.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {formatPkr(l.pricePkr)} · {l.cityName} · {l.sellerPhone} ·{" "}
                    {relativeTime(l.createdAt)}
                  </p>
                </div>
                <ModerationActions listingId={l.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Reported</h2>
        {reported.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No open reports.
          </p>
        ) : (
          <ul className="space-y-2">
            {reported.map((r) => (
              <li
                key={r.listingId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={buildListingPath(r.vertical, r.slug, r.listingId)}
                    className="line-clamp-1 font-medium text-slate-900 hover:text-blue-700"
                  >
                    {r.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-amber-700">
                      {r.reports} report{r.reports === 1 ? "" : "s"}
                    </span>{" "}
                    · {r.reasons} · status {r.status}
                  </p>
                </div>
                <ModerationActions listingId={r.listingId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
