import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { makes, models, partCategories } from "@/db/schema/taxonomy";
import { cities, provinces } from "@/db/schema/geo";
import type { EntityResolver, Vertical } from "./facets";

/**
 * DB-backed implementation of EntityResolver.
 *
 * Every lookup is wrapped in React's `cache` so that resolving the same
 * segment during generateMetadata and again during the page render costs one
 * query, not two. Facet routes hit these on every request, so they are also
 * the first thing to move behind Redis when traffic justifies it.
 */

const findModel = cache(async (slug: string, vertical: Vertical) => {
  const [row] = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      makeSlug: makes.slug,
    })
    .from(models)
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(
      and(
        eq(models.fullSlug, slug),
        eq(models.vertical, vertical as "car" | "bike"),
        eq(models.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
});

const findMake = cache(async (slug: string, vertical: Vertical) => {
  const [row] = await db
    .select({ id: makes.id, slug: makes.slug, name: makes.name })
    .from(makes)
    .where(
      and(
        eq(makes.slug, slug),
        eq(makes.vertical, vertical as "car" | "bike"),
        eq(makes.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
});

const findCity = cache(async (slug: string) => {
  const [row] = await db
    .select({ id: cities.id, slug: cities.slug, name: cities.name })
    .from(cities)
    .where(eq(cities.slug, slug))
    .limit(1);
  return row ?? null;
});

const findProvince = cache(async (slug: string) => {
  const [row] = await db
    .select({ id: provinces.id, slug: provinces.slug, name: provinces.name })
    .from(provinces)
    .where(and(eq(provinces.slug, slug), eq(provinces.isIndexable, true)))
    .limit(1);
  return row ?? null;
});

const findCategory = cache(async (slug: string) => {
  const [row] = await db
    .select({
      id: partCategories.id,
      slug: partCategories.slug,
      name: partCategories.name,
    })
    .from(partCategories)
    .where(eq(partCategories.slug, slug))
    .limit(1);
  return row ?? null;
});

export const dbResolver: EntityResolver = {
  modelByFullSlug: (slug, vertical) => findModel(slug, vertical),
  makeBySlug: (slug, vertical) => findMake(slug, vertical),
  cityBySlug: (slug) => findCity(slug),
  provinceBySlug: (slug) => findProvince(slug),
  categoryBySlug: (slug) => findCategory(slug),
};
