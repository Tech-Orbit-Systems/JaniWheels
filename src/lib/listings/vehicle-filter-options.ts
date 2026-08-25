import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { features, makes } from "@/db/schema/taxonomy";
import type { Vertical } from "@/lib/seo/facets";
import { ENUM_VALUES } from "@/lib/seo/facets";

export async function getVehicleFilterOptions(vertical: Exclude<Vertical, "part">) {
  const [makeRows, cityRows, featureRows] = await Promise.all([
    db.select({ id: makes.id, name: makes.name, slug: makes.slug })
      .from(makes)
      .where(eq(makes.vertical, vertical))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db.select({ id: cities.id, name: cities.name, slug: cities.slug })
      .from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name)),
    db.select({ id: features.id, name: features.name, slug: features.slug })
      .from(features)
      .where(eq(features.vertical, vertical))
      .orderBy(asc(features.groupName), asc(features.name)),
  ]);
  return {
    makes: makeRows,
    cities: cityRows,
    // Only closed-registry feature slugs may enter canonical browse URLs.
    features: featureRows.filter(row => ENUM_VALUES.feature?.includes(row.slug)),
  };
}
