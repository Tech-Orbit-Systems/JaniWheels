import {
  pgTable,
  serial,
  bigserial,
  integer,
  smallint,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { verticalEnum, leadTypeEnum } from "./enums";
import { listings } from "./listings";
import { users } from "./users";
import { cities } from "./geo";
import { makes, models, variants } from "./taxonomy";

/**
 * LEAD EVENTS — log these from the first day the site is live.
 *
 * A phone reveal is the moment your product created value. It is:
 *   - the north-star metric (leads per listing, not pageviews),
 *   - the evidence you show a dealer to justify a subscription price,
 *   - the input to ranking (listings that convert should surface higher),
 *   - the only honest way to price a "featured" slot.
 *
 * Sites that add this table in year two spend year two guessing.
 */
export const leadEvents = pgTable(
  "lead_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** NULL for anonymous visitors — most reveals will be anonymous. */
    userId: integer("user_id").references(() => users.id),
    anonId: text("anon_id"),
    type: leadTypeEnum("type").notNull(),
    /** search | detail | similar | dealer_page | featured_carousel */
    source: text("source"),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("lead_events_listing_idx").on(t.listingId, t.createdAt),
    index("lead_events_created_idx").on(t.createdAt),
    index("lead_events_type_idx").on(t.type, t.createdAt),
  ],
);

/**
 * Rolled up nightly from sold + active listings.
 *
 * This powers the single biggest gap in the incumbent's product: a
 * price-vs-market badge on every listing page. You already own the data the
 * moment you have volume; the only reason not to ship it is not having
 * somewhere to put it.
 */
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    vertical: verticalEnum("vertical").notNull(),
    makeId: integer("make_id").references(() => makes.id),
    modelId: integer("model_id").references(() => models.id),
    variantId: integer("variant_id").references(() => variants.id),
    year: smallint("year"),
    /** NULL = national figure. */
    cityId: integer("city_id").references(() => cities.id),

    p25Pkr: integer("p25_pkr").notNull(),
    p50Pkr: integer("p50_pkr").notNull(),
    p75Pkr: integer("p75_pkr").notNull(),
    sampleSize: integer("sample_size").notNull(),
    /** Median days between publish and sold, for "sells in ~N days". */
    medianDaysToSell: smallint("median_days_to_sell"),

    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("price_snapshots_key_uq").on(
      t.variantId,
      t.year,
      t.cityId,
      t.computedAt,
    ),
    index("price_snapshots_lookup_idx").on(t.variantId, t.year, t.cityId),
    index("price_snapshots_model_idx").on(t.modelId, t.year),
  ],
);

/**
 * Saved searches drive the retention loop: a buyer who saves
 * "Corolla, Lahore, under 40 lacs" gets an alert and comes back.
 * This is the cheapest repeat-visit mechanism a classifieds site has.
 */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    vertical: verticalEnum("vertical").notNull(),
    /** The parsed facet state, replayed against search on each run. */
    filters: jsonb("filters").notNull(),
    /** off | daily | instant */
    alertFrequency: text("alert_frequency").notNull().default("daily"),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

export const savedListings = pgTable(
  "saved_listings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_listings_uq").on(t.userId, t.listingId),
    index("saved_listings_user_idx").on(t.userId),
  ],
);

/**
 * Daily aggregate, not a row per view. A row per view on a classifieds site
 * is tens of millions of rows a month and buys you nothing you can't get
 * from the aggregate plus lead_events.
 */
export const listingViewsDaily = pgTable(
  "listing_views_daily",
  {
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    day: timestamp("day", { withTimezone: true, mode: "date" }).notNull(),
    views: integer("views").notNull().default(0),
    uniqueViews: integer("unique_views").notNull().default(0),
  },
  (t) => [uniqueIndex("listing_views_daily_uq").on(t.listingId, t.day)],
);
