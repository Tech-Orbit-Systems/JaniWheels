import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { dealers, users } from "@/db/schema/users";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { abs, breadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/jsonld";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Car Dealers in Pakistan | JaniWheels",
  description:
    "Browse verified used car dealers across Pakistan. See each showroom's live inventory before you visit.",
  alternates: { canonical: abs("/dealers") },
};

export default async function DealersIndexPage() {
  const rows = await db
    .select({
      id: dealers.id,
      slug: dealers.slug,
      businessName: dealers.businessName,
      cityName: cities.name,
      citySlug: cities.slug,
      verifiedAt: dealers.verifiedAt,
      liveCount: sql<number>`COUNT(${listings.id})::int`,
    })
    .from(dealers)
    .innerJoin(users, eq(users.id, dealers.userId))
    .innerJoin(cities, eq(dealers.cityId, cities.id))
    .leftJoin(
      listings,
      and(eq(listings.dealerId, dealers.id), eq(listings.status, "active")),
    )
    .where(and(isNotNull(dealers.verifiedAt), eq(users.isBanned, false), isNull(users.closedAt)))
    .groupBy(
      dealers.id,
      dealers.slug,
      dealers.businessName,
      cities.name,
      cities.slug,
      dealers.verifiedAt,
    )
    .orderBy(desc(sql`COUNT(${listings.id})`))
    .limit(200);

  const byCity = rows.reduce<Record<string, typeof rows>>((acc, d) => {
    (acc[d.cityName] ??= []).push(d);
    return acc;
  }, {});

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Dealers", path: "/dealers" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
      />

      <Breadcrumbs crumbs={crumbs} />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Car dealers in Pakistan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} showroom{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dealers/register"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          List your showroom
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-700">No verified dealers are listed yet.</p>
          <Link
            href="/dealers/register"
            className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Register your showroom
          </Link>
        </div>
      ) : (
        Object.entries(byCity).map(([city, list]) => (
          <section key={city} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{city}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/dealers/${d.slug}`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-slate-900">
                        {d.businessName}
                      </h3>
                      {d.verifiedAt && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {d.liveCount} active {d.liveCount === 1 ? "ad" : "ads"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
