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

const adLocalLabel = z.string().trim().min(2, "Enter at least 2 characters.").max(80).optional();
const customFeatureNames = z.array(z.string().trim().min(2).max(80)).max(20).default([]);
const imageKeys = (emptyMessage: string) => z
  .array(z.string().regex(/^\d{6}\/[a-f0-9]{32}\.(?:jpg|png|webp|avif|heic)$/, "Upload the photo again."))
  .min(1, emptyMessage)
  .max(30)
  .refine((keys) => new Set(keys).size === keys.length, "The same photo cannot be attached twice.");

export const carListingSchema = z.object({
  variantId: z.number().int().positive({
    message: "Choose the exact variant — it's what powers price comparisons.",
  }).optional(),
  customMakeName: adLocalLabel,
  customModelName: adLocalLabel,
  customVariantName: adLocalLabel,
  cityId: z.number().int().positive("Choose a city."),
  areaId: z.number().int().positive().optional(),
  customCityName: adLocalLabel,
  customAreaName: adLocalLabel,

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
  customFeatureNames,

  imageKeys: imageKeys("Add at least one photo — listings without photos barely sell."),
}).superRefine((data, ctx) => {
  if (!data.variantId && (!data.customMakeName || !data.customModelName)) {
    ctx.addIssue({ code: "custom", path: ["variantId"], message: "Choose a listed variant or enter the missing make and model." });
  }
});

export type CarListingInput = z.infer<typeof carListingSchema>;

export const bikeListingSchema = z
  .object({
    variantId: z.number().int().positive("Choose the exact bike variant.").optional(),
    customMakeName: adLocalLabel,
    customModelName: adLocalLabel,
    customVariantName: adLocalLabel,
    bikeType: z.enum([
      "motorcycle",
      "sports",
      "cruiser",
      "trail",
      "scooter",
      "three-wheeler",
      "electric-motorcycle",
      "electric-scooter",
      "electric-bicycle",
    ]),
    condition: z.enum(["new", "used"]),
    isElectric: z.boolean(),
    cityId: z.number().int().positive("Choose a city."),
    areaId: z.number().int().positive().optional(),
    customCityName: adLocalLabel,
    customAreaName: adLocalLabel,
    registeredCityId: z.number().int().positive().optional(),
    isUnregistered: z.boolean().default(false),
    year: z.number().int().min(1970).max(CURRENT_YEAR + 1),
    mileageKm: z.number().int().min(0).max(500_000, "Mileage looks too high."),
    pricePkr: z.number().int().min(10_000).max(50_000_000),
    assembly: z.enum(["local", "imported"]),
    color: z.string().trim().min(2).max(40).optional(),
    hasDocuments: z.boolean().default(true),
    ignitionType: z.enum(["kick", "self", "kick-and-self"]).optional(),
    engineType: z.enum(["two-stroke", "four-stroke"]).optional(),
    numberOfGears: z.number().int().min(1).max(8).optional(),
    motorPowerWatts: z.number().int().min(250).max(50_000).optional(),
    batteryType: z.enum(["lead-acid", "graphene", "lithium-ion", "lfp", "other"]).optional(),
    batteryVoltage: z.number().int().min(24).max(120).optional(),
    batteryCapacityAh: z.number().int().min(5).max(300).optional(),
    claimedRangeKm: z.number().int().min(5).max(500).optional(),
    topSpeedKph: z.number().int().min(10).max(250).optional(),
    chargingTimeMinutes: z.number().int().min(30).max(1_440).optional(),
    batteryHealthPercent: z.number().int().min(1).max(100).optional(),
    batteryRemovable: z.boolean().optional(),
    chargerIncluded: z.boolean().optional(),
    batteryWarrantyMonths: z.number().int().min(0).max(120).optional(),
    isNegotiable: z.boolean().default(false),
    description: z.string().trim().max(5000, "Description is too long.").optional(),
    featureIds: z.array(z.number().int().positive()).max(40).default([]),
    customFeatureNames,
    imageKeys: imageKeys("Add at least one bike photo."),
  })
  .superRefine((data, ctx) => {
    if (!data.variantId && (!data.customMakeName || !data.customModelName)) {
      ctx.addIssue({ code: "custom", path: ["variantId"], message: "Choose a listed variant or enter the missing make and model." });
    }
    const electricType = data.bikeType.startsWith("electric-");
    if (data.isElectric !== electricType) {
      ctx.addIssue({ code: "custom", path: ["bikeType"], message: "Bike type and power source do not match." });
    }
    if (data.isElectric) {
      for (const [field, message] of [
        ["motorPowerWatts", "Enter the electric motor power."],
        ["batteryType", "Choose the battery type."],
        ["batteryVoltage", "Enter the battery voltage."],
        ["batteryCapacityAh", "Enter the battery capacity."],
        ["claimedRangeKm", "Enter the range per charge."],
        ["chargingTimeMinutes", "Enter the charging time."],
      ] as const) {
        if (data[field] == null) ctx.addIssue({ code: "custom", path: [field], message });
      }
    }
  });

export type BikeListingInput = z.infer<typeof bikeListingSchema>;

/** Validation for an Auto Parts advertisement. Categories and compatible
 * vehicles are controlled records, so buyers can reliably filter later. */
export const partListingSchema = z.object({
  categoryId: z.number().int().positive("Choose the most specific part category."),
  condition: z.enum(["new", "used", "refurbished"], {
    message: "Choose the part condition.",
  }),
  brand: z.string().trim().min(2, "Enter the part brand.").max(80),
  partNumber: z.string().trim().max(100).optional(),
  oemNumber: z.string().trim().max(100).optional(),
  partOrigin: z.enum(["genuine-oem", "aftermarket", "local", "imported-used", "not-sure"]),
  priceUnit: z.enum(["piece", "pair", "set", "kit", "litre"]),
  compatibleMakeId: z.number().int().positive().optional(),
  compatibleModelId: z.number().int().positive().optional(),
  customCompatibleMakeName: adLocalLabel,
  customCompatibleModelName: adLocalLabel,
  compatibleYearFrom: z.number().int().min(1970).max(CURRENT_YEAR + 1).optional(),
  compatibleYearTo: z.number().int().min(1970).max(CURRENT_YEAR + 1).optional(),
  position: z.enum(["front", "rear", "left", "right", "front-left", "front-right", "rear-left", "rear-right", "not-applicable"]).optional(),
  deliveryOption: z.enum(["pickup", "courier", "pickup-or-courier"]),
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  stockQty: z.number().int().min(1).max(10_000),
  cityId: z.number().int().positive("Choose a city."),
  areaId: z.number().int().positive().optional(),
  customCityName: adLocalLabel,
  customAreaName: adLocalLabel,
  customCategoryName: adLocalLabel,
  pricePkr: z.number().int().min(500, "Price looks too low.").max(50_000_000),
  isNegotiable: z.boolean().default(false),
  description: z.string().trim().max(5000, "Description is too long.").optional(),
  imageKeys: imageKeys("Add at least one photo."),
}).superRefine((data, ctx) => {
  if (data.compatibleYearFrom && data.compatibleYearTo && data.compatibleYearFrom > data.compatibleYearTo) {
    ctx.addIssue({ code: "custom", path: ["compatibleYearTo"], message: "The ending year must be after the starting year." });
  }
  if (data.compatibleModelId && !data.compatibleMakeId) {
    ctx.addIssue({ code: "custom", path: ["compatibleModelId"], message: "Choose a make before selecting a model." });
  }
  if (data.customCompatibleModelName && !data.customCompatibleMakeName) {
    ctx.addIssue({ code: "custom", path: ["customCompatibleModelName"], message: "Enter the compatible make as well." });
  }
});

export type PartListingInput = z.infer<typeof partListingSchema>;

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
