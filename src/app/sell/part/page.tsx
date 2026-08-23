import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { makes, partCategories } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { PartSellForm } from "./PartSellForm";

export const metadata: Metadata = { title: "Sell Auto Parts", robots: { index: false, follow: false } };

export default async function SellPartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell/part");
  const [categories, makesRows, cityRows] = await Promise.all([
    db.select({ id: partCategories.id, name: partCategories.name, parentId: partCategories.parentId }).from(partCategories).orderBy(asc(partCategories.parentId), desc(partCategories.popularity), asc(partCategories.name)),
    db.select({ id: makes.id, name: makes.name, vertical: makes.vertical }).from(makes).where(and(inArray(makes.vertical, ["car", "bike"]), eq(makes.isActive, true))).orderBy(desc(makes.popularity), asc(makes.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(desc(cities.popularity), asc(cities.name)),
  ]);
  const compatibleMakes = makesRows.map((make) => ({ id: make.id, name: `${make.name} (${make.vertical === "bike" ? "Bike" : "Car"})` }));
  return <main className="bg-white pb-16"><div className="mx-auto w-full max-w-4xl px-4 py-9 sm:py-12"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">Parts & accessories marketplace</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Sell an Auto Part</h1><p className="mt-3 leading-7 text-slate-600">Select the exact category, compatibility and part identifiers so buyers can find the right fit.</p></div><Link href="/post-ad" className="text-sm font-bold text-blue-700 hover:underline">Choose another ad type</Link></div><PartSellForm categories={categories} makes={compatibleMakes} cities={cityRows} /></div></main>;
}
