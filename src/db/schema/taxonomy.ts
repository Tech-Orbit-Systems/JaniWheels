import {
  pgTable,
  serial,
  integer,
  smallint,
  text,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  verticalEnum,
  bodyTypeEnum,
  transmissionEnum,
  fuelEnum,
} from "./enums";

/**
 * VEHICLE TAXONOMY — the single most important thing in this codebase.
 *
 *   Make -> Model -> Generation -> Variant
 *
 * Every listing hard-links to a `variant_id`. Users never type a make or
 * model as free text. This is not a UX preference, it is the load-bearing
 * decision of the whole product:
 *
 *   - Facet pages (/used-cars/toyota-corolla) need a stable entity to rank.
 *   - Price analytics need "2020 Corolla Altis 1.6" to mean one thing.
 *   - Comparison and "similar cars" need a graph, not a string.
 *
 * If "toyota corola" can ever enter the database, all three break, and no
 * amount of later cleanup fully repairs the URL history.
 *
 * Cars and bikes share these tables, discriminated by `vertical`. Parts use
 * `partCategories` instead and reference make/model for compatibility.
 */

export const makes = pgTable(
  "makes",
  {
    id: serial("id").primaryKey(),
    vertical: verticalEnum("vertical").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    countryOfOrigin: text("country_of_origin"), // powers the ctr_japanese facet
    popularity: integer("popularity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("makes_vertical_slug_uq").on(t.vertical, t.slug),
    index("makes_popularity_idx").on(t.popularity),
  ],
);

export const models = pgTable(
  "models",
  {
    id: serial("id").primaryKey(),
    makeId: integer("make_id")
      .notNull()
      .references(() => makes.id),
    vertical: verticalEnum("vertical").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /**
     * Full URL slug, denormalized: "toyota-corolla".
     * Kept on the row so facet routing resolves in one indexed lookup
     * instead of a join on every request.
     */
    fullSlug: text("full_slug").notNull(),
    bodyType: bodyTypeEnum("body_type"),
    popularity: integer("popularity").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("models_full_slug_uq").on(t.fullSlug),
    uniqueIndex("models_make_slug_uq").on(t.makeId, t.slug),
    index("models_make_idx").on(t.makeId),
    index("models_popularity_idx").on(t.popularity),
  ],
);

export const generations = pgTable(
  "generations",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => models.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(), // "11th Generation (E210)"
    yearFrom: smallint("year_from").notNull(),
    yearTo: smallint("year_to"), // null = still in production
  },
  (t) => [
    uniqueIndex("generations_model_slug_uq").on(t.modelId, t.slug),
    index("generations_model_idx").on(t.modelId),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => models.id),
    generationId: integer("generation_id").references(() => generations.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(), // "Altis Grande 1.8 CVT"
    engineCc: integer("engine_cc"),
    transmission: transmissionEnum("transmission"),
    fuel: fuelEnum("fuel"),
    bodyType: bodyTypeEnum("body_type"),
    yearFrom: smallint("year_from"),
    yearTo: smallint("year_to"),
    /** Manufacturer list price when new, for depreciation curves. */
    launchPricePkr: integer("launch_price_pkr"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("variants_model_slug_uq").on(t.modelId, t.slug),
    index("variants_model_idx").on(t.modelId),
    index("variants_generation_idx").on(t.generationId),
  ],
);

/**
 * Auto parts use a nested category tree instead of make/model.
 * Compatibility with vehicles is expressed separately on the listing.
 */
export const partCategories = pgTable(
  "part_categories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    fullSlug: text("full_slug").notNull(), // "exterior/alloy-rims"
    popularity: integer("popularity").notNull().default(0),
  },
  (t) => [
    uniqueIndex("part_categories_full_slug_uq").on(t.fullSlug),
    index("part_categories_parent_idx").on(t.parentId),
  ],
);

/**
 * Features are a controlled vocabulary too — "sunroof" must be one token,
 * because rf_sunroof is an indexable facet and a filter users actually use.
 */
export const features = pgTable(
  "features",
  {
    id: serial("id").primaryKey(),
    vertical: verticalEnum("vertical").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** exterior | interior | safety | comfort */
    groupName: text("group_name").notNull(),
    /** Whether this feature gets its own indexable facet page. */
    isIndexableFacet: boolean("is_indexable_facet").notNull().default(false),
  },
  (t) => [uniqueIndex("features_vertical_slug_uq").on(t.vertical, t.slug)],
);

export const makesRelations = relations(makes, ({ many }) => ({
  models: many(models),
}));

export const modelsRelations = relations(models, ({ one, many }) => ({
  make: one(makes, { fields: [models.makeId], references: [makes.id] }),
  generations: many(generations),
  variants: many(variants),
}));

export const generationsRelations = relations(generations, ({ one, many }) => ({
  model: one(models, {
    fields: [generations.modelId],
    references: [models.id],
  }),
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  model: one(models, { fields: [variants.modelId], references: [models.id] }),
  generation: one(generations, {
    fields: [variants.generationId],
    references: [generations.id],
  }),
}));
