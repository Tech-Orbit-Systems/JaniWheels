import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings, partDetails } from "@/db/schema/listings";
import { makes, partCategories } from "@/db/schema/taxonomy";
import { publicListingEligibility } from "./public-eligibility";

export async function getPartFilterOptions() {
  const [categoryRows, makeRows, cityRows, brandRows] = await Promise.all([
    db.select({
      id: partCategories.id,
      name: partCategories.name,
      slug: partCategories.slug,
      parentId: partCategories.parentId,
    }).from(partCategories).orderBy(desc(partCategories.popularity), asc(partCategories.name)),
    db.select({ id: makes.id, name: makes.name, vertical: makes.vertical })
      .from(makes).where(eq(makes.isActive, true))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db.select({ id: cities.id, name: cities.name, slug: cities.slug })
      .from(cities).orderBy(desc(cities.popularity), asc(cities.name)),
    db.selectDistinct({ brand: partDetails.brand })
      .from(partDetails)
      .innerJoin(listings, eq(partDetails.listingId, listings.id))
      .where(and(publicListingEligibility(), sql`${partDetails.brand} IS NOT NULL`))
      .orderBy(asc(partDetails.brand)),
  ]);

  const byId = new Map(categoryRows.map((category) => [category.id, category]));
  const parents = new Set(categoryRows.map((category) => category.parentId).filter((id): id is number => id !== null));
  const categories = categoryRows.filter((category) => !parents.has(category.id)).map((category) => {
    const names = [category.name];
    let parentId = category.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return { id: category.id, slug: category.slug, name: category.name, label: names.join(" › ") };
  }).sort((a, b) => a.label.localeCompare(b.label));

  return {
    categories,
    makes: makeRows.map((make) => ({ id: make.id, name: `${make.name} (${make.vertical === "bike" ? "Bike" : "Car"})` })),
    cities: cityRows,
    brands: brandRows.map((row) => row.brand).filter((brand): brand is string => Boolean(brand)),
  };
}
