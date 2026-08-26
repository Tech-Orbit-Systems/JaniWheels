import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema/geo";
import { listings } from "@/db/schema/listings";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPkr, relativeTime } from "@/lib/format";
import { buildListingPath } from "@/lib/listings/slug";
import { ModerationActions } from "../moderation/ModerationActions";

export const metadata: Metadata = { title: "All listings | JaniWheels", robots: { index: false, follow: false } };
const statuses = ["all", "active", "pending_review", "rejected", "sold", "draft", "expired", "removed"] as const;

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ status?: string; updated?: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login?next=/admin/listings");
  if (!admin.isAdmin) redirect("/");
  const params = await searchParams;
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status as typeof statuses[number] : "all";
  const base = db.select({ id: listings.id, title: listings.title, slug: listings.slug, vertical: listings.vertical, status: listings.status, pricePkr: listings.pricePkr, createdAt: listings.createdAt, sellerId: listings.sellerId, sellerName: users.name, sellerEmail: users.email, cityName: cities.name })
    .from(listings).innerJoin(users, eq(users.id, listings.sellerId)).innerJoin(cities, eq(cities.id, listings.cityId));
  const rows = await (status === "all" ? base : base.where(eq(listings.status, status))).orderBy(desc(listings.updatedAt)).limit(250);
  return <main className="mx-auto w-full max-w-7xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">All listings</h1><p className="mt-1 text-sm text-slate-500">Open the full ad, edit details, hide, reinstate or permanently remove it. Every administrative change is audited.</p></div><nav className="flex gap-3 text-sm font-semibold text-blue-700"><Link href="/admin/moderation">Queue</Link><Link href="/admin/users">Users</Link><Link href="/admin/dealers">Dealers</Link></nav></div>
    {params.updated && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Listing #{params.updated} updated; its moderation status was preserved.</p>}
    <nav className="mt-5 flex flex-wrap gap-2">{statuses.map((item) => <Link key={item} href={item === "all" ? "/admin/listings" : `/admin/listings?status=${item}`} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${item === status ? "bg-blue-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{item.replace("_", " ")}</Link>)}</nav>
    <section className="mt-5 space-y-3">{rows.length ? rows.map((row) => <article key={row.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 xl:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={buildListingPath(row.vertical, row.slug, row.id)} className="font-semibold text-slate-950 hover:text-blue-700">{row.title}</Link><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold capitalize text-slate-700">{row.status.replace("_", " ")}</span><span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold capitalize text-blue-700">{row.vertical}</span></div><p className="mt-1 text-sm text-slate-600">{formatPkr(row.pricePkr)} · {row.cityName} · seller {row.sellerName ?? row.sellerEmail ?? `#${row.sellerId}`}</p><p className="mt-1 text-xs text-slate-400">Created {relativeTime(row.createdAt)} · <Link href={`/dashboard/listings/${row.id}/edit`} className="font-semibold text-blue-700 hover:underline">Edit full ad</Link></p></div><ModerationActions listingId={row.id} status={row.status} /></article>) : <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No listings in this status.</p>}</section>
  </main>;
}
