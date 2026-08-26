import Link from "next/link";
import Image from "next/image";
import {
  formatPkrExact,
  formatMileage,
  formatEngine,
  maskPkPhone,
  relativeTime,
} from "@/lib/format";
import { buildPath } from "@/lib/seo/facets";
import { buildListingPath } from "@/lib/listings/slug";
import type { ListingDetailRow } from "@/lib/listings/detail";
import { getSimilarListings } from "@/lib/listings/detail";
import { PhoneReveal } from "./PhoneReveal";
import { ReportListing } from "./ReportListing";
import { ModerationActions } from "@/app/admin/moderation/ModerationActions";
import { BuyerListingActions } from "./BuyerListingActions";

function imageUrl(key: string, width: number): string {
  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? "local";
  if (provider === "cloudflare") {
    return `https://imagedelivery.net/${process.env.NEXT_PUBLIC_CF_IMAGES_HASH}/${key}/w=${width}`;
  }
  return `/uploads/${key}`;
}

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function ListingDetail({
  listing,
  isAdmin = false,
  initiallySaved = false,
}: {
  listing: ListingDetailRow;
  isAdmin?: boolean;
  initiallySaved?: boolean;
}) {
  const similar = await getSimilarListings({
      id: listing.id,
      vertical: listing.vertical,
      modelId: listing.modelId,
      cityId: listing.cityId,
      pricePkr: listing.pricePkr,
    });

  const registered = listing.isUnregistered
    ? "Un-Registered"
    : (listing.registeredCityName ?? "—");

  const specs: [string, string][] =
    listing.vertical === "part"
      ? [
          ["Category", listing.partCategoryName ?? "—"],
          ["Condition", listing.partCondition ? titleCase(listing.partCondition) : "—"],
          ["Brand", listing.partBrand ?? "—"],
          ["Part Number", listing.partNumber ?? "—"],
          ["OEM Number", listing.partOemNumber ?? "—"],
          ["Origin", listing.partOrigin ? titleCase(listing.partOrigin) : "—"],
          [
            "Fits",
            [listing.compatibleMakeName, listing.compatibleModelName]
              .filter(Boolean)
              .join(" ") || "Universal / not specified",
          ],
          ["Compatible Years", listing.partCompatibleYearFrom || listing.partCompatibleYearTo ? `${listing.partCompatibleYearFrom ?? "Any"}–${listing.partCompatibleYearTo ?? "Current"}` : "Any / not specified"],
          ["Position", listing.partPosition ? titleCase(listing.partPosition) : "Not applicable"],
          ["Price Unit", titleCase(listing.partPriceUnit ?? "piece")],
          ["Handover", listing.partDeliveryOption ? titleCase(listing.partDeliveryOption) : "Pickup"],
          [
            "Warranty",
            listing.partWarrantyMonths
              ? `${listing.partWarrantyMonths} months`
              : "None",
          ],
          ["In Stock", listing.partStockQty ? String(listing.partStockQty) : "—"],
        ]
      : listing.vertical === "bike"
        ? [
            ["Bike Type", listing.bikeType ? titleCase(listing.bikeType) : "—"],
            ["Condition", listing.bikeCondition ? titleCase(listing.bikeCondition) : "—"],
            ["Model Year", listing.year ? String(listing.year) : "—"],
            ["Mileage", formatMileage(listing.mileageKm)],
            [listing.fuel === "electric" ? "Motor" : "Engine", listing.fuel === "electric" ? (listing.bikeMotorPowerWatts ? `${listing.bikeMotorPowerWatts.toLocaleString()} W` : "—") : formatEngine(listing.engineCc)],
            ...(listing.fuel === "electric" ? [
              ["Battery", [listing.bikeBatteryVoltage ? `${listing.bikeBatteryVoltage}V` : null, listing.bikeBatteryCapacityAh ? `${listing.bikeBatteryCapacityAh}Ah` : null, listing.bikeBatteryType ? titleCase(listing.bikeBatteryType) : null].filter(Boolean).join(" · ") || "—"],
              ["Range / Charge", listing.bikeClaimedRangeKm ? `${listing.bikeClaimedRangeKm} km` : "—"],
              ["Top Speed", listing.bikeTopSpeedKph ? `${listing.bikeTopSpeedKph} km/h` : "—"],
              ["Charge Time", listing.bikeChargingTimeMinutes ? `${Math.floor(listing.bikeChargingTimeMinutes / 60)}h ${listing.bikeChargingTimeMinutes % 60}m` : "—"],
              ["Battery Health", listing.bikeBatteryHealthPercent ? `${listing.bikeBatteryHealthPercent}%` : "—"],
              ["Battery Removable", listing.bikeBatteryRemovable ? "Yes" : "No"],
              ["Charger Included", listing.bikeChargerIncluded ? "Yes" : "No"],
            ] as [string, string][] : [
              ["Ignition", listing.bikeIgnitionType ? titleCase(listing.bikeIgnitionType) : "—"],
              ["Engine Cycle", listing.bikeEngineType ? titleCase(listing.bikeEngineType) : "—"],
              ["Gears", listing.bikeNumberOfGears ? String(listing.bikeNumberOfGears) : "—"],
            ] as [string, string][]),
            ["Colour", listing.color ?? "—"],
            ["Registered In", registered],
            ["Documents", listing.bikeHasDocuments ? "Available" : "Not available"],
          ]
        : [
            ["Model Year", listing.year ? String(listing.year) : "—"],
            ["Mileage", formatMileage(listing.mileageKm)],
            ["Engine", formatEngine(listing.engineCc)],
            ["Transmission", listing.transmission ? titleCase(listing.transmission) : "—"],
            ["Fuel Type", listing.fuel ? titleCase(listing.fuel) : "—"],
            ["Body Type", listing.bodyType ? titleCase(listing.bodyType) : "—"],
            ["Assembly", listing.assembly ? titleCase(listing.assembly) : "—"],
            ["Colour", listing.color ?? "—"],
            ["Registered In", registered],
            ["Owners", listing.ownerCount ? String(listing.ownerCount) : "—"],
          ];

  const detailNoun =
    listing.vertical === "part"
      ? "Part details"
      : listing.vertical === "bike"
        ? "Bike details"
        : "Car details";

  const grouped = listing.features.reduce<Record<string, string[]>>((acc, f) => {
    (acc[f.groupName] ??= []).push(f.name);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {/* Gallery. The first image is priority-loaded — it is the LCP
            element on this page and the whole page is judged on it. */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="relative aspect-[4/3] bg-slate-100">
            {listing.images[0] ? (
              <Image
                src={imageUrl(listing.images[0].key, 1024)}
                alt={listing.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 720px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                No photos
              </div>
            )}
          </div>

          {listing.images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto p-2">
              {listing.images.slice(1, 12).map((img) => (
                <li key={img.key} className="shrink-0">
                  <div className="relative h-16 w-24 overflow-hidden rounded bg-slate-100">
                    <Image
                      src={imageUrl(img.key, 200)}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            {detailNoun}
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {specs.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-sm font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {Object.keys(grouped).length > 0 && (
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Features
            </h2>
            {Object.entries(grouped).map(([group, names]) => (
              <div key={group} className="mb-3 last:mb-0">
                <h3 className="mb-1.5 text-xs uppercase tracking-wide text-slate-500">
                  {titleCase(group)}
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {names.map((n) => (
                    <li
                      key={n}
                      className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {listing.description && (
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Seller&apos;s comments
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {listing.description}
            </p>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Similar {listing.modelName}s
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((s) => (
                <li key={s.id}>
                  <Link
                    href={buildListingPath(listing.vertical, s.slug, s.id)}
                    className="block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {s.primaryImageKey && (
                        <Image
                          src={imageUrl(s.primaryImageKey, 400)}
                          alt={s.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 240px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-xs text-slate-600">
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatPkrExact(s.pricePkr)}
                      </p>
                      <p className="text-xs text-slate-400">{s.cityName}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ---- sticky contact rail ------------------------------------- */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-2xl font-bold text-slate-900">
            {formatPkrExact(listing.pricePkr)}
          </p>
          {listing.isNegotiable && (
            <p className="text-xs text-slate-500">Negotiable</p>
          )}
          {listing.status === "active" && <BuyerListingActions listingId={listing.id} vertical={listing.vertical} initiallySaved={initiallySaved} detail />}

          <div className="mt-4">
            {listing.sellerPhone ? (
              <PhoneReveal
                listingId={listing.id}
                maskedPhone={maskPkPhone(listing.sellerPhone)}
              />
            ) : (
              <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">Seller contact unavailable.</p>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
            <p className="font-medium text-slate-900">
              {listing.dealerName ?? listing.sellerName ?? "Private seller"}
            </p>
            {listing.dealerSlug ? (
              <Link
                href={`/dealers/${listing.dealerSlug}`}
                className="text-xs text-blue-700 hover:underline"
              >
                View all cars from this dealer
              </Link>
            ) : (
              <Link
                href={`/sellers/${listing.sellerId}`}
                className="text-xs text-blue-700 hover:underline"
              >
                View this seller&apos;s active ads
              </Link>
            )}
            <p className="text-xs text-slate-500">
              Member since {listing.sellerSince.getFullYear()}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {listing.areaName ? `${listing.areaName}, ` : ""}
              {listing.cityName}
            </p>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Ad ref #{listing.id} · updated {relativeTime(listing.updatedAt)}
          </p>

          {isAdmin && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admin moderation
              </p>
              <Link href={`/dashboard/listings/${listing.id}/edit`} className="mb-3 inline-block text-xs font-bold text-blue-700 hover:underline">Edit full advertisement</Link>
              <ModerationActions listingId={listing.id} status={listing.status} />
            </div>
          )}

          <ReportListing listingId={listing.id} />
        </div>

        {listing.vertical === "car" && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Not sure about this one?
            </p>
            <p className="mt-1 text-xs text-blue-900">
              Get an independent engineer to check it on 200+ points before you
              hand over any money.
            </p>
            <Link
              href={`/inspection?listingId=${listing.id}`}
              className="mt-2 inline-block rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Book an inspection
            </Link>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <p className="mb-1.5 font-semibold text-slate-800">Staying safe</p>
          <ul className="list-inside list-disc space-y-1">
            <li>Meet in a public place, in daylight</li>
            <li>Never pay before you have inspected the {listing.vertical === "part" ? "part" : "vehicle"}</li>
            <li>{listing.vertical === "part" ? "Verify the part number and fitment before paying" : "Verify the registration book against the chassis number"}</li>
            <li>An unusually low price is usually a scam</li>
          </ul>
        </div>

        <Link
          href={buildPath({
            vertical: listing.vertical,
            ...(listing.modelId && listing.modelSlug && listing.makeSlug
              ? {
                  model: {
                    id: listing.modelId,
                    slug: listing.modelSlug,
                    name: listing.modelName ?? "",
                    makeSlug: listing.makeSlug,
                  },
                }
              : {}),
            city: {
              id: listing.cityId,
              slug: listing.citySlug,
              name: listing.cityName,
            },
          })}
          className="mt-4 block rounded border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          See more {listing.modelName}s in {listing.cityName}
        </Link>
      </aside>
    </div>
  );
}
