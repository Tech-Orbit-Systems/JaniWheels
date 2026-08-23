import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { makes, features } from "@/db/schema/taxonomy";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { SellForm } from "./SellForm";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sell your car",
  robots: { index: false, follow: false },
};

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell");

  const [makeRows, cityRows, featureRows] = await Promise.all([
    db
      .select({ id: makes.id, name: makes.name })
      .from(makes)
      .where(and(eq(makes.vertical, "car"), eq(makes.isActive, true)))
      .orderBy(desc(makes.popularity), asc(makes.name)),
    db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .orderBy(desc(cities.popularity), asc(cities.name)),
    db
      .select({
        id: features.id,
        name: features.name,
        groupName: features.groupName,
      })
      .from(features)
      .where(eq(features.vertical, "car"))
      .orderBy(asc(features.groupName), asc(features.name)),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Sell your car</h1>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <p>Free to post. Takes about three minutes.</p>
        <Link href="/post-ad" className="font-medium text-blue-700 hover:underline">Choose another ad type</Link>
      </div>

      <SellForm makes={makeRows} cities={cityRows} features={featureRows} />
    </main>
  );
}
