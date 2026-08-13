import { z } from "zod";

/**
 * Listing input validation.
 *
 * Shared by the server action and (via safeParse) the client wizard, so the
 * rules exist once. Every bound here is a real market constraint, not a
 * guess — a 1960 model year or a 3-crore Mehran is almost always a typo or
 * bait, and catching it at entry is far cheaper than moderating it later.
 */

const CURRENT_YEAR = new Date().getFullYear();

export const carListingSchema = z.object({
  variantId: z.number().int().positive({
    message: "Choose the exact variant — it's what powers price comparisons.",
  }),
  cityId: z.number().int().positive("Choose a city."),
  areaId: z.number().int().positive().optional(),

  year: z
    .number()
    .int()
    .min(1970, "Model year looks too old.")
    .max(CURRENT_YEAR + 1, "Model year can't be in the future."),

  pricePkr: z
    .number()
    .int()
    .min(50_000, "Price looks too low.")
    .max(500_000_000, "Price looks too high."),

  mileageKm: z
    .number()
    .int()
    .min(0)
    .max(1_000_000, "Mileage looks too high."),

  registeredCityId: z.number().int().positive().optional(),
  isUnregistered: z.boolean().default(false),

  assembly: z.enum(["local", "imported"]),
  color: z.string().trim().min(2).max(40).optional(),
  ownerCount: z.number().int().min(1).max(20).optional(),
  lastTokenPaidYear: z.number().int().min(1990).max(CURRENT_YEAR).optional(),

  hasAuctionSheet: z.boolean().default(false),
  auctionGrade: z.string().trim().max(10).optional(),

  isNegotiable: z.boolean().default(false),

  description: z
    .string()
    .trim()
    .max(5000, "Description is too long.")
    .optional(),

  featureIds: z.array(z.number().int().positive()).max(60).default([]),

  imageKeys: z
    .array(z.string().min(1))
    .min(1, "Add at least one photo — listings without photos barely sell.")
    .max(30),
});

export type CarListingInput = z.infer<typeof carListingSchema>;

/**
 * Contact-detail scraping and off-platform redirection are the two things
 * that quietly kill a classifieds business: if sellers put their number in
 * the description, you stop being able to measure (or charge for) the lead.
 *
 * Strip rather than reject — a hard rejection just teaches sellers to write
 * "oh three double-oh" instead.
 */
const PHONE_LIKE = /(\+?92|0)?[\s-]?3\d{2}[\s-]?\d{7}/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_LIKE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;

export function sanitizeDescription(input: string): {
  text: string;
  strippedContact: boolean;
} {
  let strippedContact = false;

  const text = input
    .replace(PHONE_LIKE, () => {
      strippedContact = true;
      return "[contact removed]";
    })
    .replace(EMAIL_LIKE, () => {
      strippedContact = true;
      return "[contact removed]";
    })
    .replace(URL_LIKE, () => {
      strippedContact = true;
      return "[link removed]";
    })
    .trim();

  return { text, strippedContact };
}
