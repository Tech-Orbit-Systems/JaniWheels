import { bikeListingSchema, partListingSchema } from "../src/lib/listings/validation";

const imageKeys = ["uploads/test.webp"];
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

const checks = [
  ["petrol bike accepted", bikeListingSchema.safeParse(validBike).success],
  ["electric bike accepted", bikeListingSchema.safeParse(validElectricBike).success],
  ["electric bike requires battery data", !bikeListingSchema.safeParse({ ...validElectricBike, batteryVoltage: undefined }).success],
  ["bike type must match power source", !bikeListingSchema.safeParse({ ...validBike, bikeType: "electric-scooter" }).success],
  ["auto part accepted", partListingSchema.safeParse(validPart).success],
  ["part fitment year range validated", !partListingSchema.safeParse({ ...validPart, compatibleYearFrom: 2024, compatibleYearTo: 2020 }).success],
] as const;

let failed = 0;
for (const [name, passed] of checks) {
  if (!passed) failed++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}
if (failed) process.exit(1);
