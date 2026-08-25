"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Scale } from "lucide-react";
import { toggleSavedListingAction } from "@/lib/buyer/actions";

const KEY = "janiwheels:compare:v1";
type CompareState = { vertical: "car" | "bike"; ids: number[] };

export function BuyerListingActions({ listingId, vertical, initiallySaved = false, detail = false }: {
  listingId: number; vertical: "car" | "bike" | "part"; initiallySaved?: boolean; detail?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [compare, setCompare] = useState<CompareState | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter(); const pathname = usePathname();

  useEffect(() => {
    try { setCompare(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { setCompare(null); }
  }, []);
  const compared = compare?.vertical === vertical && compare.ids.includes(listingId);
  const compareIds = compare?.vertical === vertical ? compare.ids : [];

  function favourite() {
    startTransition(async () => {
      const result = await toggleSavedListingAction(listingId);
      if (!result.authenticated) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (result.ok) setSaved(Boolean(result.saved));
    });
  }
  function toggleCompare() {
    if (vertical === "part") return;
    const current = compare?.vertical === vertical ? compare.ids : [];
    const ids = current.includes(listingId) ? current.filter(id => id !== listingId) : [...current, listingId].slice(-3);
    const next: CompareState = { vertical, ids };
    localStorage.setItem(KEY, JSON.stringify(next)); setCompare(next);
    window.dispatchEvent(new Event("janiwheels:compare"));
  }
  const button = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:border-[#d59d00] hover:text-[#8a6500] disabled:opacity-60";
  return <div className={`flex flex-wrap gap-2 ${detail ? "mt-3" : "border-t border-slate-100 p-3 pt-2"}`}>
    <button type="button" onClick={favourite} disabled={pending} className={button} aria-pressed={saved}><Heart size={15} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</button>
    {vertical !== "part" && <><button type="button" onClick={toggleCompare} className={button} aria-pressed={compared}><Scale size={15} />{compared ? "Added" : "Compare"}</button>{compareIds.length >= 2 && <Link className={`${button} border-[#d59d00] bg-amber-50`} href={`/compare?type=${vertical}&ids=${compareIds.join(",")}`}>Compare {compareIds.length}</Link>}</>}
  </div>;
}
