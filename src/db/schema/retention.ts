import { pgTable, bigserial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

// IDs remain opaque references: deletion receipts never store customer payloads.
export const retentionReceipts = pgTable("retention_receipts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id").notNull(),
  action: text("action").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("retention_receipts_time_idx").on(t.occurredAt), uniqueIndex("retention_receipts_event_uq").on(t.resource,t.resourceId,t.action,t.occurredAt)]);

export const retentionIdentity = pgTable("retention_identity", {
  id: integer("id").primaryKey(),
  instanceId: text("instance_id").notNull(),
});

export const retentionHolds = pgTable("retention_holds", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id").notNull(),
  reason: text("reason").notNull(),
  responsible: text("responsible").notNull(),
  actorUserId: integer("actor_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
}, t => [index("retention_holds_resource_idx").on(t.resource, t.resourceId)]);

export const retentionMediaDeletions = pgTable("retention_media_deletions", {
  storageKey: text("storage_key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
});

export const retentionRuns = pgTable("retention_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  operator: text("operator").notNull(),
  mode: text("mode").notNull(),
  cutoff: timestamp("cutoff", { withTimezone: true }).notNull(),
  summary: jsonb("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const retentionMonthlyTotals = pgTable("retention_monthly_totals", {
  month: text("month").notNull(),
  type: text("type").notNull(),
  events: integer("events").notNull(),
}, t => [uniqueIndex("retention_monthly_totals_uq").on(t.month, t.type)]);
