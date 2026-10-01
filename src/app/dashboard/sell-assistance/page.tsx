import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { makes, models } from "@/db/schema/taxonomy";
import { sellAssistanceEvents, sellAssistanceRequests } from "@/db/schema/trust";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPkr, relativeTime } from "@/lib/format";
import { isSellAssistanceStatus, sellAssistanceStatusLabel } from "@/lib/trust/sell-assistance-policy";

export const metadata: Metadata = { title: "My Sell My Car requests", robots: { index: false, follow: false } };
export default async function MySellAssistancePage() {
  const user = await getCurrentUser(); if (!user) redirect("/login?next=/dashboard/sell-assistance");
  const [requests, updates] = await Promise.all([
    db.select({ id: sellAssistanceRequests.id, status: sellAssistanceRequests.status, year: sellAssistanceRequests.year, mileageKm: sellAssistanceRequests.mileageKm, expectedPricePkr: sellAssistanceRequests.expectedPricePkr, sellingTimeline: sellAssistanceRequests.sellingTimeline, createdAt: sellAssistanceRequests.createdAt, updatedAt: sellAssistanceRequests.updatedAt, cityName: cities.name, makeName: makes.name, modelName: models.name }).from(sellAssistanceRequests).innerJoin(cities, eq(sellAssistanceRequests.cityId, cities.id)).innerJoin(makes, eq(sellAssistanceRequests.makeId, makes.id)).innerJoin(models, eq(sellAssistanceRequests.modelId, models.id)).where(eq(sellAssistanceRequests.requestedByUserId, user.id)).orderBy(desc(sellAssistanceRequests.updatedAt)),
    db.select({ id: sellAssistanceEvents.id, requestId: sellAssistanceEvents.requestId, toStatus: sellAssistanceEvents.toStatus, customerMessage: sellAssistanceEvents.customerMessage, createdAt: sellAssistanceEvents.createdAt }).from(sellAssistanceEvents).innerJoin(sellAssistanceRequests, eq(sellAssistanceEvents.requestId, sellAssistanceRequests.id)).where(and(eq(sellAssistanceRequests.requestedByUserId, user.id), isNotNull(sellAssistanceEvents.customerMessage))).orderBy(desc(sellAssistanceEvents.createdAt)),
  ]);
  const history = new Map<number, typeof updates>(); for (const update of updates) history.set(update.requestId, [...(history.get(update.requestId) ?? []), update]);
  return <main className="mx-auto w-full max-w-4xl px-4 py-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">My Sell My Car requests</h1><p className="mt-1 text-sm text-slate-500">Track updates from the JaniWheels seller-support team.</p></div><Link href="/sell-my-car" className="rounded-lg bg-[#f7b500] px-4 py-2 text-sm font-bold text-[#151515]">New request</Link></div>
    {requests.length === 0 ? <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center"><p className="text-slate-600">You have not requested selling assistance yet.</p><Link href="/sell-my-car" className="mt-3 inline-block font-semibold text-blue-700">Request assistance</Link></div> : <ul className="mt-6 space-y-4">{requests.map((request) => { const status = isSellAssistanceStatus(request.status) ? request.status : "requested"; return <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-bold text-slate-950">SMC-{request.id} · {request.year} {request.makeName} {request.modelName}</h2><p className="mt-1 text-sm text-slate-600">{request.mileageKm.toLocaleString("en-PK")} km · {request.cityName} · {request.expectedPricePkr ? `Your expectation: ${formatPkr(request.expectedPricePkr)}` : "No expected price provided"}</p><span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{sellAssistanceStatusLabel(status)}</span></div><p className="text-xs text-slate-600">Updated {relativeTime(request.updatedAt)}</p></div><ol className="mt-4 space-y-2 border-l-2 border-amber-200 pl-4">{(history.get(request.id) ?? []).map((update) => <li key={update.id}><p className="text-sm text-slate-700">{update.customerMessage}</p><p className="text-xs text-slate-600">{sellAssistanceStatusLabel(isSellAssistanceStatus(update.toStatus) ? update.toStatus : status)} · {relativeTime(update.createdAt)}</p></li>)}</ol></li>; })}</ul>}
  </main>;
}
