import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { dealerPlans } from "@/db/schema/commerce";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser } from "@/lib/dealers/queries";
import { formatPkr } from "@/lib/format";
import { DealerRegisterForm } from "./DealerRegisterForm";

export const metadata: Metadata = {
  title: "Register as a dealer",
  robots: { index: true, follow: true },
};

export default async function DealerRegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dealers/register");

  const existing = await getDealerForUser(user.id);
  if (existing) redirect("/dashboard/dealer");

  const [cityRows, plans] = await Promise.all([
    db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name)),
    db.select().from(dealerPlans).orderBy(asc(dealerPlans.monthlyPricePkr)),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Sell as a dealer
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Get a branded storefront, bulk upload your inventory, and see exactly
        how many buyers each car brings you.
      </p>

      <DealerRegisterForm cities={cityRows} />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Plans</h2>
        <p className="mb-4 text-sm text-slate-600">
          Registration is free. Pick a plan once your storefront is set up.
        </p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatPkr(p.monthlyPricePkr)}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>{p.listingQuota} live listings</li>
                {p.featuredQuota > 0 && <li>{p.featuredQuota} featured slots</li>}
                {p.bulkUpload && <li>Bulk CSV upload</li>}
                {p.brandedStorefront && <li>Branded storefront</li>}
                {p.leadAnalytics && <li>Lead analytics</li>}
                {p.prioritySupport && <li>Priority support</li>}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
