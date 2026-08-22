import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getDealerDashboardStats,
  getDealerForUser,
} from "@/lib/dealers/queries";

export const metadata: Metadata = {
  title: "Dealer dashboard",
  robots: { index: false, follow: false },
};

export default async function DealerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/dealer");

  const dealer = await getDealerForUser(user.id);
  if (!dealer) redirect("/dealers/register");

  const stats = await getDealerDashboardStats(dealer.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {dealer.businessName}
            </h1>
            {dealer.verifiedAt ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Verified dealer
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Verification pending
              </span>
            )}
          </div>
          <Link
            href={`/dealers/${dealer.slug}`}
            className="text-sm text-blue-700 hover:underline"
          >
            View public storefront →
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Manage ads
          </Link>
          <Link
            href="/sell"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Post an ad
          </Link>
        </div>
      </div>

      {!dealer.verifiedAt && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your dealership profile has been submitted for manual verification.
          Your valid ads publish immediately; verification controls the dealer
          badge, while reports and moderation keep the marketplace safe.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Active ads" value={stats.activeListings} />
        <Stat label="Pending review" value={stats.pendingListings} />
        <Stat label="Sold" value={stats.soldListings} />
        <Stat label="All ads" value={stats.totalListings} />
        <Stat label="Phone reveals" value={stats.totalLeads} emphasis />
        <Stat label="Views" value={stats.totalViews} />
      </dl>
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
