/**
 * Structured data.
 *
 * The `Vehicle` + `Offer` pair is what gets a listing into Google's vehicle
 * rich results and Search's car-shopping surfaces. It is the highest-leverage
 * markup on the site and costs nothing to emit correctly.
 *
 * Rule: never mark up something the user cannot see on the page. Google
 * treats that as spam, and the penalty lands on the whole domain.
 */

import type { FacetState } from "./facets";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "JaniWheels";

export function serializeJsonLd(value: unknown): string {
  // A seller-controlled title must never close the surrounding script element.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function abs(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

export interface VehicleListingLd {
  id: number;
  url: string;
  title: string;
  description?: string | null;
  pricePkr: number;
  year?: number | null;
  mileageKm?: number | null;
  makeName?: string | null;
  modelName?: string | null;
  bodyType?: string | null;
  fuel?: string | null;
  transmission?: string | null;
  engineCc?: number | null;
  color?: string | null;
  cityName?: string | null;
  imageUrls: string[];
  publishedAt?: Date | null;
  isSold?: boolean;
}

export function vehicleJsonLd(l: VehicleListingLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": abs(l.url),
    name: l.title,
    description: l.description ?? undefined,
    image: l.imageUrls.slice(0, 8).map(abs),
    brand: l.makeName ? { "@type": "Brand", name: l.makeName } : undefined,
    model: l.modelName ?? undefined,
    vehicleModelDate: l.year ? String(l.year) : undefined,
    productionDate: l.year ? String(l.year) : undefined,
    bodyType: l.bodyType ?? undefined,
    color: l.color ?? undefined,
    fuelType: l.fuel ?? undefined,
    vehicleTransmission: l.transmission ?? undefined,
    vehicleEngine: l.engineCc
      ? {
          "@type": "EngineSpecification",
          engineDisplacement: {
            "@type": "QuantitativeValue",
            value: l.engineCc,
            unitCode: "CMQ",
          },
        }
      : undefined,
    mileageFromOdometer: l.mileageKm
      ? { "@type": "QuantitativeValue", value: l.mileageKm, unitCode: "KMT" }
      : undefined,
    itemCondition: "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      "@id": `${abs(l.url)}#offer`,
      price: l.pricePkr,
      priceCurrency: "PKR",
      availability: l.isSold
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
      url: abs(l.url),
      availableAtOrFrom: l.cityName
        ? {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: l.cityName,
              addressCountry: "PK",
            },
          }
        : undefined,
    },
  };
}

export interface PartListingLd {
  url: string;
  title: string;
  description?: string | null;
  pricePkr: number;
  condition: "new" | "used" | "refurbished";
  brand?: string | null;
  category?: string | null;
  cityName?: string | null;
  imageUrls: string[];
}

export function partProductJsonLd(part: PartListingLd) {
  const url = abs(part.url);
  const condition = {
    new: "NewCondition",
    used: "UsedCondition",
    refurbished: "RefurbishedCondition",
  }[part.condition];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: part.title,
    description: part.description ?? undefined,
    image: part.imageUrls.slice(0, 8).map(abs),
    category: part.category ?? undefined,
    brand: part.brand ? { "@type": "Brand", name: part.brand } : undefined,
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      url,
      price: part.pricePkr,
      priceCurrency: "PKR",
      itemCondition: `https://schema.org/${condition}`,
      availability: "https://schema.org/InStock",
      availableAtOrFrom: part.cityName
        ? { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: part.cityName, addressCountry: "PK" } }
        : undefined,
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

/**
 * ItemList for search result pages. Helps Google understand that a facet
 * page is a collection, and which listings it contains.
 */
export function itemListJsonLd(urls: string[], startPosition = 1) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: urls.length,
    itemListElement: urls.map((u, i) => ({
      "@type": "ListItem",
      position: startPosition + i,
      url: abs(u),
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: abs("/janiwheels-logo.png"),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

/**
 * Human-readable H1 / <title> for a facet page.
 * Generated from state rather than stored, so adding a facet never leaves
 * stale titles behind.
 */
export function facetPageTitle(state: FacetState): string {
  const noun =
    state.vertical === "car"
      ? "Cars"
      : state.vertical === "bike"
        ? "Bikes"
        : "Auto Parts";

  const subject = state.model
    ? `${state.model.name}`
    : state.make
      ? `${state.make.name}`
      : state.category
        ? state.category.name
        : null;

  const qualifiers: string[] = [];
  if (state.bodyType) qualifiers.push(titleCase(state.bodyType));
  if (state.transmission) qualifiers.push(titleCase(state.transmission));
  if (state.fuel) qualifiers.push(titleCase(state.fuel));
  if (state.origin) qualifiers.push(titleCase(state.origin));
  if (state.assembly) qualifiers.push(titleCase(state.assembly));

  const head = [
    state.vertical === "part" ? null : "Used",
    ...qualifiers,
    subject ?? noun,
  ]
    .filter(Boolean)
    .join(" ");

  /**
   * Features read as "with X", not as a prefix — "Used Cars with Sunroof".
   *
   * Every indexable facet MUST alter the title. `ft_sunroof` was rendering
   * the exact same <h1> and <title> as the bare /used-cars page, which means
   * two indexable URLs competing on identical text — the duplicate-content
   * problem the whole facet whitelist exists to prevent, reintroduced through
   * the copy instead of the URLs.
   */
  const withFeatures = state.feature?.length
    ? `${head} with ${state.feature.map(titleCase).join(" and ")}`
    : head;

  const where = state.city
    ? ` for Sale in ${state.city.name}`
    : state.province
      ? ` for Sale in ${state.province.name}`
      : " for Sale in Pakistan";

  return `${withFeatures}${where}`;
}

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
