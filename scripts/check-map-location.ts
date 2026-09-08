import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { approximateCoordinate, listingCoordinates } from "../src/lib/listings/location";

assert.equal(approximateCoordinate(31.5204), 31.525);
assert.deepEqual(listingCoordinates(), { exactLatitude: null, exactLongitude: null, approximateLatitude: null, approximateLongitude: null });
assert.deepEqual(listingCoordinates(31.5204, 74.3587), { exactLatitude: 31.5204, exactLongitude: 74.3587, approximateLatitude: 31.525, approximateLongitude: 74.35 });
const detail = await readFile(new URL("../src/lib/listings/detail.ts", import.meta.url), "utf8");
assert.ok(detail.includes("approximateLatitude: listings.approximateLatitude"));
assert.ok(!detail.includes("exactLatitude: listings.exactLatitude"), "Public detail must not select the exact pin");
const detailView = await readFile(new URL("../src/components/ListingDetail.tsx", import.meta.url), "utf8");
assert.ok(detailView.includes("https://maps.google.com/maps"), "Public approximate location must use Google Maps");
const startup = await readFile(new URL("../start-dev.ps1", import.meta.url), "utf8");
assert.ok(startup.includes("db:repair:map-location"), "Startup must repair local map schema drift");
for (const form of ["SellForm.tsx", "bike/BikeSellForm.tsx", "part/PartSellForm.tsx"]) {
  const source = await readFile(new URL(`../src/app/sell/${form}`, import.meta.url), "utf8");
  assert.ok(source.includes("<MapLocationPicker"), `${form} must expose the map picker`);
}
const picker = await readFile(new URL("../src/components/MapLocationPicker.tsx", import.meta.url), "utf8");
assert.ok(picker.includes("maps.googleapis.com/maps/api/js"), "Picker must load Google Maps JavaScript API");
assert.ok(!picker.includes("openstreetmap"), "Picker must not use the previous map provider");
console.log("Map-location privacy checks passed.");
