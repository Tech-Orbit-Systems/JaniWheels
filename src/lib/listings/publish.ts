import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  listings,
  carDetails,
  partDetails,
  listingImages,
  listingFeatures,
} from "@/db/schema/listings";
import { models, variants, makes, partCategories } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { buildListingSlug } from "./slug";
import {
  initialPublicationState,
  type ListingPublisher,
} from "./publication-policy";
import {
  sanitizeDescription,
  type CarListingInput,
  type PartListingInput,
} from "./validation";

/**
 * THE PUBLISH PATH
 *
 * `listings` carries denormalized facet columns (makeId, modelId, bodyType,
 * transmission, fuel, engineCc) copied down from the chosen variant, because
 * search would otherwise join three tables on the hottest query in the
 * product.
 *
 * The cost of that denormalization is a sync burden, and the schema comment
 * promises it lives in exactly one place. This is that place. If you find
 * yourself writing `UPDATE listings SET make_id` anywhere else, move it here
 * instead — a listing whose denormalized columns disagree with its variant
 * is invisible to the facet page it belongs on, and nothing surfaces the bug.
 */

const LISTING_TTL_DAYS = 30;

export interface PublishResult {
  listingId: number;
  slug: string;
  strippedContact: boolean;
}

export async function publishCarListing(
  sellerId: number,
  input: CarListingInput,
  opts: { dealerId?: number; publisher?: ListingPublisher } = {},
): Promise<PublishResult> {
  // ---- resolve the taxonomy row that everything else is derived from -----
  const [variant] = await db
    .select({
      variantId: variants.id,
      variantName: variants.name,
      engineCc: variants.engineCc,
      transmission: variants.transmission,
      fuel: variants.fuel,
      variantBodyType: variants.bodyType,
      modelId: models.id,
      modelName: models.name,
      modelBodyType: models.bodyType,
      makeId: makes.id,
      makeName: makes.name,
    })
    .from(variants)
    .innerJoin(models, eq(variants.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(eq(variants.id, input.variantId))
    .limit(1);

  if (!variant) throw new Error(`Unknown variant ${input.variantId}`);

  const [city] = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .where(eq(cities.id, input.cityId))
    .limit(1);

  if (!city) throw new Error(`Unknown city ${input.cityId}`);

  const { text: description, strippedContact } = sanitizeDescription(
    input.description ?? "",
  );

  const title = [
    variant.makeName,
    variant.modelName,
    variant.variantName,
    input.year,
  ]
    .filter(Boolean)
    .join(" ");

  const slug = buildListingSlug({
    makeName: variant.makeName,
    modelName: variant.modelName,
    variantName: variant.variantName,
    year: input.year,
    cityName: city.name,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LISTING_TTL_DAYS * 86_400_000);
  const publication = initialPublicationState(
    opts.publisher ?? "individual",
    now,
  );

  /**
   * All of this is one transaction. A listing that exists without its images,
   * or whose feature rows half-inserted, is worse than one that failed
   * outright — the seller sees it live and broken.
   */
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(listings)
      .values({
        vertical: "car",
        sellerId,
        dealerId: opts.dealerId ?? null,
        slug,
        title,
        description: description || null,
        pricePkr: input.pricePkr,
        isNegotiable: input.isNegotiable,
        cityId: input.cityId,
        areaId: input.areaId ?? null,

        // Denormalized from the variant — the single source of these values.
        makeId: variant.makeId,
        modelId: variant.modelId,
        variantId: variant.variantId,
        year: input.year,
        mileageKm: input.mileageKm,
        transmission: variant.transmission,
        fuel: variant.fuel,
        bodyType: variant.variantBodyType ?? variant.modelBodyType,
        engineCc: variant.engineCc,
        assembly: input.assembly,

        status: publication.status,
        photoCount: input.imageKeys.length,
        publishedAt: publication.publishedAt,
        expiresAt,
      })
      .returning({ id: listings.id });

    await tx.insert(carDetails).values({
      listingId: row.id,
      registeredCityId: input.registeredCityId ?? null,
      isUnregistered: input.isUnregistered,
      color: input.color ?? null,
      ownerCount: input.ownerCount ?? null,
      lastTokenPaidYear: input.lastTokenPaidYear ?? null,
      hasAuctionSheet: input.hasAuctionSheet,
      auctionGrade: input.auctionGrade ?? null,
    });

    // Guarded because Drizzle throws on `.values([])`.
    if (input.imageKeys.length) {
      await tx.insert(listingImages).values(
        input.imageKeys.map((key, i) => ({
          listingId: row.id,
          storageKey: key,
          position: i,
        })),
      );
    }

    if (input.featureIds.length) {
      await tx.insert(listingFeatures).values(
        input.featureIds.map((featureId) => ({
          listingId: row.id,
          featureId,
        })),
      );
    }

    return { listingId: row.id, slug, strippedContact };
  });
}

/** Publish a classified Auto Parts listing using the controlled category tree.
 * Part compatibility is optional because many genuine parts are universal. */
export async function publishPartListing(
  sellerId: number,
  input: PartListingInput,
  opts: { dealerId?: number; publisher?: ListingPublisher } = {},
): Promise<PublishResult> {
  const [category] = await db
    .select({ id: partCategories.id, name: partCategories.name })
    .from(partCategories)
    .where(eq(partCategories.id, input.categoryId))
    .limit(1);
  if (!category) throw new Error("Choose a valid part category.");

  const [city] = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .where(eq(cities.id, input.cityId))
    .limit(1);
  if (!city) throw new Error(`Unknown city ${input.cityId}`);

  if (input.compatibleModelId && input.compatibleMakeId) {
    const [model] = await db
      .select({ id: models.id })
      .from(models)
      .where(and(eq(models.id, input.compatibleModelId), eq(models.makeId, input.compatibleMakeId)))
      .limit(1);
    if (!model) throw new Error("The selected model does not belong to that make.");
  }

  const { text: description, strippedContact } = sanitizeDescription(input.description ?? "");
  const title = [input.brand, category.name, input.partNumber].filter(Boolean).join(" ");
  const slug = buildListingSlug({
    makeName: input.brand,
    modelName: category.name,
    variantName: input.partNumber,
    cityName: city.name,
  });
  const now = new Date();
  const publication = initialPublicationState(opts.publisher ?? "individual", now);
  const expiresAt = new Date(now.getTime() + LISTING_TTL_DAYS * 86_400_000);

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(listings).values({
      vertical: "part",
      sellerId,
      dealerId: opts.dealerId ?? null,
      slug,
      title,
      description: description || null,
      pricePkr: input.pricePkr,
      isNegotiable: input.isNegotiable,
      cityId: input.cityId,
      areaId: input.areaId ?? null,
      status: publication.status,
      photoCount: input.imageKeys.length,
      publishedAt: publication.publishedAt,
      expiresAt,
    }).returning({ id: listings.id });

    await tx.insert(partDetails).values({
      listingId: row.id,
      categoryId: category.id,
      condition: input.condition,
      brand: input.brand,
      partNumber: input.partNumber ?? null,
      compatibleMakeId: input.compatibleMakeId ?? null,
      compatibleModelId: input.compatibleModelId ?? null,
      warrantyMonths: input.warrantyMonths ?? null,
      stockQty: input.stockQty,
    });

    await tx.insert(listingImages).values(input.imageKeys.map((key, i) => ({
      listingId: row.id,
      storageKey: key,
      position: i,
    })));
    return { listingId: row.id, slug, strippedContact };
  });
}

/**
 * Re-syncs the denormalized columns after a variant change on edit.
 * Same rule as above: nothing else writes these columns.
 */
export async function resyncListingFacets(listingId: number): Promise<void> {
  const [row] = await db
    .select({ variantId: listings.variantId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row?.variantId) return;

  const [variant] = await db
    .select({
      engineCc: variants.engineCc,
      transmission: variants.transmission,
      fuel: variants.fuel,
      variantBodyType: variants.bodyType,
      modelId: models.id,
      modelBodyType: models.bodyType,
      makeId: makes.id,
    })
    .from(variants)
    .innerJoin(models, eq(variants.modelId, models.id))
    .innerJoin(makes, eq(models.makeId, makes.id))
    .where(eq(variants.id, row.variantId))
    .limit(1);

  if (!variant) return;

  await db
    .update(listings)
    .set({
      makeId: variant.makeId,
      modelId: variant.modelId,
      transmission: variant.transmission,
      fuel: variant.fuel,
      bodyType: variant.variantBodyType ?? variant.modelBodyType,
      engineCc: variant.engineCc,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));
}
