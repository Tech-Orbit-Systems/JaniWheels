import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { adPackages, listingPromotions } from "@/db/schema/commerce";
import { getCurrentUser } from "@/lib/auth/session";
import { availableGateways } from "@/lib/payments";
import { formatPkr } from "@/lib/format";
import { BumpButton } from "./BumpButton";

export const metadata: Metadata = {
  title: "Promote your ad",
  robots: { index: false, follow: false },
};

export default async function PromotePage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const user = await getCurrentUser();
  const { listingId } = await params;
  const id = Number(listingId);

  if (!Number.isSafeInteger(id)) notFound();
  if (!user) redirect(`/login?next=/promote/${id}`);

  const [listing] = await db
    .select({
      id: listings.id,
      title: listings.title,
      viewCount: listings.viewCount,
      leadCount: listings.leadCount,
      featuredUntil: listings.featuredUntil,
    })
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.sellerId, user.id)))
    .limit(1);

  if (!listing) notFound();

  const [packages, gateways, bumps] = await Promise.all([
    db
      .select()
      .from(adPackages)
      .where(and(eq(adPackages.isActive, true), gt(adPackages.pricePkr, 0)))
      .orderBy(asc(adPackages.sortOrder)),
    Promise.resolve(availableGateways()),
    db
      .select({
        remaining: sql<number>`SUM(${listingPromotions.bumpsTotal} - ${listingPromotions.bumpsUsed})::int`,
      })
      .from(listingPromotions)
      .where(
        and(
          eq(listingPromotions.listingId, id),
          gt(listingPromotions.expiresAt, new Date()),
        ),
      ),
  ]);

  const bumpsLeft = bumps[0]?.remaining ?? 0;
  const isFeatured =
    listing.featuredUntil && listing.featuredUntil > new Date();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">
        ← Back to my ads
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        Promote this ad
      </h1>
      <p className="mt-1 line-clamp-1 text-sm text-slate-600">{listing.title}</p>

      {/*
        Show current performance first. A seller deciding whether to pay is
        asking "is this ad working?" — answering that honestly, including
        when the answer is "barely", is what makes the upsell credible
        rather than a shakedown.
      */}
      <div className="mt-4 flex gap-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Phone reveals</p>
          <p className="text-xl font-bold text-emerald-700">
            {listing.leadCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Views</p>
          <p className="text-xl font-bold text-slate-900">
            {listing.viewCount}
          </p>
        </div>
        {isFeatured && (
          <div>
            <p className="text-xs text-slate-500">Featured until</p>
            <p className="text-sm font-medium text-amber-700">
              {listing.featuredUntil!.toLocaleDateString("en-PK")}
            </p>
          </div>
        )}
      </div>

      {bumpsLeft > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            You have <strong>{bumpsLeft}</strong> bump
            {bumpsLeft === 1 ? "" : "s"} left. Bumping moves your ad back to
            the top of search.
          </p>
          <BumpButton listingId={listing.id} />
        </div>
      )}

      {gateways.length === 0 ? (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No payment gateway is configured on this environment. Set
          <code className="mx-1">JAZZCASH_*</code> or
          <code className="mx-1">EASYPAISA_*</code> in <code>.env</code>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {packages.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{p.name}</h2>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                    <li>Live for {p.durationDays} days</li>
                    {p.featuredDays > 0 && (
                      <li>Featured placement for {p.featuredDays} days</li>
                    )}
                    {p.bumpCount > 0 && <li>{p.bumpCount} bumps to top</li>}
                    <li>Up to {p.photoLimit} photos</li>
                    {p.homepageSlot && <li>Homepage carousel</li>}
                  </ul>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {formatPkr(p.pricePkr)}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {gateways.map((g) => (
                  <form
                    key={g}
                    method="POST"
                    action="/api/payments/checkout"
                    className="inline"
                  >
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="adPackageId" value={p.id} />
                    <input type="hidden" name="gateway" value={g} />
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Pay with {g === "jazzcash" ? "JazzCash" : "Easypaisa"}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
