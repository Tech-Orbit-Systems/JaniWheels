import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { makes, models } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { buildPath } from "@/lib/seo/facets";

export const revalidate = 3600;

/**
 * Home page.
 *
 * Its job is link equity distribution, not feature display. The links below
 * are the entry points that push crawl depth down into the money pages
 * (model x city), which is where the search traffic actually lands.
 *
 * Note what is NOT here: 407 images and 6,655 DOM nodes. The incumbent's
 * home page is a link farm that renders slowly and converts nobody. Keep
 * this page small, and let the facet pages do the ranking.
 */
export default async function HomePage() {
  const [popularModels, popularCities, popularMakes] = await Promise.all([
    db
      .select({
        id: models.id,
        slug: models.slug,
        name: models.name,
        fullSlug: models.fullSlug,
        makeName: makes.name,
        makeSlug: makes.slug,
      })
      .from(models)
      .innerJoin(makes, eq(models.makeId, makes.id))
      .where(and(eq(models.vertical, "car"), eq(models.isActive, true)))
      .orderBy(desc(models.popularity))
      .limit(12),
    db
      .select({ id: cities.id, slug: cities.slug, name: cities.name })
      .from(cities)
      .where(eq(cities.isMajor, true))
      .orderBy(desc(cities.popularity))
      .limit(12),
    db
      .select({ id: makes.id, slug: makes.slug, name: makes.name })
      .from(makes)
      .where(and(eq(makes.vertical, "car"), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity))
      .limit(12),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-4xl">
          Buy and sell used cars in Pakistan
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every listing shows how its price compares to the market, so you know
          whether you are looking at a deal before you pick up the phone.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/used-cars"
            className="rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Browse used cars
          </Link>
          <Link
            href="/sell"
            className="rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Sell your car free
          </Link>
        </div>
      </section>

      <LinkSection
        title="Popular models"
        links={popularModels.map((m) => ({
          key: m.fullSlug,
          label: `${m.makeName} ${m.name}`,
          href: buildPath({
            vertical: "car",
            model: {
              id: m.id,
              slug: m.slug,
              name: m.name,
              makeSlug: m.makeSlug,
            },
          }),
        }))}
      />

      <LinkSection
        title="Browse by city"
        links={popularCities.map((c) => ({
          key: c.slug,
          label: c.name,
          href: buildPath({ vertical: "car", city: c }),
        }))}
      />

      <LinkSection
        title="Browse by make"
        links={popularMakes.map((m) => ({
          key: m.slug,
          label: m.name,
          href: buildPath({ vertical: "car", make: m }),
        }))}
      />
    </main>
  );
}

function LinkSection({
  title,
  links,
}: {
  title: string;
  links: { key: string; label: string; href: string }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {links.map((l) => (
          <li key={l.key}>
            <Link
              href={l.href}
              className="flex items-center rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:text-blue-700"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
