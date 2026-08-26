import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser } from "@/lib/dealers/queries";
import { imageDeliveryUrl } from "@/lib/images/url";
import { DealerSettingsForms } from "./DealerSettingsForms";

export const metadata: Metadata = {
  title: "Dealer settings | JaniWheels",
  robots: { index: false, follow: false },
};

export default async function DealerSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/dealer/settings");
  const dealer = await getDealerForUser(user.id);
  if (!dealer) redirect("/dealers/register");

  const cityRows = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(desc(cities.popularity), asc(cities.name));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/dashboard/dealer" className="text-sm font-medium text-blue-700 hover:underline">← Dealer console</Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">Dealer settings</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Manage the information buyers see on your public showroom page.</p>
      <DealerSettingsForms
        dealer={{
          businessName: dealer.businessName,
          cityId: dealer.cityId,
          address: dealer.address,
          landline: dealer.landline,
          whatsapp: dealer.whatsapp,
          about: dealer.about,
          logoUrl: dealer.logoUrl,
          logoSrc: dealer.logoUrl ? imageDeliveryUrl(dealer.logoUrl, 256) : null,
        }}
        cities={cityRows}
      />
    </main>
  );
}
