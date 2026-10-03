import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema/listings";
import { moderationLog } from "@/db/schema/trust";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { displayPkPhone, relativeTime } from "@/lib/format";
import { UserAccessActions } from "./UserAccessActions";

export const metadata: Metadata = { title: "User controls | JaniWheels", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login?next=/admin/users");
  if (!admin.isAdmin) redirect("/");
  const [rows, history] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, type: users.type, isAdmin: users.isAdmin, isBanned: users.isBanned, trustScore: users.trustScore, createdAt: users.createdAt, listingCount: sql<number>`COUNT(${listings.id})::int` })
      .from(users).leftJoin(listings, eq(listings.sellerId, users.id)).groupBy(users.id).orderBy(desc(users.createdAt)).limit(250),
    db.select({ id: moderationLog.id, userId: moderationLog.userId, moderatorId: moderationLog.moderatorId, action: moderationLog.action, reason: moderationLog.reason, createdAt: moderationLog.createdAt })
      .from(moderationLog).where(sql`${moderationLog.action} IN ('ban', 'unban')`).orderBy(desc(moderationLog.createdAt)).limit(100),
  ]);
  const names = new Map(rows.map((row) => [row.id, row.name ?? row.email ?? row.phone ?? `User #${row.id}`]));
  return <main className="mx-auto w-full max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">User controls</h1><p className="mt-1 text-sm text-slate-500">Review accounts, listing activity and access status. A ban revokes every active session immediately.</p></div><AdminNav /></div>
    <section className="mt-6 space-y-3">{rows.map((row) => <article key={row.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row">
      <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{row.name ?? `User #${row.id}`}</h2><Badge text={row.isAdmin ? "Administrator" : row.isBanned ? "Banned" : "Active"} tone={row.isAdmin ? "blue" : row.isBanned ? "red" : "green"} /><Badge text={row.type} tone="slate" /></div>
      <p className="mt-1 text-sm text-slate-600">{row.email ?? "No email"} · {row.phone ? displayPkPhone(row.phone) : "No mobile"}</p><p className="mt-1 text-xs text-slate-500">{row.listingCount} ad(s) · trust {row.trustScore}/100 · joined {relativeTime(row.createdAt)}</p></div>
      {!row.isAdmin && row.id !== admin.id && <UserAccessActions userId={row.id} banned={row.isBanned} />}
    </article>)}</section>
    <section className="mt-10"><h2 className="mb-3 text-lg font-semibold text-slate-900">Access audit history</h2>{history.length ? <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{history.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><div><b>{names.get(entry.userId ?? -1) ?? `User #${entry.userId}`}</b> was {entry.action === "ban" ? "banned" : "restored"}<p className="text-xs text-slate-500">{entry.reason}</p></div><span className="text-xs text-slate-600">Admin #{entry.moderatorId} · {relativeTime(entry.createdAt)}</span></li>)}</ol> : <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No access decisions yet.</p>}</section>
  </main>;
}

function AdminNav() { return <nav className="flex gap-3 text-sm font-semibold text-blue-700"><Link href="/admin/listings">Listings</Link><Link href="/admin/moderation">Queue</Link><Link href="/admin/dealers">Dealers</Link></nav>; }
function Badge({ text, tone }: { text: string; tone: "blue" | "red" | "green" | "slate" }) { const colors = { blue: "bg-blue-100 text-blue-800", red: "bg-red-100 text-red-800", green: "bg-emerald-100 text-emerald-800", slate: "bg-slate-100 text-slate-700" }; return <span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${colors[tone]}`}>{text}</span>; }
