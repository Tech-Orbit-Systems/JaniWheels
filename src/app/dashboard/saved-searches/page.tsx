import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedSearches } from "@/db/schema/analytics";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteSavedSearchAction, updateSavedSearchAction } from "@/lib/buyer/actions";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false, follow: false } };

export default async function SavedSearchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/saved-searches");
  const rows = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt));
  return <main className="mx-auto w-full max-w-4xl px-4 py-8">
    <h1 className="text-2xl font-bold text-slate-950">Saved searches</h1>
    <p className="mb-6 mt-1 text-sm text-slate-500">Re-run a search, rename it, or control its email alert frequency.</p>
    {rows.length ? <ul className="space-y-3">{rows.map(row => {
      const stored = row.filters as { path?: string };
      const displayName = row.name || `Saved ${row.vertical} search`;
      return <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <Link href={stored.path ?? "/"} className="font-bold text-slate-900 hover:text-[#8a6500]">{displayName}</Link>
        <p className="mt-1 text-xs text-slate-500">{row.vertical} · saved {row.createdAt.toLocaleDateString("en-PK")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <form action={updateSavedSearchAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={row.id} />
            <label className="text-xs font-bold text-slate-600">Name<input name="name" required minLength={2} maxLength={80} defaultValue={displayName} className="mt-1 block w-48 rounded-lg border border-slate-300 px-2 py-1.5 font-normal" /></label>
            <label className="text-xs font-bold text-slate-600">Alerts<select name="alertFrequency" defaultValue={row.alertFrequency} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 font-normal"><option value="instant">Instant</option><option value="daily">Daily</option><option value="off">Off</option></select></label>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">Update</button>
          </form>
          <form action={deleteSavedSearchAction}><input type="hidden" name="id" value={row.id} /><button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Delete</button></form>
        </div>
      </li>;
    })}</ul> : <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">No saved searches yet. Use Save search on a browse page.</div>}
  </main>;
}
