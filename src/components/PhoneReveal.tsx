"use client";

import { useState, useTransition } from "react";
import { revealPhoneAction } from "@/lib/listings/lead-actions";

/**
 * The conversion event of the entire product.
 *
 * Renders the masked number until clicked, then swaps in a tel: link. One
 * click, no modal, no signup wall — every step between "I want this car" and
 * "I am calling the seller" costs you leads, and leads are the thing you sell.
 */
export function PhoneReveal({
  listingId,
  maskedPhone,
  source = "detail",
}: {
  listingId: number;
  maskedPhone: string;
  source?: string;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (phone) {
    return (
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="flex w-full items-center justify-center gap-2 rounded bg-emerald-700 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-800"
      >
        {phone}
      </a>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await revealPhoneAction(listingId, source);
            if (result.ok) setPhone(result.phone);
            else setError(result.error);
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        <span className="tracking-wide">{maskedPhone}</span>
        <span className="text-sm font-normal">
          {pending ? "…" : "· Show number"}
        </span>
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
