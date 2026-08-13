import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Geography.
 *
 * Province -> City -> Area.
 *
 * `slug` is the URL segment and is immutable once published — city slugs
 * appear in indexed URLs (/used-cars/lahore), so renaming one costs you the
 * page's ranking history. If a name must change, keep the slug and change
 * only `name`.
 */

export const provinces = pgTable(
  "provinces",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Facet pages exist for provinces (pv_punjab on PakWheels). Only enable
    // for provinces with enough supply to justify an indexable page.
    isIndexable: boolean("is_indexable").notNull().default(true),
  },
  (t) => [uniqueIndex("provinces_slug_uq").on(t.slug)],
);

export const cities = pgTable(
  "cities",
  {
    id: serial("id").primaryKey(),
    provinceId: integer("province_id")
      .notNull()
      .references(() => provinces.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /**
     * Ranking weight for city pickers and "Popular Cities" modules.
     * Higher = shown first. Karachi/Lahore/Islamabad sit at 100.
     */
    popularity: integer("popularity").notNull().default(0),
    /**
     * Major cities get statically generated, indexable landing pages.
     * The long tail (PakWheels ships ~600 cities down to "Chak 4 b c")
     * stays crawlable but is not pre-rendered — otherwise your build time
     * and crawl budget both explode.
     */
    isMajor: boolean("is_major").notNull().default(false),
  },
  (t) => [
    uniqueIndex("cities_slug_uq").on(t.slug),
    index("cities_province_idx").on(t.provinceId),
    index("cities_popularity_idx").on(t.popularity),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("areas_city_slug_uq").on(t.cityId, t.slug),
    index("areas_city_idx").on(t.cityId),
  ],
);

export const provincesRelations = relations(provinces, ({ many }) => ({
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one, many }) => ({
  province: one(provinces, {
    fields: [cities.provinceId],
    references: [provinces.id],
  }),
  areas: many(areas),
}));

export const areasRelations = relations(areas, ({ one }) => ({
  city: one(cities, { fields: [areas.cityId], references: [cities.id] }),
}));
