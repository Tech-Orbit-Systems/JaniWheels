import {
  pgTable,
  serial,
  bigserial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { reportReasonEnum } from "./enums";
import { listings } from "./listings";
import { users } from "./users";
import { cities } from "./geo";

/**
 * TRUST
 *
 * In a used-car market the binding constraint is not liquidity, it is
 * trust. Everything here exists to answer one buyer question: "is this
 * seller lying to me?"
 *
 * V1 captures inspection requests for manual follow-up. Inspector assignment,
 * workforce scheduling, scoring, reports and payments are intentionally out
 * of scope.
 */

export const inspections = pgTable(
  "inspections",
  {
    id: serial("id").primaryKey(),
    /** NULL when a buyer books an inspection on a car not listed here. */
    listingId: integer("listing_id").references(() => listings.id),
    requestedByUserId: integer("requested_by_user_id")
      .notNull()
      .references(() => users.id),

    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id),
    address: text("address"),
    contactPhone: text("contact_phone").notNull(),

    /** requested | contacted | cancelled */
    status: text("status").notNull().default("requested"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inspections_listing_idx").on(t.listingId),
    index("inspections_status_idx").on(t.status, t.createdAt),
    index("inspections_city_idx").on(t.cityId),
  ],
);

/**
 * Build the report queue BEFORE you have a spam problem. Curbstoning,
 * price-bait and stolen-vehicle listings arrive the week you get traction,
 * and a moderation backlog is very hard to dig out of.
 */
export const listingReports = pgTable(
  "listing_reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    reporterUserId: integer("reporter_user_id").references(() => users.id),
    reporterAnonId: text("reporter_anon_id"),
    reason: reportReasonEnum("reason").notNull(),
    comment: text("comment"),
    /** open | actioned | dismissed */
    status: text("status").notNull().default("open"),
    resolvedByUserId: integer("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("listing_reports_listing_idx").on(t.listingId),
    index("listing_reports_status_idx").on(t.status, t.createdAt),
    uniqueIndex("listing_reports_user_uq").on(
      t.listingId,
      t.reporterUserId,
    ),
    uniqueIndex("listing_reports_anon_uq").on(
      t.listingId,
      t.reporterAnonId,
    ),
  ],
);

/**
 * Every moderation decision, append-only. When a dealer calls to argue that
 * their listing was wrongly pulled, you need the record.
 */
export const moderationLog = pgTable(
  "moderation_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: integer("listing_id").references(() => listings.id),
    userId: integer("user_id").references(() => users.id),
    moderatorId: integer("moderator_id").references(() => users.id),
    /** approve | reject | remove | ban | unban | edit */
    action: text("action").notNull(),
    reason: text("reason"),
    /** Whether a rule engine or a human made the call. */
    isAutomated: boolean("is_automated").notNull().default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("moderation_log_listing_idx").on(t.listingId),
    index("moderation_log_created_idx").on(t.createdAt),
  ],
);
