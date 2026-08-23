import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { features, makes, models, variants } from "@/db/schema/taxonomy";
import { getCurrentUser } from "@/lib/auth/session";
import { BikeSellForm } from "./BikeSellForm";

export const metadata: Metadata = {
  title: "Sell Your Bike or E-Bike | JaniWheels",
  description: "Post a motorcycle, scooter or electric bike ad in Pakistan.",
  robots: { index: false, follow: false },
};

export default async function SellBikePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell/bike");

  const [makeRows, cityRows, featureRows] = await Promise.all([
    db.select({
      id: makes.id,
      name: makes.name,
      isElectric: sql<boolean>`EXISTS (
        SELECT 1 FROM ${models} m
        JOIN ${variants} v ON v.model_id = m.id
        WHERE m.make_id = ${makes.id} AND v.fuel = 'electric'
      )`,
    }).from(makes)
      .where(and(eq(makes.vertical, "bike"), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name)),
    db.select({ id: features.id, name: features.name, groupName: features.groupName })
      .from(features).where(eq(features.vertical, "bike"))
      .orderBy(asc(features.groupName), asc(features.name)),
  ]);

  return (
    <main className="bg-gradient-to-b from-[#f4fff9] to-white pb-16">
      <div className="mx-auto w-full max-w-4xl px-4 py-9 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Motorcycles & electric mobility</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">Sell your bike</h1>
          <p className="mt-3 leading-7 text-zinc-600">Choose petrol or electric and provide the details buyers need to compare your ride confidently.</p>
        </div>
        <BikeSellForm makes={makeRows} cities={cityRows} features={featureRows} />
      </div>
    </main>
  );
}
