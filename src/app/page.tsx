import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CarFront,
  ClipboardCheck,
  Flag,
  Gauge,
  Handshake,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings as listingRows } from "@/db/schema/listings";
import { makes, models, partCategories } from "@/db/schema/taxonomy";
import { dealers } from "@/db/schema/users";
import { HomeListingTabs } from "@/components/HomeListingTabs";
import { HomeSearch } from "@/components/HomeSearch";
import { searchListings } from "@/lib/listings/search";
import { buildPath } from "@/lib/seo/facets";
import { abs } from "@/lib/seo/jsonld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "JaniWheels — Buy & Sell Cars, Bikes and Auto Parts in Pakistan",
  description:
    "Search cars, bikes and auto parts across Pakistan, review listing details and contact private sellers or verified dealers directly.",
  alternates: { canonical: abs("/") },
};

export default async function HomePage() {
  const [
    makeRows,
    modelRows,
    cityRows,
    categoryRows,
    cars,
    bikes,
    parts,
    verifiedDealers,
    popularModels,
    popularCities,
    popularMakes,
  ] = await Promise.all([
    db
      .select({
        id: makes.id,
        name: makes.name,
        slug: makes.slug,
        vertical: makes.vertical,
      })
      .from(makes)
      .where(and(sql`${makes.vertical} IN ('car', 'bike')`, eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db
      .select({
        id: models.id,
        makeId: models.makeId,
        name: models.name,
        fullSlug: models.fullSlug,
        vertical: models.vertical,
      })
      .from(models)
      .where(and(sql`${models.vertical} IN ('car', 'bike')`, eq(models.isActive, true)))
      .orderBy(desc(models.popularity), asc(models.name)),
    db
      .select({ id: cities.id, name: cities.name, slug: cities.slug })
      .from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name))
      .limit(40),
    db
      .select({
        id: partCategories.id,
        name: partCategories.name,
        slug: partCategories.slug,
      })
      .from(partCategories)
      .where(isNull(partCategories.parentId))
      .orderBy(desc(partCategories.popularity), asc(partCategories.name))
      .limit(24),
    searchListings({ vertical: "car" }),
    searchListings({ vertical: "bike" }),
    searchListings({ vertical: "part" }),
    db
      .select({
        id: dealers.id,
        slug: dealers.slug,
        businessName: dealers.businessName,
        cityName: cities.name,
        logoUrl: dealers.logoUrl,
        activeListingCount: sql<number>`COUNT(${listingRows.id})::int`,
      })
      .from(dealers)
      .innerJoin(cities, eq(dealers.cityId, cities.id))
      .leftJoin(
        listingRows,
        and(eq(listingRows.dealerId, dealers.id), eq(listingRows.status, "active")),
      )
      .where(isNotNull(dealers.verifiedAt))
      .groupBy(
        dealers.id,
        dealers.slug,
        dealers.businessName,
        cities.name,
        dealers.logoUrl,
      )
      .orderBy(desc(sql`COUNT(${listingRows.id})`), asc(dealers.businessName))
      .limit(4),
    db
      .select({
        id: models.id,
        slug: models.slug,
        name: models.name,
        makeName: makes.name,
        makeSlug: makes.slug,
      })
      .from(models)
      .innerJoin(makes, eq(models.makeId, makes.id))
      .where(and(eq(models.vertical, "car"), eq(models.isActive, true)))
      .orderBy(desc(models.popularity))
      .limit(8),
    db
      .select({ id: cities.id, slug: cities.slug, name: cities.name })
      .from(cities)
      .where(eq(cities.isMajor, true))
      .orderBy(desc(cities.popularity))
      .limit(8),
    db
      .select({ id: makes.id, slug: makes.slug, name: makes.name })
      .from(makes)
      .where(and(eq(makes.vertical, "car"), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity))
      .limit(8),
  ]);

  const homeMakes = makeRows.flatMap((row) =>
    row.vertical === "car" || row.vertical === "bike"
      ? [{ ...row, vertical: row.vertical }]
      : [],
  );
  const homeModels = modelRows.flatMap((row) =>
    row.vertical === "car" || row.vertical === "bike"
      ? [{ ...row, vertical: row.vertical }]
      : [],
  );

  return (
    <main className="overflow-hidden bg-white">
      <section className="relative overflow-hidden bg-[#101214] pb-32 pt-14 text-white sm:pb-36 sm:pt-20">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-32 -top-44 size-[34rem] rounded-full bg-[#f7b500]/12 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-px w-[80rem] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#f7b500]/50 to-transparent" />
          <div className="absolute -bottom-40 left-1/2 h-64 w-[66rem] -translate-x-1/2 rounded-[50%] border-t border-white/10" />
          <CarFront
            className="absolute -right-10 bottom-5 size-72 text-white/[0.035] sm:right-[8%] sm:size-96"
            strokeWidth={1}
          />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f7b500]/30 bg-[#f7b500]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffc62b]">
              Pakistan&apos;s automotive marketplace
            </p>
            <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Find the right vehicle.
              <span className="block text-[#f7b500]">Make your next move.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              Search classified listings from private sellers and verified
              dealers, then connect directly when you find the right match.
            </p>
          </div>
        </div>
      </section>

      <HomeSearch
        makes={homeMakes}
        models={homeModels}
        cities={cityRows}
        partCategories={categoryRows}
      />

      <section className="mx-auto mt-16 w-full max-w-7xl px-4 sm:mt-20">
        <HomeListingTabs
          listings={{
            car: cars.rows.slice(0, 8),
            bike: bikes.rows.slice(0, 8),
            part: parts.rows.slice(0, 8),
          }}
        />
      </section>

      {verifiedDealers.length > 0 && (
        <section className="mt-20 bg-zinc-50 py-16">
          <div className="mx-auto w-full max-w-7xl px-4">
            <SectionHeading
              eyebrow="Trusted showrooms"
              title="Verified dealers"
              description="Browse active inventory from dealers whose verified status is recorded by JaniWheels."
              action={{ label: "View all dealers", href: "/dealers" }}
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {verifiedDealers.map((dealer) => (
                <li key={dealer.id}>
                  <Link
                    href={`/dealers/${dealer.slug}`}
                    className="group block h-full rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#ddb022] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      {dealer.logoUrl ? (
                        // Dealer logos can use the configured local or remote provider.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dealer.logoUrl}
                          alt=""
                          className="size-12 rounded-xl border border-zinc-200 object-cover"
                        />
                      ) : (
                        <span className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-lg font-black text-[#f7b500]">
                          {dealer.businessName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <BadgeCheck
                        className="ml-auto text-emerald-600"
                        size={22}
                        aria-label="Verified dealer"
                      />
                    </div>
                    <h3 className="mt-4 font-extrabold text-zinc-950 group-hover:text-[#916a00]">
                      {dealer.businessName}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                      <MapPin size={14} aria-hidden /> {dealer.cityName}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-zinc-700">
                      {dealer.activeListingCount} active{" "}
                      {dealer.activeListingCount === 1 ? "listing" : "listings"}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#916a00]">
                      View inventory <ArrowRight size={15} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mx-auto mt-20 w-full max-w-7xl px-4">
        <SectionHeading
          eyebrow="Buy with more confidence"
          title="JaniWheels assistance"
          description="Request the inspection service currently available through JaniWheels."
        />
        <div className="mt-8 overflow-hidden rounded-3xl bg-[#151719] text-white shadow-xl">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <span className="flex size-12 items-center justify-center rounded-xl bg-[#f7b500] text-zinc-950">
                <ClipboardCheck size={25} aria-hidden />
              </span>
              <h3 className="mt-6 text-2xl font-black sm:text-3xl">
                Request a vehicle inspection
              </h3>
              <p className="mt-3 max-w-xl leading-7 text-zinc-300">
                Share the vehicle location and your contact details. The
                JaniWheels team will review your request and contact you about
                availability and next steps.
              </p>
              <Link
                href="/inspection"
                className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#f7b500] px-5 py-3 text-sm font-extrabold text-zinc-950 hover:bg-[#ffc62b]"
              >
                Request inspection <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
            <div className="relative min-h-64 overflow-hidden bg-[radial-gradient(circle_at_60%_35%,rgba(247,181,0,0.34),transparent_35%),linear-gradient(135deg,#282b2f,#111315)]">
              <Gauge
                className="absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 text-[#f7b500]/80 sm:size-56"
                strokeWidth={1.1}
              />
              <div className="absolute inset-x-8 bottom-7 rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffc62b]">
                  Request-based service
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  No automatic booking or online payment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-3xl bg-[#101214] px-7 py-10 text-white sm:px-12 sm:py-14">
          <div
            className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(247,181,0,0.18),transparent_62%)]"
            aria-hidden
          />
          <CarFront
            className="absolute -bottom-10 right-[5%] size-56 text-white/5 sm:size-72"
            strokeWidth={1}
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#f7b500]">
              Sell directly
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Ready to sell your vehicle?
            </h2>
            <p className="mt-3 max-w-xl leading-7 text-zinc-300">
              Create your listing and connect directly with interested buyers.
            </p>
            <Link
              href="/sell"
              className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#f7b500] px-5 py-3 text-sm font-extrabold text-zinc-950 hover:bg-[#ffc62b]"
            >
              Post an Ad <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-7xl px-4">
        <SectionHeading
          eyebrow="Simple from start to finish"
          title="How JaniWheels works"
          description="Find a listing, review its details and speak directly with the seller."
        />
        <ol className="mt-9 grid gap-8 md:grid-cols-3">
          <Step
            number="01"
            icon={Search}
            title="Search"
            text="Browse cars, bikes or auto parts using the filters relevant to each category."
          />
          <Step
            number="02"
            icon={ClipboardCheck}
            title="Review"
            text="Check the listing details, specifications, seller type and location before contacting anyone."
          />
          <Step
            number="03"
            icon={Handshake}
            title="Contact the seller"
            text="Connect directly with a private seller or a verified dealer and take the conversation forward."
          />
        </ol>
      </section>

      <section className="mt-20 border-y border-zinc-200 bg-zinc-50 py-16">
        <div className="mx-auto w-full max-w-7xl px-4">
          <SectionHeading
            eyebrow="Marketplace safeguards"
            title="Trust and safety"
            description="Clear trust signals and reporting tools help buyers make better-informed decisions."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TrustItem
              icon={UserRoundCheck}
              title="Verified dealer identity"
              text="Verified badges appear only on dealer profiles with recorded approval."
            />
            <TrustItem
              icon={ShieldCheck}
              title="Listing moderation"
              text="Listings can be reviewed and removed when they violate marketplace rules."
            />
            <TrustItem
              icon={Flag}
              title="Report concerns"
              text="Visitors can report suspicious or inaccurate listings from their detail page."
            />
            <TrustItem
              icon={Handshake}
              title="Direct communication"
              text="Buyers contact sellers directly; JaniWheels does not collect listing payments."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 w-full max-w-7xl px-4">
        <SectionHeading
          eyebrow="Explore popular searches"
          title="Find your starting point"
          description="Quick links to commonly browsed vehicles and locations."
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <LinkCollection
            title="Popular models"
            links={popularModels.map((model) => ({
              label: `${model.makeName} ${model.name}`,
              href: buildPath({
                vertical: "car",
                model: {
                  id: model.id,
                  slug: model.slug,
                  name: model.name,
                  makeSlug: model.makeSlug,
                },
              }),
            }))}
          />
          <LinkCollection
            title="Browse by city"
            links={popularCities.map((city) => ({
              label: city.name,
              href: buildPath({ vertical: "car", city }),
            }))}
          />
          <LinkCollection
            title="Browse by make"
            links={popularMakes.map((make) => ({
              label: make.name,
              href: buildPath({ vertical: "car", make }),
            }))}
          />
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#a97700]">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
          {description}
        </p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-extrabold text-zinc-900 hover:text-[#916a00]"
        >
          {action.label} <ArrowRight size={17} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  text,
}: {
  number: string;
  icon: typeof Search;
  title: string;
  text: string;
}) {
  return (
    <li className="relative border-t-2 border-zinc-200 pt-7">
      <span className="absolute -top-4 left-0 flex size-8 items-center justify-center rounded-full bg-[#f7b500] text-xs font-black text-zinc-950">
        {number}
      </span>
      <Icon className="text-[#a97700]" size={29} strokeWidth={1.8} aria-hidden />
      <h3 className="mt-4 text-lg font-extrabold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </li>
  );
}

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Search;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5">
      <Icon className="text-[#a97700]" size={25} strokeWidth={1.8} aria-hidden />
      <h3 className="mt-4 font-extrabold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </article>
  );
}

function LinkCollection({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h3 className="mb-3 font-extrabold text-zinc-950">{title}</h3>
      <ul className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-11 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-[#d8a600] hover:text-[#815e00]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
