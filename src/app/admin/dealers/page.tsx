import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { moderationLog } from "@/db/schema/trust";
import { dealers, users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { displayPkPhone, relativeTime } from "@/lib/format";
import { DealerVerificationActions } from "./DealerVerificationActions";

export const metadata: Metadata = {
  title: "Dealer verification | JaniWheels",
  robots: { index: false, follow: false },
};

export default async function AdminDealersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/dealers");
  const [me] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!me?.isAdmin) redirect("/");

  const [dealerRows, history] = await Promise.all([
    db
      .select({
        id: dealers.id,
        userId: dealers.userId,
        businessName: dealers.businessName,
        slug: dealers.slug,
        address: dealers.address,
        about: dealers.about,
        landline: dealers.landline,
        whatsapp: dealers.whatsapp,
        verifiedAt: dealers.verifiedAt,
        createdAt: dealers.createdAt,
        cityName: cities.name,
        ownerName: users.name,
        ownerPhone: users.phone,
        ownerEmail: users.email,
      })
      .from(dealers)
      .innerJoin(cities, eq(dealers.cityId, cities.id))
      .innerJoin(users, eq(dealers.userId, users.id))
      .orderBy(desc(dealers.createdAt)),
    db
      .select({
        id: moderationLog.id,
        userId: moderationLog.userId,
        moderatorId: moderationLog.moderatorId,
        action: moderationLog.action,
        reason: moderationLog.reason,
        isAutomated: moderationLog.isAutomated,
        createdAt: moderationLog.createdAt,
      })
      .from(moderationLog)
      .where(inArray(moderationLog.action, ["dealer_verify", "dealer_revoke", "dealer_review_reset"]))
      .orderBy(desc(moderationLog.createdAt))
      .limit(100),
  ]);

  const businessByOwner = new Map(dealerRows.map((dealer) => [dealer.userId, dealer.businessName]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dealer verification</h1>
          <p className="mt-1 text-sm text-slate-500">Review dealer identities, control verified badges, and retain every decision.</p>
        </div>
        <Link href="/admin/moderation" className="text-sm font-medium text-blue-700 hover:underline">Listing moderation →</Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Registered dealers ({dealerRows.length})</h2>
        {dealerRows.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No dealer profiles are waiting.</p>
        ) : (
          <ul className="space-y-3">
            {dealerRows.map((dealer) => (
              <li key={dealer.id} className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dealers/${dealer.slug}`} className="font-semibold text-slate-900 hover:text-blue-700">{dealer.businessName}</Link>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${dealer.verifiedAt ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {dealer.verifiedAt ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{dealer.address ? `${dealer.address}, ` : ""}{dealer.cityName}</p>
                  <p className="mt-1 text-xs text-slate-500">Owner: {dealer.ownerName ?? "Unnamed"} · {dealer.ownerPhone ? displayPkPhone(dealer.ownerPhone) : "No mobile number"}{dealer.ownerEmail ? ` · ${dealer.ownerEmail}` : ""}</p>
                  {(dealer.landline || dealer.whatsapp) && <p className="mt-1 text-xs text-slate-500">Showroom: {dealer.landline ?? "No landline"}{dealer.whatsapp ? ` · WhatsApp ${displayPkPhone(dealer.whatsapp)}` : ""}</p>}
                  {dealer.about && <p className="mt-2 line-clamp-3 max-w-3xl text-sm text-slate-700">{dealer.about}</p>}
                  <p className="mt-2 text-xs text-slate-400">Registered {relativeTime(dealer.createdAt)}</p>
                </div>
                <DealerVerificationActions dealerId={dealer.id} verified={Boolean(dealer.verifiedAt)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Verification audit history</h2>
        {history.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No dealer verification decisions yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{businessByOwner.get(entry.userId ?? -1) ?? `Dealer owner #${entry.userId ?? "unknown"}`}</span>
                  <span className="ml-2 text-slate-600">{labelAction(entry.action)}</span>
                  {entry.reason && <p className="mt-1 text-xs text-slate-500">{entry.reason}</p>}
                </div>
                <p className="text-xs text-slate-400">{entry.isAutomated ? "Automatic review reset" : `Admin #${entry.moderatorId}`} · {relativeTime(entry.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function labelAction(action: string) {
  if (action === "dealer_verify") return "verified the dealer";
  if (action === "dealer_revoke") return "revoked verification";
  return "reset verification after a profile identity change";
}
