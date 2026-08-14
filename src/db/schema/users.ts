import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  smallint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sellerTypeEnum } from "./enums";
import { cities } from "./geo";

/**
 * Accounts use a mobile number and password. SMS OTP is intentionally not
 * part of V1; phone verification is handled through the manual trust flow.
 */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /** E.164, always stored normalized: +923001234567 */
    phone: text("phone").notNull(),
    passwordHash: text("password_hash"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    name: text("name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    type: sellerTypeEnum("type").notNull().default("individual"),
    /** Soft trust score — raised by verified sales, lowered by reports. */
    trustScore: smallint("trust_score").notNull().default(50),
    isBanned: boolean("is_banned").notNull().default(false),
    /**
     * Staff flag for the moderation queue. A boolean rather than a role
     * system because there is exactly one privileged capability today;
     * inventing an RBAC layer for it would be architecture for its own sake.
     */
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_phone_uq").on(t.phone),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_type_idx").on(t.type),
  ],
);

/**
 * Dealer profiles and storefronts are included in V1. Billing, paid
 * placement, subscriptions and automatic inventory imports are not.
 */
export const dealers = pgTable(
  "dealers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    businessName: text("business_name").notNull(),
    slug: text("slug").notNull(),
    cityId: integer("city_id")
      .notNull()
      .references(() => cities.id),
    address: text("address"),
    logoUrl: text("logo_url"),
    about: text("about"),
    /** Showroom landline, shown alongside the mobile number. */
    landline: text("landline"),
    whatsapp: text("whatsapp"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Cached count so dealer listing pages don't COUNT(*) on every render. */
    activeListingCount: integer("active_listing_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("dealers_slug_uq").on(t.slug),
    uniqueIndex("dealers_user_uq").on(t.userId),
    index("dealers_city_idx").on(t.cityId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random 32-byte token, hashed
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  dealer: one(dealers, { fields: [users.id], references: [dealers.userId] }),
  sessions: many(sessions),
}));

export const dealersRelations = relations(dealers, ({ one }) => ({
  user: one(users, { fields: [dealers.userId], references: [users.id] }),
  city: one(cities, { fields: [dealers.cityId], references: [cities.id] }),
}));
