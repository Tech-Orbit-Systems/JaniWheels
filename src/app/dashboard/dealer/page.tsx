import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { dealerPlans } from "@/db/schema/commerce";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getDealerForUser,
  getActivePlan,
  getLeadAnalytics,
} from "@/lib/dealers/queries";
import { remainingQuota } from "@/lib/dealers/bulk-import";
import { buildListingPath } from "@/lib/listings/slug";
import { formatPkr } from "@/lib/format";
import { LeadSparkline } from "./LeadSparkline";

export const metadata: Metadata = {
  title: "Dealer console",
  robots: { index: false, follow: false },
};

export default async function DealerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/dealer");

  const dealer = await getDealerForUser(user.id);
  if (!dealer) redirect("/dealers/register");

  const plan = await getActivePlan(dealer.id);
  const [analytics, plans] = await Promise.all([
    getLeadAnalytics(dealer.id),
    db.select().from(dealerPlans).orderBy(asc(dealerPlans.monthlyPricePkr)),
  ]);
  const quota = plan ? await remainingQuota(dealer.id, plan.listingQuota) : 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {dealer.businessName}
          </h1>
          <Link
            href={`/dealers/${dealer.slug}`}
            className="text-sm text-blue-700 hover:underline"
          >
            View public storefront →
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sell"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Add one car
          </Link>
          <Link
            href="/dashboard/dealer/bulk"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Bulk upload
          </Link>
        </div>
      </div>

      {!plan ? (
        <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">No active plan</h2>
          <p className="mt-1 text-sm text-amber-900">
            Your storefront is live, but you need a plan to publish inventory.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <li key={p.id} className="rounded border border-amber-200 bg-white p-3">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="text-lg font-bold text-slate-900">
                  {formatPkr(p.monthlyPricePkr)}
                  <span className="text-xs font-normal text-slate-500">/mo</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {p.listingQuota} listings
                  {p.bulkUpload ? " · bulk upload" : ""}
                  {p.leadAnalytics ? " · analytics" : ""}
                </p>
                <form method="POST" action="/api/payments/subscribe" className="mt-2">
                  <input type="hidden" name="dealerPlanId" value={p.id} />
                  <input type="hidden" name="gateway" value="jazzcash" />
                  <button
                    type="submit"
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Subscribe
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mb-6 flex flex-wrap gap-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Plan</p>
            <p className="font-semibold text-slate-900">{plan.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Renews</p>
            <p className="font-medium text-slate-900">
              {plan.endsAt.toLocaleDateString("en-PK")}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Listing slots left</p>
            <p className="font-medium text-slate-900">
              {quota} of {plan.listingQuota}
            </p>
          </div>
        </div>
      )}

      {/* Leads first. Views are vanity; a phone reveal is a buyer. */}
      <dl className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Phone reveals" value={analytics.totalLeads} emphasis />
        <Stat label="Views" value={analytics.totalViews} />
        <Stat label="Live listings" value={analytics.activeListings} />
      </dl>

      {plan?.leadAnalytics === false && (
        <p className="mb-6 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          Detailed analytics are included in the Showroom plan and above.
        </p>
      )}

      {analytics.leadsByDay.length > 0 && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Phone reveals, last 30 days
          </h2>
          <LeadSparkline data={analytics.leadsByDay} />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Best performing
          </h2>
          {analytics.topListings.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing live yet.</p>
          ) : (
            <ul className="space-y-2">
              {analytics.topListings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={buildListingPath("car", l.slug, l.id)}
                    className="line-clamp-1 text-slate-700 hover:text-blue-700"
                  >
                    {l.title}
                  </Link>
                  <span className="shrink-0 font-semibold text-emerald-700">
                    {l.leads}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/*
          The panel that earns the subscription. Telling a dealer which cars
          are getting no calls is worth more than another number going up —
          it is the only view here they can actually act on, by dropping the
          price or replacing the photos.
        */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Getting no calls
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">
            Live over a week with zero phone reveals. Usually price or photos.
          </p>
          {analytics.coldListings.length === 0 ? (
            <p className="text-sm text-emerald-700">
              Every listing is getting calls.
            </p>
          ) : (
            <ul className="space-y-2">
              {analytics.coldListings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={buildListingPath("car", l.slug, l.id)}
                    className="line-clamp-1 text-slate-700 hover:text-blue-700"
                  >
                    {l.title}
                  </Link>
                  <span className="shrink-0 text-xs text-amber-700">
                    {l.days}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
