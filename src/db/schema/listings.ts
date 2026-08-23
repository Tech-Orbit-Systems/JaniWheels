import {
  pgTable,
  serial,
  bigserial,
  integer,
  smallint,
  text,
  boolean,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  verticalEnum,
  listingStatusEnum,
  assemblyEnum,
  transmissionEnum,
  fuelEnum,
  bodyTypeEnum,
  partConditionEnum,
} from "./enums";
import { users, dealers } from "./users";
import { cities, areas } from "./geo";
import { makes, models, variants, partCategories, features } from "./taxonomy";

/**
 * LISTINGS
 *
 * One table for all three verticals, discriminated by `vertical`, plus a
 * per-vertical detail table for the fields that genuinely differ.
 *
 * The common facet columns (makeId, modelId, year, transmission, ...) are
 * DENORMALIZED onto this table on purpose. Search is the hottest path in the
 * product and every facet query would otherwise join three tables. The cost
 * is that the publish path must keep them in sync — that lives in one place,
 * `src/lib/listings/publish.ts`, and nowhere else.
 */

export const listings = pgTable(
  "listings",
  {
    /**
     * `serial`, not `bigserial`: every FK below declares `integer`, and
     * mixing int4/int8 across a foreign key works but costs you index-only
     * scans. 2.1 billion listings is not a constraint worth planning for.
     */
    id: serial("id").primaryKey(),
    vertical: verticalEnum("vertical").notNull(),

    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id),
    dealerId: integer("dealer_id").references(() => dealers.id),

    /**
     * Generated, keyword-rich, and mutable:
     *   "toyota-corolla-altis-grande-2020-for-sale-in-lahore"
     * The canonical URL is `${slug}-${id}`. Because the id resolves the row,
     * a changed slug 301s to the current one instead of 404ing.
     */
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    pricePkr: integer("price_pkr").notNull(),
    isNegotiable: boolean("is_negotiable").notNull().default(false),

    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id),
    areaId: integer("area_id").references(() => areas.id),
    /** Display-only city/town fallback; cityId remains the administrative facet. */
    customCityName: text("custom_city_name"),
    /** Seller-entered locality is display-only for this ad, never a geo facet. */
    customAreaName: text("custom_area_name"),

    status: listingStatusEnum("status").notNull().default("draft"),

    // ---- denormalized facet columns (cars + bikes) -----------------------
    makeId: integer("make_id").references(() => makes.id),
    modelId: integer("model_id").references(() => models.id),
    variantId: integer("variant_id").references(() => variants.id),
    /** Ad-local fallback labels. They never create or update taxonomy rows. */
    customMakeName: text("custom_make_name"),
    customModelName: text("custom_model_name"),
    customVariantName: text("custom_variant_name"),
    year: smallint("year"),
    mileageKm: integer("mileage_km"),
    transmission: transmissionEnum("transmission"),
    fuel: fuelEnum("fuel"),
    bodyType: bodyTypeEnum("body_type"),
    engineCc: integer("engine_cc"),
    assembly: assemblyEnum("assembly"),

    // ---- trust signals --------------------------------------------------
    // ---- counters (updated async, never in the request path) ------------
    viewCount: integer("view_count").notNull().default(0),
    leadCount: integer("lead_count").notNull().default(0),
    photoCount: smallint("photo_count").notNull().default(0),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * The workhorse index. Nearly every search is
     *   WHERE vertical=? AND status='active' AND make_id=? [AND model_id=?]
     *   ORDER BY published_at DESC
     * so the leading columns match that shape.
     */
    index("listings_search_idx").on(
      t.vertical,
      t.status,
      t.makeId,
      t.modelId,
      t.publishedAt,
    ),
    index("listings_city_idx").on(t.vertical, t.status, t.cityId, t.publishedAt),
    index("listings_price_idx").on(t.vertical, t.status, t.pricePkr),
    index("listings_year_idx").on(t.vertical, t.status, t.year),
    index("listings_seller_idx").on(t.sellerId),
    index("listings_dealer_idx").on(t.dealerId),
    index("listings_expiry_idx").on(t.status, t.expiresAt),
    /** Vehicle comparison and similar-listing queries use this tuple. */
    index("listings_pricing_idx").on(t.variantId, t.year, t.cityId),
  ],
);

/** Car-specific fields that don't belong on the shared row. */
export const carDetails = pgTable("car_details", {
  listingId: integer("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  registeredCityId: integer("registered_city_id").references(() => cities.id),
  /** "un-registered" is a real and important state in this market. */
  isUnregistered: boolean("is_unregistered").notNull().default(false),
  color: text("color"),
  /** Import auction sheet grade, for JDM imports. */
  auctionGrade: text("auction_grade"),
  hasAuctionSheet: boolean("has_auction_sheet").notNull().default(false),
  lastTokenPaidYear: smallint("last_token_paid_year"),
  ownerCount: smallint("owner_count"),
});

export const bikeDetails = pgTable("bike_details", {
  listingId: integer("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  registeredCityId: integer("registered_city_id").references(() => cities.id),
  isUnregistered: boolean("is_unregistered").notNull().default(false),
  color: text("color"),
  hasDocuments: boolean("has_documents").notNull().default(true),
  /** Motorcycle, scooter, trail, electric scooter, e-bike, etc. */
  bikeType: text("bike_type").notNull().default("motorcycle"),
  condition: text("condition").notNull().default("used"),
  ignitionType: text("ignition_type"),
  engineType: text("engine_type"),
  numberOfGears: smallint("number_of_gears"),
  /** Electric-only specifications. Null for combustion motorcycles. */
  motorPowerWatts: integer("motor_power_watts"),
  batteryType: text("battery_type"),
  batteryVoltage: smallint("battery_voltage"),
  batteryCapacityAh: integer("battery_capacity_ah"),
  claimedRangeKm: integer("claimed_range_km"),
  topSpeedKph: integer("top_speed_kph"),
  chargingTimeMinutes: integer("charging_time_minutes"),
  batteryHealthPercent: smallint("battery_health_percent"),
  batteryRemovable: boolean("battery_removable"),
  chargerIncluded: boolean("charger_included"),
  batteryWarrantyMonths: smallint("battery_warranty_months"),
});

export const partDetails = pgTable(
  "part_details",
  {
    listingId: integer("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => partCategories.id),
    condition: partConditionEnum("condition").notNull(),
    brand: text("brand"),
    /** Used only when the seller cannot find a suitable controlled leaf. */
    customCategoryName: text("custom_category_name"),
    partNumber: text("part_number"),
    oemNumber: text("oem_number"),
    partOrigin: text("part_origin"),
    priceUnit: text("price_unit").notNull().default("piece"),
    /** Vehicle compatibility — nullable because many parts are universal. */
    compatibleMakeId: integer("compatible_make_id").references(() => makes.id),
    compatibleModelId: integer("compatible_model_id").references(
      () => models.id,
    ),
    customCompatibleMakeName: text("custom_compatible_make_name"),
    customCompatibleModelName: text("custom_compatible_model_name"),
    compatibleYearFrom: smallint("compatible_year_from"),
    compatibleYearTo: smallint("compatible_year_to"),
    position: text("position"),
    deliveryOption: text("delivery_option").notNull().default("pickup"),
    warrantyMonths: smallint("warranty_months"),
    stockQty: integer("stock_qty").notNull().default(1),
  },
  (t) => [
    index("part_details_category_idx").on(t.categoryId),
    index("part_details_compat_idx").on(t.compatibleMakeId, t.compatibleModelId),
  ],
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** Provider key, not a full URL — lets you move CDN without a migration. */
    storageKey: text("storage_key").notNull(),
    position: smallint("position").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    /** Tiny placeholder so listing grids don't reflow on slow connections. */
    blurhash: text("blurhash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("listing_images_listing_idx").on(t.listingId, t.position)],
);

export const listingFeatures = pgTable(
  "listing_features",
  {
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    featureId: integer("feature_id")
      .notNull()
      .references(() => features.id),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.featureId] }),
    index("listing_features_feature_idx").on(t.featureId),
  ],
);

/** Free-text features belong to one ad and never become trusted filter facets. */
export const listingCustomFeatures = pgTable(
  "listing_custom_features",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [index("listing_custom_features_listing_idx").on(t.listingId)],
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  dealer: one(dealers, {
    fields: [listings.dealerId],
    references: [dealers.id],
  }),
  city: one(cities, { fields: [listings.cityId], references: [cities.id] }),
  make: one(makes, { fields: [listings.makeId], references: [makes.id] }),
  model: one(models, { fields: [listings.modelId], references: [models.id] }),
  variant: one(variants, {
    fields: [listings.variantId],
    references: [variants.id],
  }),
  car: one(carDetails, {
    fields: [listings.id],
    references: [carDetails.listingId],
  }),
  bike: one(bikeDetails, {
    fields: [listings.id],
    references: [bikeDetails.listingId],
  }),
  part: one(partDetails, {
    fields: [listings.id],
    references: [partDetails.listingId],
  }),
  images: many(listingImages),
  features: many(listingFeatures),
  customFeatures: many(listingCustomFeatures),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, {
    fields: [listingImages.listingId],
    references: [listings.id],
  }),
}));

export const listingFeaturesRelations = relations(
  listingFeatures,
  ({ one }) => ({
    listing: one(listings, {
      fields: [listingFeatures.listingId],
      references: [listings.id],
    }),
    feature: one(features, {
      fields: [listingFeatures.featureId],
      references: [features.id],
    }),
  }),
);

export const listingCustomFeaturesRelations = relations(
  listingCustomFeatures,
  ({ one }) => ({
    listing: one(listings, {
      fields: [listingCustomFeatures.listingId],
      references: [listings.id],
    }),
  }),
);
