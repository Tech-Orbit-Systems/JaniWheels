/**
 * Seed runner:  npm run db:seed
 *
 * Idempotent — safe to re-run. Every insert uses onConflictDoNothing against
 * the natural-key unique indexes, so re-seeding after adding a model to
 * vehicles.ts inserts only the new rows.
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../index";
import {
  provinces,
  cities,
  areas,
  makes,
  models,
  variants,
  partCategories,
  features,
  adPackages,
  dealerPlans,
} from "../schema";
import { PROVINCES, CITIES, AREAS } from "./geo";
import {
  CAR_MAKES,
  BIKE_MAKES,
  PART_CATEGORIES,
  CAR_FEATURES,
  BIKE_FEATURES,
  type MakeSeed,
  type PartCategorySeed,
} from "./vehicles";
import { AD_PACKAGES, DEALER_PLANS } from "./commerce";
import slugify from "slugify";

function log(step: string, n: number) {
  console.log(`  ${step.padEnd(28)} ${String(n).padStart(5)}`);
}

/**
 * Bare URL segments (/used-cars/toyota-corolla/lahore) are resolved by
 * precedence: model -> make -> city. If a city ever shares a slug with a
 * make or model, one of them becomes unreachable and the bug is invisible
 * until someone notices a page 404ing months later.
 *
 * Fail the seed loudly rather than ship that.
 */
function assertNoSlugCollisions() {
  const citySlugs = new Set(CITIES.map((c) => c.slug));
  const collisions: string[] = [];

  for (const group of [CAR_MAKES, BIKE_MAKES]) {
    for (const mk of group) {
      if (citySlugs.has(mk.slug)) collisions.push(`make "${mk.slug}"`);
      for (const md of mk.models) {
        const full = `${mk.slug}-${md.slug}`;
        if (citySlugs.has(full)) collisions.push(`model "${full}"`);
      }
    }
  }

  // Province tokens are prefixed (pv_) so they cannot collide, but a
  // province slug matching a city slug would still confuse breadcrumbs.
  const provinceSlugs = new Set(PROVINCES.map((p) => p.slug));
  for (const c of CITIES) {
    if (provinceSlugs.has(c.slug) && c.slug !== "islamabad") {
      collisions.push(`city "${c.slug}" collides with a province slug`);
    }
  }

  if (collisions.length) {
    throw new Error(
      `Slug collisions would make URLs ambiguous:\n  - ${collisions.join("\n  - ")}`,
    );
  }
}

async function seedGeo() {
  console.log("\nGeography");

  const provinceRows = await db
    .insert(provinces)
    .values(PROVINCES)
    .onConflictDoNothing()
    .returning({ id: provinces.id, slug: provinces.slug });

  const allProvinces = provinceRows.length
    ? provinceRows
    : await db.select({ id: provinces.id, slug: provinces.slug }).from(provinces);

  const provinceId = new Map(allProvinces.map((p) => [p.slug, p.id]));
  log("provinces", allProvinces.length);

  const cityValues = CITIES.map((c) => {
    const pid = provinceId.get(c.province);
    if (!pid) throw new Error(`City ${c.slug}: unknown province ${c.province}`);
    return {
      slug: c.slug,
      name: c.name,
      provinceId: pid,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      popularity: c.popularity,
      isMajor: c.isMajor,
    };
  });

  await db.insert(cities).values(cityValues).onConflictDoNothing();
  const allCities = await db
    .select({ id: cities.id, slug: cities.slug })
    .from(cities);
  const cityId = new Map(allCities.map((c) => [c.slug, c.id]));
  log("cities", allCities.length);

  const areaValues = Object.entries(AREAS).flatMap(([citySlug, names]) => {
    const cid = cityId.get(citySlug);
    if (!cid) return [];
    return names.map((name) => ({
      cityId: cid,
      slug: slugify(name, { lower: true, strict: true }),
      name,
    }));
  });

  if (areaValues.length) {
    await db.insert(areas).values(areaValues).onConflictDoNothing();
  }
  log("areas", areaValues.length);
}

async function seedMakes(group: MakeSeed[], vertical: "car" | "bike") {
  let modelCount = 0;
  let variantCount = 0;

  for (const mk of group) {
    await db
      .insert(makes)
      .values({
        vertical,
        slug: mk.slug,
        name: mk.name,
        countryOfOrigin: mk.countryOfOrigin,
        popularity: mk.popularity,
      })
      .onConflictDoNothing();

    const [makeRow] = await db
      .select({ id: makes.id })
      .from(makes)
      .where(and(eq(makes.slug, mk.slug), eq(makes.vertical, vertical)))
      .limit(1);

    if (!makeRow) throw new Error(`Make ${mk.slug} not found after insert`);

    for (const md of mk.models) {
      await db
        .insert(models)
        .values({
          makeId: makeRow.id,
          vertical,
          slug: md.slug,
          name: md.name,
          fullSlug: `${mk.slug}-${md.slug}`,
          bodyType: md.bodyType ?? null,
          popularity: md.popularity,
        })
        .onConflictDoNothing();
      modelCount++;

      if (!md.variants?.length) continue;

      const [modelRow] = await db
        .select({ id: models.id })
        .from(models)
        .where(eq(models.fullSlug, `${mk.slug}-${md.slug}`))
        .limit(1);

      if (!modelRow) continue;

      await db
        .insert(variants)
        .values(
          md.variants.map((v) => ({
            modelId: modelRow.id,
            slug: v.slug,
            name: v.name,
            engineCc: v.engineCc ?? null,
            transmission: v.transmission ?? null,
            fuel: v.fuel ?? null,
            bodyType: v.bodyType ?? null,
            yearFrom: v.yearFrom ?? null,
            yearTo: v.yearTo ?? null,
          })),
        )
        .onConflictDoNothing();
      variantCount += md.variants.length;
    }
  }

  log(`${vertical} makes`, group.length);
  log(`${vertical} models`, modelCount);
  log(`${vertical} variants`, variantCount);
}

async function seedPartCategories() {
  let count = 0;

  async function insertTree(
    nodes: PartCategorySeed[],
    parentId: number | null,
    parentPath: string,
  ) {
    for (const node of nodes) {
      const fullSlug = parentPath ? `${parentPath}/${node.slug}` : node.slug;

      await db
        .insert(partCategories)
        .values({
          parentId,
          slug: node.slug,
          name: node.name,
          fullSlug,
          popularity: node.popularity,
        })
        .onConflictDoNothing();
      count++;

      if (node.children?.length) {
        const [row] = await db
          .select({ id: partCategories.id })
          .from(partCategories)
          .where(eq(partCategories.fullSlug, fullSlug))
          .limit(1);
        if (row) await insertTree(node.children, row.id, fullSlug);
      }
    }
  }

  await insertTree(PART_CATEGORIES, null, "");
  log("part categories", count);
}

async function seedFeatures() {
  const values = [
    ...CAR_FEATURES.map((f) => ({ ...f, vertical: "car" as const })),
    ...BIKE_FEATURES.map((f) => ({ ...f, vertical: "bike" as const })),
  ].map((f) => ({
    vertical: f.vertical,
    slug: f.slug,
    name: f.name,
    groupName: f.groupName,
    isIndexableFacet: f.isIndexableFacet ?? false,
  }));

  await db.insert(features).values(values).onConflictDoNothing();
  log("features", values.length);
}

async function seedCommerce() {
  await db
    .insert(adPackages)
    .values(AD_PACKAGES.map((p) => ({ ...p, vertical: p.vertical ?? null })))
    .onConflictDoNothing();
  log("ad packages", AD_PACKAGES.length);

  await db.insert(dealerPlans).values(DEALER_PLANS).onConflictDoNothing();
  log("dealer plans", DEALER_PLANS.length);
}

async function main() {
  console.log("Seeding AutoBazaar\n" + "=".repeat(40));

  assertNoSlugCollisions();
  console.log("Slug collision check passed.");

  await seedGeo();

  console.log("\nTaxonomy");
  await seedMakes(CAR_MAKES, "car");
  await seedMakes(BIKE_MAKES, "bike");
  await seedPartCategories();
  await seedFeatures();

  console.log("\nCommerce");
  await seedCommerce();

  console.log("\nDone.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:\n", err);
  process.exit(1);
});
