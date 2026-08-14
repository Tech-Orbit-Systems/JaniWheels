import Link from "next/link";
import Image from "next/image";
import { formatPkr, formatMileage, relativeTime } from "@/lib/format";
import { buildListingPath } from "@/lib/listings/slug";
import type { SearchResultRow } from "@/lib/listings/search";

/**
 * Result card.
 *
 * Kept deliberately light: no client JS, one image, fixed aspect ratio so
 * the grid never reflows. On a mid-range Android over 4G — which is most of
 * this site's traffic — a search page is 25 of these, and every kilobyte
 * here is multiplied by 25.
 */

function imageUrl(key: string | null, width: number): string {
  if (!key) return "/placeholder-car.svg";
  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? "local";
  if (provider === "cloudflare") {
    return `https://imagedelivery.net/${process.env.NEXT_PUBLIC_CF_IMAGES_HASH}/${key}/w=${width}`;
  }
  return `/uploads/${key}`;
}

export function ListingCard({
  row,
  vertical,
}: {
  row: SearchResultRow;
  vertical: "car" | "bike" | "part";
}) {
  const href = buildListingPath(vertical, row.slug, row.id);
  const specs = [
    row.year,
    row.mileageKm ? formatMileage(row.mileageKm) : null,
    row.fuel,
    row.engineCc ? `${row.engineCc} cc` : null,
    row.transmission,
  ].filter(Boolean);

  return (
    <li className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] bg-slate-100">
          <Image
            src={imageUrl(row.primaryImageKey, 480)}
            alt={row.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>

        <div className="p-3">
          <h2 className="line-clamp-1 text-sm font-medium text-slate-900 group-hover:text-blue-700">
            {row.title}
          </h2>

          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatPkr(row.pricePkr)}
          </p>

          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
            {specs.join(" · ")}
          </p>

          <p className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{row.cityName}</span>
            {row.publishedAt && <span>{relativeTime(row.publishedAt)}</span>}
          </p>
        </div>
      </Link>
    </li>
  );
}
