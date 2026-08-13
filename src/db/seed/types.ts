/**
 * Seed-file value types.
 *
 * These mirror the pgEnum members in src/db/schema/enums.ts. They are
 * declared separately so seed data files can be type-checked without
 * importing the Drizzle schema (and therefore without needing a database
 * connection to lint them).
 *
 * If you add a member to an enum in enums.ts, add it here too — the seed
 * script will fail loudly at insert time otherwise.
 */

export type Transmission = "manual" | "automatic";

export type Fuel = "petrol" | "diesel" | "hybrid" | "electric" | "cng" | "lpg";

export type BodyType =
  | "hatchback"
  | "sedan"
  | "suv"
  | "crossover"
  | "van"
  | "pickup"
  | "mini_van"
  | "wagon"
  | "coupe"
  | "convertible"
  | "truck"
  | "mpv"
  | "micro_van"
  | "high_roof";

export type Vertical = "car" | "bike" | "part";
