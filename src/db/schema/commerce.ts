import {
  pgTable,
  serial,
  bigserial,
  integer,
  smallint,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { verticalEnum, orderStatusEnum } from "./enums";
import { users, dealers } from "./users";
import { listings } from "./listings";

/**
 * MONETIZATION
 *
 * Three revenue shapes, in the order you should build them:
 *
 *  1. adPackages   — per-listing promotion. Immediate cash, no sales team.
 *  2. dealerPlans  — recurring subscription. The real business.
 *  3. services     — inspection / sell-it-for-me. Highest margin, but it is
 *                    a logistics operation, not a software feature.
 */

export const adPackages = pgTable(
  "ad_packages",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** NULL = applies to every vertical. */
    vertical: verticalEnum("vertical"),
    pricePkr: integer("price_pkr").notNull(),
    /** How long the listing stays live. */
    durationDays: smallint("duration_days").notNull().default(30),
    /** How long it carries the FEATURED badge and top placement. */
    featuredDays: smallint("featured_days").notNull().default(0),
    /** Number of manual "bump to top" actions included. */
    bumpCount: smallint("bump_count").notNull().default(0),
    photoLimit: smallint("photo_limit").notNull().default(10),
    /** Cross-promotion to the app / homepage carousel. */
    homepageSlot: boolean("homepage_slot").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("ad_packages_slug_uq").on(t.slug)],
);

export const dealerPlans = pgTable(
  "dealer_plans",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    monthlyPricePkr: integer("monthly_price_pkr").notNull(),
    listingQuota: integer("listing_quota").notNull(),
    featuredQuota: smallint("featured_quota").notNull().default(0),
    /** Bulk CSV/XLSX upload — the feature dealers actually pay for. */
    bulkUpload: boolean("bulk_upload").notNull().default(false),
    brandedStorefront: boolean("branded_storefront").notNull().default(false),
    leadAnalytics: boolean("lead_analytics").notNull().default(false),
    prioritySupport: boolean("priority_support").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("dealer_plans_slug_uq").on(t.slug)],
);

export const dealerSubscriptions = pgTable(
  "dealer_subscriptions",
  {
    id: serial("id").primaryKey(),
    dealerId: integer("dealer_id")
      .notNull()
      .references(() => dealers.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => dealerPlans.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dealer_subs_dealer_idx").on(t.dealerId),
    index("dealer_subs_active_idx").on(t.endsAt),
  ],
);

/**
 * Lead capture for the adjacent services — finance, insurance, registration,
 * ownership transfer.
 *
 * These are pure lead-gen: a bank or insurer pays per qualified enquiry, and
 * the marketplace never touches the money or the underwriting. Deliberately
 * one table with a `type` discriminator rather than four near-identical ones,
 * because the shape genuinely is the same (who, where, what car, how much).
 */
export const serviceEnquiries = pgTable(
  "service_enquiries",
  {
    id: serial("id").primaryKey(),
    /** finance | insurance | registration | transfer | import */
    type: text("type").notNull(),
    userId: integer("user_id").references(() => users.id),
    listingId: integer("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    cityId: integer("city_id"),
    /** Type-specific payload: loan amount, tenure, vehicle value, etc. */
    details: jsonb("details"),
    /** new | contacted | qualified | converted | dropped */
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_enquiries_type_idx").on(t.type, t.status, t.createdAt),
    index("service_enquiries_phone_idx").on(t.phone),
  ],
);

/**
 * A purchased promotion, applied to one listing.
 *
 * Separate from `orders` because an order is a payment record (immutable
 * once paid) while a promotion is consumable state — bumps get used up, the
 * featured window elapses. Conflating them means either mutating payment
 * history or losing track of what the seller actually still owns.
 */
export const listingPromotions = pgTable(
  "listing_promotions",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id),
    adPackageId: integer("ad_package_id")
      .notNull()
      .references(() => adPackages.id),

    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    bumpsTotal: smallint("bumps_total").notNull().default(0),
    bumpsUsed: smallint("bumps_used").notNull().default(0),
    homepageSlot: boolean("homepage_slot").notNull().default(false),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("listing_promotions_listing_idx").on(t.listingId, t.expiresAt),
    index("listing_promotions_order_idx").on(t.orderId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Human-readable, shown on receipts: AB-2026-000123 */
    reference: text("reference").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /**
     * `set null`, never cascade. An order is a financial record: if the
     * listing it paid for is deleted, the payment still happened and must
     * remain auditable. Cascading here would quietly erase revenue history
     * every time someone removed an ad.
     */
    listingId: integer("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    adPackageId: integer("ad_package_id").references(() => adPackages.id),
    dealerPlanId: integer("dealer_plan_id").references(() => dealerPlans.id),

    amountPkr: integer("amount_pkr").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),

    /** jazzcash | easypaisa | bank_transfer | cash */
    gateway: text("gateway"),
    gatewayRef: text("gateway_ref"),
    /** Raw gateway callback, kept verbatim for dispute resolution. */
    gatewayPayload: jsonb("gateway_payload"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_reference_uq").on(t.reference),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status, t.createdAt),
  ],
);
