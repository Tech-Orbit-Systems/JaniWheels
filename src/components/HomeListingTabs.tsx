"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import type { SearchResultRow } from "@/lib/listings/search";

type Vertical = "car" | "bike" | "part";

const tabs: Array<{ value: Vertical; label: string; href: string }> = [
  { value: "car", label: "Cars", href: "/used-cars" },
  { value: "bike", label: "Bikes", href: "/used-bikes" },
  { value: "part", label: "Auto Parts", href: "/auto-parts" },
];

export function HomeListingTabs({
  listings,
}: {
  listings: Record<Vertical, SearchResultRow[]>;
}) {
  const firstAvailable = tabs.find((tab) => listings[tab.value].length > 0)?.value ?? "car";
  const [active, setActive] = useState<Vertical>(firstAvailable);
  const current = useMemo(() => tabs.find((tab) => tab.value === active)!, [active]);
  const rows = listings[active];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#a97700]">
            Fresh inventory
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
            Latest listings
          </h2>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActive(tab.value)}
              className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-sm font-bold transition ${
                active === tab.value
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <ListingCard key={row.id} row={row} vertical={active} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
          <p className="font-semibold text-zinc-700">
            No active {current.label.toLowerCase()} listings yet.
          </p>
          <Link
            href="/sell"
            className="mt-3 inline-flex font-bold text-[#9b7100] hover:underline"
          >
            Post the first ad
          </Link>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link
          href={current.href}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-zinc-900 hover:text-[#9b7100]"
        >
          View all {current.label.toLowerCase()} <ArrowRight size={17} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
