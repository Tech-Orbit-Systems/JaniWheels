import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings, listingImages } from "@/db/schema/listings";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { buildListingPath } from "@/lib/listings/slug";
import { formatPkr, relativeTime } from "@/lib/format";
import { MarkSoldButton } from "./MarkSoldButton";

export const metadata: Metadata = {
  title: "My ads",
  robots: { index: false, follow: false },
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending_review: "bg-amber-100 text-amber-800",
  sold: "bg-slate-200 text-slate-700",
  expired: "bg-slate-100 text-slate-500",
  rejected: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      pricePkr: listings.pricePkr,
      status: listings.status,
      vertical: listings.vertical,
      viewCount: listings.viewCount,
      leadCount: listings.leadCount,
      createdAt: listings.createdAt,
      expiresAt: listings.expiresAt,
      cityName: cities.name,
      primaryImageKey: sql<string | null>`(
        SELECT storage_key FROM ${listingImages}
        WHERE listing_id = ${listings.id} ORDER BY position LIMIT 1
      )`,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .where(eq(listings.sellerId, user.id))
    .orderBy(desc(listings.createdAt));

  const totalLeads = rows.reduce((n, r) => n + r.leadCount, 0);
  const totalViews = rows.reduce((n, r) => n + r.viewCount, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">My ads</h1>
        <Link
          href="/sell"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Post another ad
        </Link>
      </div>

      {/*
        Leads before views, deliberately. Views are a vanity number; a phone
        reveal is someone who wants the car. Showing sellers the metric that
        actually matters is also what makes an upsell to Featured credible
        later — you are selling more of a thing they can already measure.
      */}
      <dl className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Phone reveals" value={totalLeads} emphasis />
        <Stat label="Views" value={totalViews} />
        <Stat label="Ads" value={rows.length} />
      </dl>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-700">You haven&apos;t posted anything yet.</p>
          <Link
            href="/sell"
            className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Post your first ad — it&apos;s free
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex gap-4 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded bg-slate-100">
                {r.primaryImageKey && (
                  <Image
                    src={`/uploads/${r.primaryImageKey}`}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={buildListingPath(r.vertical, r.slug, r.id)}
                    className="line-clamp-1 font-medium text-slate-900 hover:text-blue-700"
                  >
                    {r.title}
                  </Link>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status] ?? "bg-slate-100"}`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900">
                  {formatPkr(r.pricePkr)}
                </p>
                <p className="text-xs text-slate-500">
                  {r.cityName} · posted {relativeTime(r.createdAt)}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-medium text-emerald-700">
                    {r.leadCount} phone reveal{r.leadCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-500">{r.viewCount} views</span>
                  {r.status === "active" && (
                    <Link
                      href={`/promote/${r.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      Promote
                    </Link>
                  )}
                  {r.status === "active" && <MarkSoldButton listingId={r.id} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`text-2xl font-bold ${emphasis ? "text-emerald-700" : "text-slate-900"}`}
      >
        {value.toLocaleString("en-PK")}
      </dd>
    </div>
  );
}
