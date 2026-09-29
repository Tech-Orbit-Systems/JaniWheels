import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const layout = await read("src/app/layout.tsx");
assert.ok(layout.includes('href="#main-content"'), "The shared layout must expose a keyboard skip link");
assert.ok(layout.includes('id="main-content"'), "The shared layout must expose the skip-link target");

const styles = await read("src/app/globals.css");
assert.match(styles, /overflow-x:\s*clip/, "The shared layout must protect narrow screens from horizontal overflow");
assert.match(styles, /:focus-visible/, "Interactive controls must retain a visible keyboard focus treatment");

const header = await read("src/components/SiteHeader.tsx");
assert.ok(header.includes("calc(100vw-2rem)"), "The mobile navigation must fit inside narrow viewports");
assert.ok(header.includes('aria-label="Mobile navigation"'), "The mobile navigation must have an accessible name");

const footer = await read("src/components/SiteFooter.tsx");
assert.ok(footer.includes("mailto:info@janiwheels.com"), "The footer must expose the official email address");
assert.ok(footer.includes("tel:+923333294075"), "The footer must expose the official call number");
assert.ok(footer.includes("https://wa.me/923333294075"), "The footer must expose the official WhatsApp number");

const featureMultiSelect = await read("src/components/FeatureMultiSelect.tsx");
assert.ok(featureMultiSelect.includes('name="featureIds"'), "The feature dropdown must submit every selected feature");
assert.ok(featureMultiSelect.includes("You can select more than one option."), "The feature dropdown must explain multiple selection");

for (const formPath of ["src/app/sell/SellForm.tsx", "src/app/sell/bike/BikeSellForm.tsx"]) {
  const form = await read(formPath);
  assert.ok(form.includes("<FeatureMultiSelect features={features} />"), `${formPath} must use the compact feature dropdown`);
}

const partForm = await read("src/app/sell/part/PartSellForm.tsx");
assert.ok(partForm.includes('name="categoryId"'), "The parts form must retain its taxonomy-backed category dropdown");

const homeSearch = await read("src/components/HomeSearch.tsx");
for (const bodyType of ["hatchback", "sedan", "suv", "crossover", "pickup", "van", "coupe", "wagon"]) {
  const image = await read(`public/home/body-types/${bodyType}.webp`);
  assert.ok(image.length > 1_000, `The ${bodyType} browse card must retain its own raster vehicle image`);
}
assert.ok(homeSearch.includes("/home/body-types/"), "Body-type cards must use raster images rather than inline SVG artwork");

const home = await read("src/app/page.tsx");
assert.ok(home.includes("CityLinkCollection"), "The home page must render visual city browse cards");
assert.ok(home.includes("MakeLinkCollection"), "The home page must render visual make browse cards");
assert.ok(home.includes("ModelLinkCollection"), "The home page must render visual model browse cards");

for (const cityImage of ["karachi-landmark", "lahore-landmark", "islamabad", "rawalpindi", "faisalabad", "multan", "peshawar", "gujranwala"]) {
  const image = await read(`public/home/cities/${cityImage}.webp`);
  assert.ok(image.length > 1_000, `The ${cityImage} visual must be a non-empty local image`);
}

for (const modelImage of ["toyota-corolla", "suzuki-alto-current", "honda-civic", "suzuki-cultus-current", "honda-city", "kia-sportage", "toyota-yaris-white", "suzuki-swift"]) {
  const image = await read(`public/home/models/${modelImage}.webp`);
  assert.ok(image.length > 1_000, `The ${modelImage} card must have its own local vehicle photo`);
}

const makeImageFiles = {
  suzuki: "suzuki-showroom-v2",
  toyota: "toyota-building",
  honda: "honda-building",
  kia: "kia-headquarters-v2",
  hyundai: "hyundai-showroom-v2",
  changan: "changan-showroom-v2",
  mg: "mg-building",
  nissan: "nissan-building",
};

for (const [make, imageFile] of Object.entries(makeImageFiles)) {
  const image = await read(`public/home/makes/${imageFile}.webp`);
  assert.ok(image.length > 1_000, `The ${make} make card must have a logo-visible building photo`);
}

assert.ok(!home.includes('haval:'), "The make grid must not claim an unavailable Haval visual");
assert.ok(home.includes('className="group relative block h-24'), "Model and city visual cards must share one fixed height");

console.log("Branding and responsive-shell checks passed.");
