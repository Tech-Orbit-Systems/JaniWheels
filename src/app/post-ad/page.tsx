import type { Metadata } from "next";
import Link from "next/link";
import { Bike, CarFront, ChevronRight, PackageSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Post an Ad | JaniWheels",
  description: "Choose whether you want to sell a car, bike or auto part.",
  robots: { index: false, follow: false },
};

const choices = [
  {
    title: "Sell a Car",
    description: "Create a free car ad and connect directly with buyers.",
    href: "/sell",
    icon: CarFront,
    available: true,
  },
  {
    title: "Sell a Bike",
    description: "Post your motorcycle or scooter for interested buyers.",
    icon: Bike,
    available: false,
  },
  {
    title: "Sell an Auto Part",
    description: "List a spare part or automotive accessory for sale.",
    icon: PackageSearch,
    available: false,
  },
] as const;

export default function PostAdPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9b7100]">
          Post an Ad
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
          What do you want to sell?
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          Choose a category to start creating your free listing.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {choices.map((choice) => {
          const Icon = choice.icon;

          if (!choice.available) {
            return (
              <div
                key={choice.title}
                aria-disabled="true"
                className="relative flex min-h-64 flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-left"
              >
                <span className="absolute right-4 top-4 rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-600">
                  Coming soon
                </span>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200">
                  <Icon size={29} aria-hidden />
                </span>
                <h2 className="mt-7 text-xl font-extrabold text-zinc-700">
                  {choice.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {choice.description}
                </p>
              </div>
            );
          }

          return (
            <Link
              key={choice.title}
              href={choice.href}
              className="group flex min-h-64 flex-col rounded-2xl border-2 border-[#f7b500] bg-white p-6 text-left shadow-lg shadow-[#f7b500]/10 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#f7b500]/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7b500]"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f7b500] text-zinc-950">
                <Icon size={30} aria-hidden />
              </span>
              <h2 className="mt-7 text-xl font-extrabold text-zinc-950">
                {choice.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {choice.description}
              </p>
              <span className="mt-auto flex items-center gap-1 pt-6 text-sm font-extrabold text-[#8a6500]">
                Continue
                <ChevronRight
                  size={18}
                  aria-hidden
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Already posted an ad?{" "}
        <Link href="/dashboard" className="font-bold text-[#8a6500] hover:underline">
          Manage your ads
        </Link>
      </p>
    </main>
  );
}
