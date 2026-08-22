"use client";

import { useActionState } from "react";
import { correctRejectedListingAction, type SellState } from "@/lib/listings/sell-actions";

export function CorrectionForm({
  listing,
}: {
  listing: { id: number; pricePkr: number; mileageKm: number | null; description: string | null; color: string | null; isNegotiable: boolean };
}) {
  const [state, action, pending] = useActionState<SellState, FormData>(
    correctRejectedListingAction.bind(null, listing.id),
    {},
  );
  return (
    <form action={action} className="space-y-5">
      {state.error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <label className="block text-sm font-medium text-slate-700">Price (PKR)
        <input name="pricePkr" type="number" min={50000} defaultValue={listing.pricePkr} required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Mileage (km)
        <input name="mileageKm" type="number" min={0} defaultValue={listing.mileageKm ?? 0} required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Colour
        <input name="color" defaultValue={listing.color ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input name="isNegotiable" type="checkbox" defaultChecked={listing.isNegotiable} /> Price negotiable
      </label>
      <label className="block text-sm font-medium text-slate-700">Description
        <textarea name="description" rows={7} maxLength={5000} defaultValue={listing.description ?? ""} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {pending ? "Submitting…" : "Submit corrected ad for review"}
      </button>
    </form>
  );
}
