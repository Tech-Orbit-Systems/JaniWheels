import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { makes, models } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { buildPath, type FacetState } from "@/lib/seo/facets";
import { MIN_LISTINGS_FOR_INDEXABLE_PAGE } from "@/lib/seo/indexation";

/**
 * INTERNAL LINKING
 *
 * The mechanism that makes a facet graph rank rather than just exist.
 *
 * A crawler arriving on /used-cars/toyota-corolla needs a path to
 * /used-cars/toyota-corolla/lahore, and a human who didn't find their car
 * needs a sideways move that isn't the back button. Both are the same
 * component.
 *
 * Two rules:
 *   - Only ever link to combinations the indexation policy would index.
 *     Linking to noindex pages spends crawl budget on pages that cannot rank.
 *   - Only link where real inventory exists. A link to a page with two cars
 *     on it advertises a thin page.
 */

interface LinkItem {
  key: string;
  label: string;
  href: string;
  count: number;
}

async function citiesForModel(state: FacetState): Promise<LinkItem[]> {
  if (!state.model) return [];

  const rows = await db
    .select({
      id: cities.id,
      slug: cities.slug,
      name: cities.name,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.vertical, state.vertical),
        eq(listings.modelId, state.model.id),
        state.city ? ne(cities.id, state.city.id) : undefined,
      ),
    )
    .groupBy(cities.id, cities.slug, cities.name)
    .having(sql`COUNT(*) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(12);

  return rows.map((c) => ({
    key: `city-${c.slug}`,
    label: `${state.model!.name} in ${c.name}`,
    href: buildPath({
      vertical: state.vertical,
      model: state.model,
      city: { id: c.id, slug: c.slug, name: c.name },
    }),
    count: c.n,
  }));
}

async function modelsForMake(state: FacetState): Promise<LinkItem[]> {
  const makeId = state.make?.id;
  if (!makeId) return [];

  const rows = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      makeSlug: makes.slug,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(listings)
    .innerJoin(models, eq(listings.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.vertical, state.vertical),
        eq(models.makeId, makeId),
        state.model ? ne(models.id, state.model.id) : undefined,
      ),
    )
    .groupBy(models.id, models.slug, models.name, makes.slug)
    .having(sql`COUNT(*) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(12);

  return rows.map((m) => ({
    key: `model-${m.slug}`,
    label: `${state.make!.name} ${m.name}`,
    href: buildPath({
      vertical: state.vertical,
      model: { id: m.id, slug: m.slug, name: m.name, makeSlug: m.makeSlug },
      ...(state.city ? { city: state.city } : {}),
    }),
    count: m.n,
  }));
}

async function popularInCity(state: FacetState): Promise<LinkItem[]> {
  if (!state.city || state.model) return [];

  const rows = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      makeName: makes.name,
      makeSlug: makes.slug,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(listings)
    .innerJoin(models, eq(listings.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.vertical, state.vertical),
        eq(listings.cityId, state.city.id),
      ),
    )
    .groupBy(models.id, models.slug, models.name, makes.name, makes.slug)
    .having(sql`COUNT(*) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(12);

  return rows.map((m) => ({
    key: `pop-${m.slug}`,
    label: `${m.makeName} ${m.name} in ${state.city!.name}`,
    href: buildPath({
      vertical: state.vertical,
      model: { id: m.id, slug: m.slug, name: m.name, makeSlug: m.makeSlug },
      city: state.city,
    }),
    count: m.n,
  }));
}

async function topCities(state: FacetState): Promise<LinkItem[]> {
  if (state.city || state.model || state.make) return [];

  const rows = await db
    .select({
      id: cities.id,
      slug: cities.slug,
      name: cities.name,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(listings)
    .innerJoin(cities, eq(listings.cityId, cities.id))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.vertical, state.vertical),
      ),
    )
    .groupBy(cities.id, cities.slug, cities.name)
    .having(sql`COUNT(*) >= ${MIN_LISTINGS_FOR_INDEXABLE_PAGE}`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(12);

  const noun = state.vertical === "bike" ? "Bikes" : state.vertical === "part" ? "Parts" : "Cars";

  return rows.map((c) => ({
    key: `topcity-${c.slug}`,
    label: `${noun} in ${c.name}`,
    href: buildPath({
      vertical: state.vertical,
      city: { id: c.id, slug: c.slug, name: c.name },
    }),
    count: c.n,
  }));
}

export async function RelatedLinks({ state }: { state: FacetState }) {
  const [byCity, byModel, popular, top] = await Promise.all([
    citiesForModel(state),
    modelsForMake(state),
    popularInCity(state),
    topCities(state),
  ]);

  const sections: { title: string; items: LinkItem[] }[] = [
    { title: `${state.model?.name ?? ""} by city`, items: byCity },
    { title: `More from ${state.make?.name ?? ""}`, items: byModel },
    { title: `Popular in ${state.city?.name ?? ""}`, items: popular },
    { title: "Browse by city", items: top },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="mt-10 border-t border-slate-200 pt-6">
      {sections.map((s) => (
        <section key={s.title} className="mb-6 last:mb-0">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            {s.title}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {s.items.map((l) => (
              <li key={l.key}>
                <Link
                  href={l.href}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-300 hover:text-blue-700"
                >
                  {l.label}
                  <span className="text-slate-400">{l.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
