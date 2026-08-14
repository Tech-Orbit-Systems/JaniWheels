import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser } from "@/lib/dealers/queries";
import { DealerRegisterForm } from "./DealerRegisterForm";

export const metadata: Metadata = {
  title: "Register as a dealer",
  robots: { index: true, follow: true },
};

export default async function DealerRegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dealers/register");

  const existing = await getDealerForUser(user.id);
  if (existing) redirect("/dashboard/dealer");

  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(desc(cities.popularity), asc(cities.name));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Register as a dealer
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Create your dealership profile and public inventory storefront. Our
        team will review the details before assigning Verified Dealer status.
      </p>

      <DealerRegisterForm cities={cityRows} />
    </main>
  );
}
