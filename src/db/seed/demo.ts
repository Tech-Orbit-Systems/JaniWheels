/**
 * Demo listings:  npx tsx src/db/seed/demo.ts
 *
 * Development data only — never run this against production.
 *
 * It also computes price_snapshots afterwards, so the price-vs-market badge
 * has something to render. That badge deliberately shows nothing below eight
 * comparable sales, so the generator makes sure a few variant/year buckets
 * clear the threshold; otherwise you would look at an empty rail and assume
 * the feature was broken.
 */

import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import {
  listings,
  carDetails,
  bikeDetails,
  partDetails,
  listingFeatures,
} from "../schema/listings";
import { users } from "../schema/users";
import {
  makes,
  models,
  variants,
  partCategories,
  features,
} from "../schema/taxonomy";
import { cities } from "../schema/geo";
import { priceSnapshots } from "../schema/analytics";
import { buildListingSlug } from "../../lib/listings/slug";

const SELLER_PHONES = [
  "+923001234567",
  "+923219876543",
  "+923334455667",
  "+923455667788",
];

/** Rough current market anchors, in PKR, for a mid-year example of each. */
const PRICE_ANCHOR: Record<string, number> = {
  "toyota-corolla": 4_600_000,
  "honda-civic": 6_200_000,
  "honda-city": 4_100_000,
  "suzuki-alto": 2_450_000,
  "suzuki-cultus": 3_150_000,
  "suzuki-wagon-r": 2_900_000,
  "toyota-yaris": 4_300_000,
  "kia-sportage": 8_500_000,
  "hyundai-tucson": 8_900_000,
  "changan-alsvin": 3_900_000,
  "haval-jolion": 7_600_000,
  "toyota-vitz": 3_300_000,
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base: number, pct: number): number {
  const delta = base * pct * (Math.random() * 2 - 1);
  return Math.round((base + delta) / 10_000) * 10_000;
}

async function main() {
  console.log("Seeding demo listings\n" + "=".repeat(40));

  // --- demo sellers -------------------------------------------------------
  const sellerIds: number[] = [];
  for (const phone of SELLER_PHONES) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existing) {
      sellerIds.push(existing.id);
      continue;
    }
    const [row] = await db
      .insert(users)
      .values({ phone, name: "Demo Seller", phoneVerifiedAt: new Date() })
      .returning({ id: users.id });
    sellerIds.push(row.id);
  }
  console.log(`  sellers                       ${sellerIds.length}`);

  // Idempotency: wipe anything a previous run created, so re-running does not
  // pile up duplicates and skew the percentiles.
  const wiped = await db
    .delete(listings)
    .where(inArray(listings.sellerId, sellerIds))
    .returning({ id: listings.id });
  if (wiped.length) console.log(`  cleared previous demo ads     ${wiped.length}`);

  // --- variants to generate against ---------------------------------------
  const variantRows = await db
    .select({
      variantId: variants.id,
      variantName: variants.name,
      engineCc: variants.engineCc,
      transmission: variants.transmission,
      fuel: variants.fuel,
      variantBody: variants.bodyType,
      modelId: models.id,
      modelName: models.name,
      modelBody: models.bodyType,
      fullSlug: models.fullSlug,
      makeId: makes.id,
      makeName: makes.name,
    })
    .from(variants)
    .innerJoin(models, eq(variants.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(eq(models.vertical, "car"));

  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .where(eq(cities.isMajor, true));

  const targets = variantRows.filter((v) => PRICE_ANCHOR[v.fullSlug]);
  let created = 0;

  /**
   * Concentrate listings on a few model years rather than scattering them.
   *
   * getPricePosition keys on (variant, year) and refuses to render below
   * MIN_SAMPLE=8 comparables. Spreading N listings across nine years leaves
   * every bucket at one or two, so the badge correctly hides itself and the
   * feature looks broken in dev. Ten per year per variant clears the floor.
   */
  const FOCUS_YEARS = [2019, 2021, 2023];
  const PER_YEAR = 10;

  for (const v of targets) {
    const anchor = PRICE_ANCHOR[v.fullSlug];

    for (const year of FOCUS_YEARS) {
     for (let i = 0; i < PER_YEAR; i++) {
      const age = Math.max(0, 2026 - year);
      // Straight-line-ish depreciation, then noise for real spread.
      const base = anchor * Math.pow(0.92, age);
      const price = Math.max(500_000, jitter(base, 0.12));
      const city = pick(cityRows);
      const mileage = Math.round((age * 14_000 + Math.random() * 25_000) / 500) * 500;

      const slug = buildListingSlug({
        makeName: v.makeName,
        modelName: v.modelName,
        variantName: v.variantName,
        year,
        cityName: city.name,
      });

      const [row] = await db
        .insert(listings)
        .values({
          vertical: "car",
          sellerId: pick(sellerIds),
          slug,
          title: `${v.makeName} ${v.modelName} ${v.variantName} ${year}`,
          description:
            "Well maintained, original condition. Documents complete. Serious buyers only.",
          pricePkr: price,
          isNegotiable: Math.random() > 0.5,
          cityId: city.id,
          makeId: v.makeId,
          modelId: v.modelId,
          variantId: v.variantId,
          year,
          mileageKm: mileage,
          transmission: v.transmission,
          fuel: v.fuel,
          bodyType: v.variantBody ?? v.modelBody,
          engineCc: v.engineCc,
          assembly: "local",
          status: "active",
          publishedAt: new Date(),
          bumpedAt: new Date(Date.now() - Math.random() * 14 * 86_400_000),
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
          featuredUntil:
            Math.random() > 0.85
              ? new Date(Date.now() + 7 * 86_400_000)
              : null,
          inspectionScore:
            Math.random() > 0.8 ? 70 + Math.floor(Math.random() * 30) : null,
        })
        .returning({ id: listings.id });

      await db.insert(carDetails).values({
        listingId: row.id,
        color: pick(["White", "Silver", "Black", "Grey", "Blue"]),
        ownerCount: 1 + Math.floor(Math.random() * 3),
      });

      created++;
     }
    }
  }
  console.log(`  car listings                  ${created}`);

  // ---- bikes -------------------------------------------------------------
  const bikeAnchor: Record<string, number> = {
    "honda-cg-125": 265_000,
    "honda-cd-70": 158_000,
    "honda-pridor": 190_000,
    "honda-cb-150f": 420_000,
    "yamaha-ybr-125": 385_000,
    "yamaha-ybr-125g": 400_000,
    "suzuki-gs-150": 355_000,
    "suzuki-gd-110s": 340_000,
    "united-us-70": 118_000,
    "road-prince-rp-70": 115_000,
  };

  const bikeVariants = await db
    .select({
      variantId: variants.id,
      variantName: variants.name,
      engineCc: variants.engineCc,
      transmission: variants.transmission,
      fuel: variants.fuel,
      modelId: models.id,
      modelName: models.name,
      fullSlug: models.fullSlug,
      makeId: makes.id,
      makeName: makes.name,
    })
    .from(variants)
    .innerJoin(models, eq(variants.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(eq(models.vertical, "bike"));

  let bikesCreated = 0;
  for (const v of bikeVariants) {
    const anchor = bikeAnchor[v.fullSlug];
    if (!anchor) continue;

    for (const year of FOCUS_YEARS) {
      for (let i = 0; i < 4; i++) {
        const age = Math.max(0, 2026 - year);
        const price = Math.max(40_000, jitter(anchor * Math.pow(0.9, age), 0.12));
        const city = pick(cityRows);

        const [row] = await db
          .insert(listings)
          .values({
            vertical: "bike",
            sellerId: pick(sellerIds),
            slug: buildListingSlug({
              makeName: v.makeName,
              modelName: v.modelName,
              variantName: v.variantName,
              year,
              cityName: city.name,
            }),
            title: `${v.makeName} ${v.modelName} ${year}`,
            description: "Original condition, documents complete, well maintained.",
            pricePkr: price,
            cityId: city.id,
            makeId: v.makeId,
            modelId: v.modelId,
            variantId: v.variantId,
            year,
            mileageKm: Math.round((age * 6_000 + Math.random() * 8_000) / 500) * 500,
            fuel: v.fuel,
            engineCc: v.engineCc,
            status: "active",
            publishedAt: new Date(),
            bumpedAt: new Date(Date.now() - Math.random() * 10 * 86_400_000),
            expiresAt: new Date(Date.now() + 30 * 86_400_000),
          })
          .returning({ id: listings.id });

        await db.insert(bikeDetails).values({
          listingId: row.id,
          color: pick(["Red", "Black", "Blue", "Silver"]),
        });
        bikesCreated++;
      }
    }
  }
  console.log(`  bike listings                 ${bikesCreated}`);

  // ---- parts -------------------------------------------------------------
  const partAnchor: Record<string, number> = {
    "alloy-rims": 42_000,
    tyres: 16_500,
    "android-panels": 22_000,
    batteries: 19_500,
    "seat-covers": 8_500,
    "engine-oil": 4_800,
    "brake-pads": 5_500,
    "reverse-cameras": 6_500,
    lights: 12_000,
    "floor-mats": 3_800,
  };

  const catRows = await db
    .select({ id: partCategories.id, slug: partCategories.slug, name: partCategories.name })
    .from(partCategories);

  let partsCreated = 0;
  for (const cat of catRows) {
    const anchor = partAnchor[cat.slug];
    if (!anchor) continue;

    for (let i = 0; i < 8; i++) {
      const city = pick(cityRows);
      const condition = pick(["new", "used", "refurbished"] as const);
      const price = Math.max(
        500,
        jitter(anchor * (condition === "new" ? 1 : 0.65), 0.2),
      );

      const [row] = await db
        .insert(listings)
        .values({
          vertical: "part",
          sellerId: pick(sellerIds),
          slug: buildListingSlug({
            modelName: cat.name,
            cityName: city.name,
          }),
          title: `${cat.name} — ${condition === "new" ? "New" : "Used"}`,
          description: "Genuine part, ready for immediate pickup or delivery.",
          pricePkr: price,
          cityId: city.id,
          status: "active",
          publishedAt: new Date(),
          bumpedAt: new Date(Date.now() - Math.random() * 10 * 86_400_000),
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        })
        .returning({ id: listings.id });

      await db.insert(partDetails).values({
        listingId: row.id,
        categoryId: cat.id,
        condition,
        brand: pick(["Bosch", "Denso", "NGK", "Genuine", "Aftermarket"]),
        stockQty: 1 + Math.floor(Math.random() * 5),
      });
      partsCreated++;
    }
  }
  console.log(`  part listings                 ${partsCreated}`);

  // --- features -----------------------------------------------------------
  // Without these every feature facet page (/used-cars/ft_sunroof and
  // friends) is an indexable page with zero results, which is exactly the
  // thin page the whitelist is supposed to prevent.
  const featureRows = await db
    .select({ id: features.id, slug: features.slug })
    .from(features)
    .where(eq(features.vertical, "car"));

  const carListingIds = await db
    .select({ id: listings.id, year: listings.year })
    .from(listings)
    .where(and(eq(listings.vertical, "car"), eq(listings.status, "active")));

  const featureLinks: { listingId: number; featureId: number }[] = [];
  for (const l of carListingIds) {
    // Newer cars carry more kit — keeps the data plausible rather than random.
    const generosity = l.year && l.year >= 2020 ? 0.45 : 0.2;
    for (const f of featureRows) {
      if (Math.random() < generosity) {
        featureLinks.push({ listingId: l.id, featureId: f.id });
      }
    }
  }

  for (let i = 0; i < featureLinks.length; i += 1000) {
    await db
      .insert(listingFeatures)
      .values(featureLinks.slice(i, i + 1000))
      .onConflictDoNothing();
  }
  console.log(`  feature links                 ${featureLinks.length}`);

  // --- price snapshots ----------------------------------------------------
  // Percentiles per (variant, year), national. This is the nightly rollup the
  // price badge reads; running it here makes the feature visible in dev.
  await db.delete(priceSnapshots);

  const buckets = await db
    .select({
      variantId: listings.variantId,
      modelId: listings.modelId,
      makeId: listings.makeId,
      year: listings.year,
      n: sql<number>`COUNT(*)::int`,
      p25: sql<number>`PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p50: sql<number>`PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
      p75: sql<number>`PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${listings.pricePkr})::int`,
    })
    .from(listings)
    .where(and(eq(listings.vertical, "car"), eq(listings.status, "active")))
    .groupBy(listings.variantId, listings.modelId, listings.makeId, listings.year)
    .having(sql`COUNT(*) >= 3`);

  if (buckets.length) {
    await db.insert(priceSnapshots).values(
      buckets.map((b) => ({
        vertical: "car" as const,
        makeId: b.makeId,
        modelId: b.modelId,
        variantId: b.variantId,
        year: b.year,
        cityId: null,
        p25Pkr: b.p25,
        p50Pkr: b.p50,
        p75Pkr: b.p75,
        sampleSize: b.n,
      })),
    );
  }
  console.log(`  price snapshots               ${buckets.length}`);

  console.log("\nDone.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nDemo seed failed:\n", err);
  process.exit(1);
});
