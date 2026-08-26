import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { inspectionEvents, inspections } from "@/db/schema/trust";
import { getCurrentUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/format";
import { isInspectionStatus, inspectionStatusLabel } from "@/lib/trust/inspection-policy";

export const metadata: Metadata = { title: "My inspections | JaniWheels", robots: { index: false, follow: false } };
export default async function MyInspectionsPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login?next=/dashboard/inspections");
  const [requests, updates] = await Promise.all([
    db.select({ id: inspections.id, listingId: inspections.listingId, status: inspections.status, address: inspections.address, createdAt: inspections.createdAt, updatedAt: inspections.updatedAt, cityName: cities.name, listingTitle: listings.title, listingSlug: listings.slug }).from(inspections).innerJoin(cities, eq(inspections.cityId, cities.id)).leftJoin(listings, eq(inspections.listingId, listings.id)).where(eq(inspections.requestedByUserId, user.id)).orderBy(desc(inspections.updatedAt)),
    db.select({ id: inspectionEvents.id, inspectionId: inspectionEvents.inspectionId, toStatus: inspectionEvents.toStatus, customerMessage: inspectionEvents.customerMessage, createdAt: inspectionEvents.createdAt }).from(inspectionEvents).innerJoin(inspections, eq(inspectionEvents.inspectionId, inspections.id)).where(and(eq(inspections.requestedByUserId, user.id), isNotNull(inspectionEvents.customerMessage))).orderBy(desc(inspectionEvents.createdAt)),
  ]);
  const history = new Map<number, typeof updates>(); for (const update of updates) history.set(update.inspectionId, [...(history.get(update.inspectionId) ?? []), update]);
  return <main className="mx-auto w-full max-w-4xl px-4 py-8"><h1 className="text-2xl font-bold text-slate-950">My inspections</h1><p className="mt-1 text-sm text-slate-500">Track the requests you have sent to JaniWheels.</p>{requests.length === 0 ? <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center"><p className="text-slate-600">You have not requested an inspection yet.</p><Link href="/inspection" className="mt-3 inline-block font-semibold text-blue-700">Request an inspection</Link></div> : <ul className="mt-6 space-y-4">{requests.map((request) => { const status = isInspectionStatus(request.status) ? request.status : "requested"; return <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold text-slate-900">INS-{request.id} · {inspectionStatusLabel(status)}</h2><p className="mt-1 text-sm text-slate-600">{request.address}, {request.cityName}</p>{request.listingId && <p className="mt-1 text-sm">{request.listingSlug ? <Link href={`/used-cars/${request.listingSlug}-${request.listingId}`} className="text-blue-700 hover:underline">{request.listingTitle}</Link> : `Listing #${request.listingId}`}</p>}</div><p className="text-xs text-slate-400">Updated {relativeTime(request.updatedAt)}</p></div><ol className="mt-4 space-y-2 border-l-2 border-blue-100 pl-4">{(history.get(request.id) ?? []).map((update) => <li key={update.id}><p className="text-sm text-slate-700">{update.customerMessage}</p><p className="text-xs text-slate-400">{inspectionStatusLabel(isInspectionStatus(update.toStatus) ? update.toStatus : status)} · {relativeTime(update.createdAt)}</p></li>)}</ol></li>; })}</ul>}</main>;
}
