import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { inspectionEvents, inspections } from "@/db/schema/trust";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { displayPkPhone, relativeTime } from "@/lib/format";
import { isInspectionStatus, inspectionStatusLabel } from "@/lib/trust/inspection-policy";
import { InspectionAdminForm } from "./InspectionAdminForm";

export const metadata: Metadata = { title: "Inspection requests | JaniWheels", robots: { index: false, follow: false } };

export default async function AdminInspectionsPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login?next=/admin/inspections");
  if (!admin.isAdmin) redirect("/");
  const [requests, events] = await Promise.all([
    db.select({ id: inspections.id, listingId: inspections.listingId, status: inspections.status, address: inspections.address, contactPhone: inspections.contactPhone, createdAt: inspections.createdAt, updatedAt: inspections.updatedAt, cityName: cities.name, customerName: users.name, customerEmail: users.email, listingTitle: listings.title, listingSlug: listings.slug })
      .from(inspections).innerJoin(cities, eq(inspections.cityId, cities.id)).innerJoin(users, eq(inspections.requestedByUserId, users.id)).leftJoin(listings, eq(inspections.listingId, listings.id)).orderBy(desc(inspections.updatedAt)),
    db.select({ id: inspectionEvents.id, inspectionId: inspectionEvents.inspectionId, actorUserId: inspectionEvents.actorUserId, fromStatus: inspectionEvents.fromStatus, toStatus: inspectionEvents.toStatus, internalNote: inspectionEvents.internalNote, customerMessage: inspectionEvents.customerMessage, createdAt: inspectionEvents.createdAt })
      .from(inspectionEvents).orderBy(desc(inspectionEvents.createdAt)).limit(500),
  ]);
  const history = new Map<number, typeof events>();
  for (const event of events) history.set(event.inspectionId, [...(history.get(event.inspectionId) ?? []), event]);

  return <main className="mx-auto w-full max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">Inspection requests</h1><p className="mt-1 text-sm text-slate-500">Follow up customer requests and retain an append-only history. Inspector assignment and payments remain outside this workflow.</p></div><nav className="flex gap-3 text-sm font-semibold text-blue-700"><Link href="/admin/listings">Listings</Link><Link href="/admin/moderation">Moderation</Link><Link href="/admin/dealers">Dealers</Link></nav></div>
    {requests.length === 0 ? <p className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">No inspection requests yet.</p> : <ul className="mt-6 space-y-4">{requests.map((request) => {
      const status = isInspectionStatus(request.status) ? request.status : "requested";
      return <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">INS-{request.id}</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{inspectionStatusLabel(status)}</span></div><p className="mt-1 text-sm text-slate-700">{request.customerName ?? "Unnamed customer"} · {displayPkPhone(request.contactPhone)}{request.customerEmail ? ` · ${request.customerEmail}` : ""}</p><p className="mt-1 text-sm text-slate-600">{request.address}, {request.cityName}</p>{request.listingId && <p className="mt-1 text-sm">Vehicle: {request.listingSlug ? <Link className="text-blue-700 hover:underline" href={`/used-cars/${request.listingSlug}-${request.listingId}`}>{request.listingTitle}</Link> : `Listing #${request.listingId}`}</p>}</div><p className="text-xs text-slate-600">Requested {relativeTime(request.createdAt)}<br />Updated {relativeTime(request.updatedAt)}</p></div>
        <InspectionAdminForm inspectionId={request.id} status={status} />
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Audit history ({history.get(request.id)?.length ?? 0})</summary><ol className="mt-2 divide-y divide-slate-100 border-l-2 border-slate-200 pl-3">{(history.get(request.id) ?? []).map((event) => <li key={event.id} className="py-2 text-xs text-slate-600"><p><strong>{event.fromStatus ? `${event.fromStatus} → ` : ""}{event.toStatus}</strong> · actor #{event.actorUserId} · {relativeTime(event.createdAt)}</p>{event.customerMessage && <p className="mt-1 text-blue-800">Customer: {event.customerMessage}</p>}{event.internalNote && <p className="mt-1 text-amber-800">Internal: {event.internalNote}</p>}</li>)}</ol></details>
      </li>;
    })}</ul>}
  </main>;
}
