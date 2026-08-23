import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
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
    db.select({ id: makes.id, name: makes.name }).from(makes).where(and(eq(makes.vertical, "car"), eq(makes.isActive, true))).orderBy(desc(makes.popularity), asc(makes.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(desc(cities.popularity), asc(cities.name)),
  ]);
  return <main className="mx-auto w-full max-w-3xl px-4 py-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-2xl font-semibold text-slate-900">Sell Auto Parts</h1><p className="mt-1 text-sm text-slate-500">Add clear fitment details so the right buyer can find your part.</p></div><Link href="/sell" className="text-sm font-medium text-blue-700 hover:underline">Selling a car instead?</Link></div><PartSellForm categories={categories} makes={makesRows} cities={cityRows} /></main>;
}
