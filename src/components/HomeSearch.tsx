"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, MapPin, Search, SlidersHorizontal } from "lucide-react";

type Vertical = "car" | "bike" | "part";

export interface HomeMake {
  id: number;
  name: string;
  slug: string;
  vertical: "car" | "bike";
}

export interface HomeModel {
  id: number;
  makeId: number;
  name: string;
  fullSlug: string;
  vertical: "car" | "bike";
}

export interface HomeCity {
  id: number;
  name: string;
  slug: string;
}

export interface HomePartCategory {
  id: number;
  name: string;
  slug: string;
}

const verticals: Array<{ value: Vertical; label: string }> = [
  { value: "car", label: "Cars" },
  { value: "bike", label: "Bikes" },
  { value: "part", label: "Auto Parts" },
];

const bases: Record<Vertical, string> = {
  car: "/used-cars",
  bike: "/used-bikes",
  part: "/auto-parts",
};

const bodyTypes = [
  ["hatchback", "Hatchback"],
  ["sedan", "Sedan"],
  ["suv", "SUV"],
  ["crossover", "Crossover"],
  ["pickup", "Pickup"],
  ["van", "Van"],
  ["coupe", "Coupe"],
] as const;

export function HomeSearch({
  makes,
  models,
  cities,
  partCategories,
}: {
  makes: HomeMake[];
  models: HomeModel[];
  cities: HomeCity[];
  partCategories: HomePartCategory[];
}) {
  const [vertical, setVertical] = useState<Vertical>("car");
  const [makeId, setMakeId] = useState("");
  const [modelSlug, setModelSlug] = useState("");
  const [citySlug, setCitySlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");

  const availableMakes = useMemo(
    () => makes.filter((make) => make.vertical === vertical),
    [makes, vertical],
  );
  const availableModels = useMemo(
    () =>
      models.filter(
        (model) =>
          model.vertical === vertical &&
          (makeId === "" || model.makeId === Number(makeId)),
      ),
    [makeId, models, vertical],
  );

  function changeVertical(next: Vertical) {
    setVertical(next);
    setMakeId("");
    setModelSlug("");
    setCategorySlug("");
    setMinYear("");
    setMaxYear("");
  }

  function clearFilters() {
    setMakeId("");
    setModelSlug("");
    setCitySlug("");
    setCategorySlug("");
    setMinPrice("");
    setMaxPrice("");
    setMinYear("");
    setMaxYear("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const segments: string[] = [];
    if (vertical === "part") {
      if (categorySlug) segments.push(categorySlug);
    } else if (modelSlug) {
      segments.push(modelSlug);
    } else if (makeId) {
      const make = makes.find((item) => item.id === Number(makeId));
      if (make) segments.push(make.slug);
    }
    if (citySlug) segments.push(citySlug);

    const query = new URLSearchParams();
    if (minPrice || maxPrice) query.set("pr", `${minPrice}-${maxPrice}`);
    if (vertical !== "part" && (minYear || maxYear)) {
      query.set("yr", `${minYear}-${maxYear}`);
    }

    const path = `${bases[vertical]}${segments.length ? `/${segments.join("/")}` : ""}`;
    window.location.assign(query.size ? `${path}?${query}` : path);
  }

  return (
    <div className="relative z-10 mx-auto -mt-24 w-full max-w-6xl px-4 sm:-mt-28">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,18,20,0.22)]">
        <div
          role="tablist"
          aria-label="Marketplace category"
          className="flex border-b border-zinc-200 bg-zinc-50 px-3 sm:px-6"
        >
          {verticals.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={vertical === item.value}
              onClick={() => changeVertical(item.value)}
              className={`relative min-h-14 flex-1 px-2 text-sm font-bold transition sm:flex-none sm:px-7 ${
                vertical === item.value
                  ? "text-zinc-950 after:absolute after:inset-x-2 after:bottom-0 after:h-1 after:rounded-t after:bg-[#f7b500]"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            {vertical === "part" ? (
              <SelectField
                label="Part category"
                value={categorySlug}
                onChange={setCategorySlug}
                options={partCategories.map((item) => [item.slug, item.name])}
                placeholder="All categories"
              />
            ) : (
              <SelectField
                label="Make"
                value={makeId}
                onChange={(value) => {
                  setMakeId(value);
                  setModelSlug("");
                }}
                options={availableMakes.map((item) => [String(item.id), item.name])}
                placeholder="Any make"
              />
            )}

            {vertical === "part" ? (
              <div className="hidden md:block" aria-hidden />
            ) : (
              <SelectField
                label="Model"
                value={modelSlug}
                onChange={setModelSlug}
                options={availableModels.map((item) => [item.fullSlug, item.name])}
                placeholder={makeId ? "Any model" : "Select model"}
              />
            )}

            <label className="relative block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                Location
              </span>
              <MapPin
                size={17}
                aria-hidden
                className="pointer-events-none absolute bottom-3.5 left-3 text-zinc-400"
              />
              <select
                value={citySlug}
                onChange={(event) => setCitySlug(event.target.value)}
                className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-9 text-sm font-medium text-zinc-900 outline-none transition focus:border-[#d99f00] focus:ring-2 focus:ring-[#f7b500]/20"
              >
                <option value="">All Pakistan</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute bottom-4 right-3 text-zinc-400"
              />
            </label>

            <button
              type="submit"
              className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f7b500] px-6 text-sm font-extrabold text-zinc-950 transition hover:bg-[#ffc62b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 md:w-auto"
            >
              <Search size={18} aria-hidden />
              {vertical === "part" ? "Search Parts" : "Search Vehicles"}
            </button>
          </div>

          <div className="mt-4 hidden items-end gap-3 border-t border-zinc-100 pt-4 md:grid md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <NumberField label="Minimum price" value={minPrice} onChange={setMinPrice} prefix="PKR" />
            <NumberField label="Maximum price" value={maxPrice} onChange={setMaxPrice} prefix="PKR" />
            {vertical !== "part" && (
              <>
                <NumberField label="Year from" value={minYear} onChange={setMinYear} min="1950" max="2027" />
                <NumberField label="Year to" value={maxYear} onChange={setMaxYear} min="1950" max="2027" />
              </>
            )}
            {vertical === "part" && <div className="md:col-span-2" />}
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 px-2 text-sm font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
            >
              Clear all
            </button>
          </div>

          <details className="group mt-4 border-t border-zinc-100 pt-3 md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-zinc-700 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={17} aria-hidden /> More filters
              </span>
              <ChevronDown size={17} className="transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-3 pb-2 pt-3 sm:grid-cols-2">
              <NumberField label="Minimum price" value={minPrice} onChange={setMinPrice} prefix="PKR" />
              <NumberField label="Maximum price" value={maxPrice} onChange={setMaxPrice} prefix="PKR" />
              {vertical !== "part" && (
                <>
                  <NumberField label="Year from" value={minYear} onChange={setMinYear} min="1950" max="2027" />
                  <NumberField label="Year to" value={maxYear} onChange={setMaxYear} min="1950" max="2027" />
                </>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 text-left text-sm font-semibold text-zinc-600 underline"
              >
                Clear all filters
              </button>
            </div>
          </details>

          {vertical === "car" && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-3 text-sm font-bold text-zinc-900">Browse by body type</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {bodyTypes.map(([slug, label]) => (
                  <a
                    key={slug}
                    href={`/used-cars/bt_${slug}`}
                    className="group flex min-w-[108px] flex-col items-center rounded-xl border border-zinc-200 px-3 py-2.5 text-xs font-bold text-zinc-600 transition hover:border-[#e0a500] hover:bg-[#fff9e8] hover:text-zinc-950"
                  >
                    <BodyTypeIcon type={slug} />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-9 text-sm font-medium text-zinc-900 outline-none transition focus:border-[#d99f00] focus:ring-2 focus:ring-[#f7b500]/20"
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute bottom-4 right-3 text-zinc-400"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-bold text-zinc-400">
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={min ?? "0"}
          max={max}
          step={prefix ? "10000" : "1"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-lg border border-zinc-300 bg-white pr-3 text-sm text-zinc-900 outline-none transition focus:border-[#d99f00] focus:ring-2 focus:ring-[#f7b500]/20 ${prefix ? "pl-12" : "pl-3"}`}
        />
      </div>
    </label>
  );
}

function BodyTypeIcon({ type }: { type: string }) {
  const roof =
    type === "pickup"
      ? "M16 28h20l9-10h22l8 10h21"
      : type === "van"
        ? "M15 28h9l7-14h45l13 14h9"
        : type === "suv" || type === "crossover"
          ? "M14 28h16l11-13h30l15 13h14"
          : type === "coupe"
            ? "M15 28h18l13-12h21l17 12h15"
            : type === "hatchback"
              ? "M16 28h17l8-12h26l13 12h18"
              : "M14 28h18l12-12h30l13 12h13";

  return (
    <svg
      viewBox="0 0 112 44"
      className="mb-1 h-9 w-24 text-zinc-500 transition group-hover:text-[#b98500]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d={roof} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 29c0-3 2-5 5-5h3m78 0h2c3 0 5 2 5 5v3H8v-1c0-1 2-2 4-2Z" />
      <circle cx="27" cy="33" r="6" fill="white" />
      <circle cx="88" cy="33" r="6" fill="white" />
      <path d="M37 33h45" />
    </svg>
  );
}
