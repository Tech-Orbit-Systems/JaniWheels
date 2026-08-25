import {
  pgTable,
  serial,
  bigserial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { verticalEnum, leadTypeEnum } from "./enums";
import { listings } from "./listings";
import { users } from "./users";

/**
 * LEAD EVENTS — log these from the first day the site is live.
 *
 * A phone reveal is the moment your product created value. It is:
 *   - the north-star metric (leads per listing, not pageviews),
 *   - the clearest measure of buyer interest for seller dashboards,
 *   - a useful operational signal for moderation and support.
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
    /** search | detail | similar | dealer_page */
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

/**
 * One row per saved-search/listing match. The unique key makes alert runs
 * retry-safe: a scheduler can repeat a job without emailing the same match
 * twice. Delivery is intentionally provider-agnostic for V1.
 */
export const savedSearchNotifications = pgTable(
  "saved_search_notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    savedSearchId: integer("saved_search_id")
      .notNull()
      .references(() => savedSearches.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    delivered: boolean("delivered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("saved_search_notifications_match_uq").on(
      t.savedSearchId,
      t.listingId,
    ),
    index("saved_search_notifications_delivery_idx").on(
      t.delivered,
      t.createdAt,
    ),
  ],
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
