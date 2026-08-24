import { bikeListingSchema, carListingSchema, partListingSchema } from "../src/lib/listings/validation";

const imageKeys = ["202608/0123456789abcdef0123456789abcdef.webp"];
const validBike = {
  variantId: 1, bikeType: "motorcycle", condition: "used", isElectric: false,
  cityId: 1, year: 2024, mileageKm: 1200, pricePkr: 250000,
  assembly: "local", hasDocuments: true, ignitionType: "kick-and-self",
  engineType: "four-stroke", numberOfGears: 4, isNegotiable: true,
  featureIds: [], imageKeys,
};
const validElectricBike = {
  ...validBike, bikeType: "electric-scooter", isElectric: true,
  motorPowerWatts: 1500, batteryType: "lithium-ion", batteryVoltage: 72,
  batteryCapacityAh: 32, claimedRangeKm: 80, topSpeedKph: 55,
  chargingTimeMinutes: 360, chargerIncluded: true,
};
const validPart = {
  categoryId: 1, condition: "new", brand: "Denso", partOrigin: "genuine-oem",
  priceUnit: "piece", stockQty: 1, deliveryOption: "pickup", cityId: 1,
  pricePkr: 5000, isNegotiable: false, imageKeys,
};
const validCustomCar = {
  customMakeName: "Geely", customModelName: "CK", customVariantName: "1.3",
  customAreaName: "Village 12", cityId: 1, year: 2008, mileageKm: 140000,
  pricePkr: 900000, assembly: "imported", isUnregistered: false,
  hasAuctionSheet: false, isNegotiable: true, featureIds: [],
  customFeatureNames: ["Cassette changer"], imageKeys,
};

const checks = [
  ["petrol bike accepted", bikeListingSchema.safeParse(validBike).success],
  ["electric bike accepted", bikeListingSchema.safeParse(validElectricBike).success],
  ["electric bike requires battery data", !bikeListingSchema.safeParse({ ...validElectricBike, batteryVoltage: undefined }).success],
  ["bike type must match power source", !bikeListingSchema.safeParse({ ...validBike, bikeType: "electric-scooter" }).success],
  ["auto part accepted", partListingSchema.safeParse(validPart).success],
  ["part fitment year range validated", !partListingSchema.safeParse({ ...validPart, compatibleYearFrom: 2024, compatibleYearTo: 2020 }).success],
  ["ad-local car taxonomy accepted", carListingSchema.safeParse(validCustomCar).success],
  ["ad-local car requires make and model", !carListingSchema.safeParse({ ...validCustomCar, customModelName: undefined }).success],
  ["ad-local bike taxonomy accepted", bikeListingSchema.safeParse({ ...validBike, variantId: undefined, customMakeName: "Rare Bike", customModelName: "R1", customFeatureNames: ["Sidecar"] }).success],
  ["ad-local part compatibility accepted", partListingSchema.safeParse({ ...validPart, customCategoryName: "Vacuum valve", customCompatibleMakeName: "Geely", customCompatibleModelName: "CK" }).success],
  ["custom compatible model requires make", !partListingSchema.safeParse({ ...validPart, customCompatibleModelName: "CK" }).success],
  ["forged upload key rejected", !partListingSchema.safeParse({ ...validPart, imageKeys: ["../../secret.jpg"] }).success],
  ["duplicate upload key rejected", !partListingSchema.safeParse({ ...validPart, imageKeys: [imageKeys[0], imageKeys[0]] }).success],
] as const;

let failed = 0;
for (const [name, passed] of checks) {
  if (!passed) failed++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failed) process.exit(1);
