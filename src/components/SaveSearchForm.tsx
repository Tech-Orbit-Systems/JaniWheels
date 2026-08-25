"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { saveSearchAction } from "@/lib/buyer/actions";

export function SaveSearchForm({ authenticated, path, vertical, filters, defaultName }: {
  authenticated: boolean; path: string; vertical: "car" | "bike" | "part"; filters: string; defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  if (!authenticated) return <a href={`/login?next=${encodeURIComponent(path)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"><BookmarkPlus size={16} /> Save search</a>;
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"><BookmarkPlus size={16} /> Save search</button>;
  return <form action={saveSearchAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
    <input type="hidden" name="path" value={path} /><input type="hidden" name="vertical" value={vertical} /><input type="hidden" name="filters" value={filters} />
    <label className="min-w-52 flex-1 text-xs font-bold text-slate-600">Search name<input name="name" required minLength={2} maxLength={80} defaultValue={defaultName} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
    <label className="text-xs font-bold text-slate-600">Alerts<select name="alertFrequency" defaultValue="daily" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="daily">Daily</option><option value="instant">Instant</option><option value="off">Off</option></select></label>
    <button className="rounded-lg bg-[#f7b500] px-4 py-2 text-sm font-extrabold text-[#151515]">Save</button><button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-sm">Cancel</button>
  </form>;
}
