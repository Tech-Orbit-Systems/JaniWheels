import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { carDetails, listings } from "@/db/schema/listings";
import { getCurrentUser } from "@/lib/auth/session";
import { moderationLog } from "@/db/schema/trust";
import { CorrectionForm } from "./CorrectionForm";

export default async function EditRejectedListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id)) notFound();
  const [listing] = await db.select({
    id: listings.id, sellerId: listings.sellerId, title: listings.title, status: listings.status, vertical: listings.vertical,
    pricePkr: listings.pricePkr, mileageKm: listings.mileageKm, description: listings.description,
    isNegotiable: listings.isNegotiable, color: carDetails.color,
  }).from(listings).leftJoin(carDetails, eq(carDetails.listingId, listings.id)).where(eq(listings.id, id)).limit(1);
  if (!listing || listing.sellerId !== user.id || listing.status !== "rejected" || listing.vertical !== "car") notFound();
  const [lastRejection] = await db.select({ reason: moderationLog.reason })
    .from(moderationLog).where(eq(moderationLog.listingId, id)).orderBy(desc(moderationLog.createdAt)).limit(1);
  return <main className="mx-auto max-w-2xl px-4 py-8">
    <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">← My ads</Link>
    <h1 className="mt-4 text-2xl font-semibold text-slate-900">Correct and resubmit</h1>
    <p className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>Admin feedback:</strong> {lastRejection?.reason ?? "Please correct this ad before resubmitting."}</p>
    <p className="mt-3 text-sm text-slate-600">Update the affected details, then submit. The ad stays hidden until an administrator approves it.</p>
    <div className="mt-6"><CorrectionForm listing={listing} /></div>
  </main>;
}
