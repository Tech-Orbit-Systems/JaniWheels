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
  bigserial,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sellerTypeEnum } from "./enums";
import { cities } from "./geo";

/**
 * Accounts may originate from Google or verified email/password registration.
 * A mobile number is optional for buyers and required at the seller boundary.
 * SMS OTP remains outside V1, so an entered number must never be presented as
 * verified unless phoneVerifiedAt is populated by a future signed feature.
 */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /** E.164, always stored normalized: +923001234567 */
    phone: text("phone"),
    passwordHash: text("password_hash"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    name: text("name"),
    email: text("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
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
    closedAt: timestamp("closed_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    closureState: jsonb("closure_state"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    recoveryOnly: boolean("recovery_only").notNull().default(false),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Provider subjects are the stable identity key; provider emails may change. */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    providerEmail: text("provider_email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_accounts_provider_subject_uq").on(
      t.provider,
      t.providerSubject,
    ),
    uniqueIndex("auth_accounts_user_provider_uq").on(t.userId, t.provider),
    index("auth_accounts_user_idx").on(t.userId),
  ],
);

/** Email links are short-lived bearer credentials; only SHA-256 hashes persist. */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_verification_tokens_hash_uq").on(t.tokenHash),
    index("email_verification_tokens_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    index("email_verification_tokens_expiry_idx").on(t.expiresAt),
  ],
);

/**
 * Password-reset links are random bearer credentials. Only their SHA-256
 * digest is retained, so a database leak cannot be turned into working reset
 * links. Rows are single-use and short-lived.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: text("requested_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_hash_uq").on(t.tokenHash),
    index("password_reset_tokens_user_created_idx").on(t.userId, t.createdAt),
    index("password_reset_tokens_expiry_idx").on(t.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  dealer: one(dealers, { fields: [users.id], references: [dealers.userId] }),
  sessions: many(sessions),
  authAccounts: many(authAccounts),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, {
    fields: [authAccounts.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const dealersRelations = relations(dealers, ({ one }) => ({
  user: one(users, { fields: [dealers.userId], references: [users.id] }),
  city: one(cities, { fields: [dealers.cityId], references: [cities.id] }),
}));
