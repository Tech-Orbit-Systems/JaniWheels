import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Shared enums.
 *
 * These live in their own module because Drizzle emits one CREATE TYPE per
 * pgEnum; if the same enum is declared in two schema files you get duplicate
 * type errors on migrate.
 */

export const verticalEnum = pgEnum("vertical", ["car", "bike", "part"]);

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending_review",
  "active",
  "sold",
  "expired",
  "rejected",
  "removed",
]);

export const sellerTypeEnum = pgEnum("seller_type", ["individual", "dealer"]);

export const assemblyEnum = pgEnum("assembly", ["local", "imported"]);

export const transmissionEnum = pgEnum("transmission", ["manual", "automatic"]);

export const fuelEnum = pgEnum("fuel", [
  "petrol",
  "diesel",
  "hybrid",
  "electric",
  "cng",
  "lpg",
]);

export const bodyTypeEnum = pgEnum("body_type", [
  "hatchback",
  "sedan",
  "suv",
  "crossover",
  "van",
  "pickup",
  "mini_van",
  "wagon",
  "coupe",
  "convertible",
  "truck",
  "mpv",
  "micro_van",
  "high_roof",
]);

export const partConditionEnum = pgEnum("part_condition", [
  "new",
  "used",
  "refurbished",
]);

export const leadTypeEnum = pgEnum("lead_type", [
  "phone_reveal",
  "whatsapp_click",
  "dealer_profile_click",
  "inspection_enquiry",
]);

export const reportReasonEnum = pgEnum("report_reason", [
  "sold",
  "fraud",
  "wrong_price",
  "wrong_category",
  "duplicate",
  "offensive",
  "spam",
  "other",
]);
