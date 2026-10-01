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

const adLocalLabel = z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Keep this name under 80 characters.").optional();
const customFeatureNames = z.array(z.string().trim().min(2, "Enter at least 2 characters for each feature.").max(80, "Keep each feature under 80 characters.")).max(20, "Add no more than 20 custom features.").default([]);
const imageKeys = (emptyMessage: string) => z
  .array(z.string().regex(/^\d{6}\/[a-f0-9]{32}\.(?:jpg|png|webp|avif|heic)$/, "Upload the photo again."))
  .min(1, emptyMessage)
  .max(30, "Add no more than 30 photos.")
  .refine((keys) => new Set(keys).size === keys.length, "The same photo cannot be attached twice.");
const coordinates = {
  exactLatitude: z.number().min(-90, "Choose a valid map location.").max(90, "Choose a valid map location.").optional(),
  exactLongitude: z.number().min(-180, "Choose a valid map location.").max(180, "Choose a valid map location.").optional(),
};
function validateCoordinatePair(data: { exactLatitude?: number; exactLongitude?: number }, ctx: z.RefinementCtx) {
  if ((data.exactLatitude == null) !== (data.exactLongitude == null)) ctx.addIssue({ code: "custom", path: ["exactLatitude"], message: "Choose the location again on the map." });
}

export const carListingSchema = z.object({
  variantId: z.number().int("Choose the exact variant.").positive({
    message: "Choose the exact variant — it's what powers price comparisons.",
  }).optional(),
  customMakeName: adLocalLabel,
  customModelName: adLocalLabel,
  customVariantName: adLocalLabel,
  cityId: z.number().int("Choose a city.").positive("Choose a city."),
  areaId: z.number().int("Choose a valid area.").positive("Choose a valid area.").optional(),
  customCityName: adLocalLabel,
  customAreaName: adLocalLabel,
  ...coordinates,

  year: z
    .number()
    .int("Enter a whole model year.")
    .min(1970, "Model year looks too old.")
    .max(CURRENT_YEAR + 1, "Model year can't be in the future."),

  pricePkr: z
    .number()
    .int("Enter a whole price in PKR.")
    .min(50_000, "Price looks too low.")
    .max(500_000_000, "Price looks too high."),

  mileageKm: z
    .number()
    .int("Enter whole kilometres.")
    .min(0, "Mileage cannot be negative.")
    .max(1_000_000, "Mileage looks too high."),

  registeredCityId: z.number().int("Choose a valid registration city.").positive("Choose a valid registration city.").optional(),
  isUnregistered: z.boolean().default(false),

  assembly: z.enum(["local", "imported"], { message: "Choose local or imported assembly." }),
  color: z.string().trim().min(2, "Enter at least 2 characters for the color.").max(40, "Keep the color under 40 characters.").optional(),
  ownerCount: z.number().int("Enter a whole owner count.").min(1, "Owner count must be at least 1.").max(20, "Owner count looks too high.").optional(),
  lastTokenPaidYear: z.number().int("Enter a whole token year.").min(1990, "Token year looks too old.").max(CURRENT_YEAR, "Token year cannot be in the future.").optional(),

  hasAuctionSheet: z.boolean().default(false),
  auctionGrade: z.string().trim().max(10, "Keep the auction grade under 10 characters.").optional(),

  isNegotiable: z.boolean().default(false),

  description: z
    .string()
    .trim()
    .max(5000, "Description is too long.")
    .optional(),

  featureIds: z.array(z.number().int("Choose a valid feature.").positive("Choose a valid feature.")).max(60, "Choose no more than 60 features.").default([]),
  customFeatureNames,

  imageKeys: imageKeys("Add at least one photo — listings without photos barely sell."),
}).superRefine((data, ctx) => {
  validateCoordinatePair(data, ctx);
  if (!data.variantId && (!data.customMakeName || !data.customModelName)) {
    ctx.addIssue({ code: "custom", path: ["variantId"], message: "Choose a listed variant or enter the missing make and model." });
  }
  if (data.isUnregistered && data.registeredCityId) {
    ctx.addIssue({ code: "custom", path: ["registeredCityId"], message: "Remove the registration city for an unregistered car." });
  }
  if (data.isUnregistered && data.lastTokenPaidYear) {
    ctx.addIssue({ code: "custom", path: ["lastTokenPaidYear"], message: "Remove the token year for an unregistered car." });
  }
  if (!data.hasAuctionSheet && data.auctionGrade) {
    ctx.addIssue({ code: "custom", path: ["auctionGrade"], message: "Select auction sheet available before entering a grade." });
  }
});

export type CarListingInput = z.infer<typeof carListingSchema>;

export const bikeListingSchema = z
  .object({
    variantId: z.number().int("Choose the exact bike variant.").positive("Choose the exact bike variant.").optional(),
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
    condition: z.enum(["new", "used"], { message: "Choose the bike condition." }),
    isElectric: z.boolean(),
    cityId: z.number().int("Choose a city.").positive("Choose a city."),
    areaId: z.number().int("Choose a valid area.").positive("Choose a valid area.").optional(),
    customCityName: adLocalLabel,
    customAreaName: adLocalLabel,
    ...coordinates,
    registeredCityId: z.number().int("Choose a valid registration city.").positive("Choose a valid registration city.").optional(),
    isUnregistered: z.boolean().default(false),
    year: z.number().int("Enter a whole model year.").min(1970, "Model year looks too old.").max(CURRENT_YEAR + 1, "Model year cannot be in the future."),
    mileageKm: z.number().int("Enter whole kilometres.").min(0, "Mileage cannot be negative.").max(500_000, "Mileage looks too high."),
    pricePkr: z.number().int("Enter a whole price in PKR.").min(10_000, "Price looks too low.").max(50_000_000, "Price looks too high."),
    assembly: z.enum(["local", "imported"], { message: "Choose local or imported assembly." }),
    color: z.string().trim().min(2, "Enter at least 2 characters for the color.").max(40, "Keep the color under 40 characters.").optional(),
    hasDocuments: z.boolean().default(true),
    ignitionType: z.enum(["kick", "self", "kick-and-self"], { message: "Choose a valid ignition type." }).optional(),
    engineType: z.enum(["two-stroke", "four-stroke"], { message: "Choose a valid engine type." }).optional(),
    numberOfGears: z.number().int("Enter a whole gear count.").min(1, "Enter at least 1 gear.").max(8, "Gear count looks too high.").optional(),
    motorPowerWatts: z.number().int("Enter whole watts.").min(250, "Motor power looks too low.").max(50_000, "Motor power looks too high.").optional(),
    batteryType: z.enum(["lead-acid", "graphene", "lithium-ion", "lfp", "other"], { message: "Choose a valid battery type." }).optional(),
    batteryVoltage: z.number().int("Enter whole volts.").min(24, "Battery voltage looks too low.").max(120, "Battery voltage looks too high.").optional(),
    batteryCapacityAh: z.number().int("Enter whole amp hours.").min(5, "Battery capacity looks too low.").max(300, "Battery capacity looks too high.").optional(),
    claimedRangeKm: z.number().int("Enter whole kilometres.").min(5, "Range looks too low.").max(500, "Range looks too high.").optional(),
    topSpeedKph: z.number().int("Enter a whole speed.").min(10, "Top speed looks too low.").max(250, "Top speed looks too high.").optional(),
    chargingTimeMinutes: z.number().int("Enter whole minutes.").min(30, "Charging time looks too short.").max(1_440, "Charging time looks too long.").optional(),
    batteryHealthPercent: z.number().int("Enter a whole percentage.").min(1, "Battery health must be at least 1%.").max(100, "Battery health cannot exceed 100%.").optional(),
    batteryRemovable: z.boolean().optional(),
    chargerIncluded: z.boolean().optional(),
    batteryWarrantyMonths: z.number().int("Enter whole months.").min(0, "Warranty cannot be negative.").max(120, "Warranty looks too long.").optional(),
    isNegotiable: z.boolean().default(false),
    description: z.string().trim().max(5000, "Description is too long.").optional(),
    featureIds: z.array(z.number().int("Choose a valid feature.").positive("Choose a valid feature.")).max(40, "Choose no more than 40 features.").default([]),
    customFeatureNames,
    imageKeys: imageKeys("Add at least one bike photo."),
  })
  .superRefine((data, ctx) => {
    validateCoordinatePair(data, ctx);
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
  categoryId: z.number().int("Choose the most specific part category.").positive("Choose the most specific part category."),
  condition: z.enum(["new", "used", "refurbished"], {
    message: "Choose the part condition.",
  }),
  brand: z.string().trim().min(2, "Enter the part brand.").max(80, "Keep the brand under 80 characters."),
  partNumber: z.string().trim().max(100, "Keep the part number under 100 characters.").optional(),
  oemNumber: z.string().trim().max(100, "Keep the OEM number under 100 characters.").optional(),
  partOrigin: z.enum(["genuine-oem", "aftermarket", "local", "imported-used", "not-sure"], { message: "Choose the part origin." }),
  priceUnit: z.enum(["piece", "pair", "set", "kit", "litre"], { message: "Choose how this part is priced." }),
  compatibleMakeId: z.number().int("Choose a valid make.").positive("Choose a valid make.").optional(),
  compatibleModelId: z.number().int("Choose a valid model.").positive("Choose a valid model.").optional(),
  customCompatibleMakeName: adLocalLabel,
  customCompatibleModelName: adLocalLabel,
  compatibleYearFrom: z.number().int("Enter a whole starting year.").min(1970, "Starting year looks too old.").max(CURRENT_YEAR + 1, "Starting year cannot be in the future.").optional(),
  compatibleYearTo: z.number().int("Enter a whole ending year.").min(1970, "Ending year looks too old.").max(CURRENT_YEAR + 1, "Ending year cannot be in the future.").optional(),
  position: z.enum(["front", "rear", "left", "right", "front-left", "front-right", "rear-left", "rear-right", "not-applicable"], { message: "Choose a valid part position." }).optional(),
  deliveryOption: z.enum(["pickup", "courier", "pickup-or-courier"], { message: "Choose a delivery option." }),
  warrantyMonths: z.number().int("Enter whole months.").min(0, "Warranty cannot be negative.").max(120, "Warranty looks too long.").optional(),
  stockQty: z.number().int("Enter a whole stock quantity.").min(1, "Stock must be at least 1.").max(10_000, "Stock quantity looks too high."),
  cityId: z.number().int("Choose a city.").positive("Choose a city."),
  areaId: z.number().int("Choose a valid area.").positive("Choose a valid area.").optional(),
  customCityName: adLocalLabel,
  customAreaName: adLocalLabel,
  ...coordinates,
  customCategoryName: adLocalLabel,
  pricePkr: z.number().int("Enter a whole price in PKR.").min(500, "Price looks too low.").max(50_000_000, "Price looks too high."),
  isNegotiable: z.boolean().default(false),
  description: z.string().trim().max(5000, "Description is too long.").optional(),
  imageKeys: imageKeys("Add at least one photo."),
}).superRefine((data, ctx) => {
  validateCoordinatePair(data, ctx);
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
