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
import { ResubmitButton } from "./ResubmitButton";
import { moderationLog } from "@/db/schema/trust";

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
  removed: "bg-red-200 text-red-900",
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
      latestRejectionReason: sql<string | null>`(
        SELECT reason FROM ${moderationLog}
        WHERE listing_id = ${listings.id} AND action = 'reject'
        ORDER BY created_at DESC LIMIT 1
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
          href="/post-ad"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Post another ad
        </Link>
      </div>

      <dl className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Phone reveals" value={totalLeads} emphasis />
        <Stat label="Views" value={totalViews} />
        <Stat label="Ads" value={rows.length} />
      </dl>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-700">You haven&apos;t posted anything yet.</p>
          <Link
            href="/post-ad"
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
                  {r.status === "active" && <MarkSoldButton listingId={r.id} />}
                  {r.status === "pending_review" && (
                    <span className="text-amber-800">Under admin review — hidden from buyers</span>
                  )}
                </div>
                {r.status === "rejected" && (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                    <p className="font-medium">Admin requested changes</p>
                    <p className="mt-0.5">{r.latestRejectionReason ?? "Please review and correct this ad before resubmitting."}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link href={`/dashboard/listings/${r.id}/edit`} className="font-medium text-blue-700 hover:underline">Fix details and resubmit</Link>
                      <ResubmitButton listingId={r.id} />
                    </div>
                  </div>
                )}
                {r.status === "removed" && (
                  <p className="mt-2 text-xs text-red-800">Permanently removed after the third rejection. Post a new ad instead.</p>
                )}
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
