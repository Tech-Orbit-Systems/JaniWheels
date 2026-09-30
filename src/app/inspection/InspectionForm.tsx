"use client";

import { useActionState } from "react";
import {
  bookInspectionAction,
  type InspectionState,
} from "@/lib/trust/actions";

export function InspectionForm({
  cities,
  listingId,
}: {
  cities: { id: number; name: string }[];
  listingId?: number;
}) {
  const [state, action, pending] = useActionState<InspectionState, FormData>(
    bookInspectionAction,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded border border-emerald-300 bg-emerald-50 p-4">
        <p className="font-medium text-emerald-900">Inspection requested</p>
        <p className="mt-1 text-sm text-emerald-900">
          Reference <strong>{state.reference}</strong>. Our team will contact
          you about availability and next steps.
        </p>
      </div>
    );
  }

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={action} className="space-y-4">
      {listingId && <input type="hidden" name="listingId" value={listingId} />}

      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <Field label="City" error={err("cityId")}>
        <select name="cityId" required className={input} defaultValue="">
          <option value="" disabled>
            Select city
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Where is the car?" error={err("address")}>
        <input
          name="address"
          required
          placeholder="Showroom or house address"
          className={input}
        />
      </Field>

      <Field label="Your mobile number" error={err("contactPhone")}>
        <input
          name="contactPhone"
          type="tel"
          inputMode="numeric"
          required
          placeholder="0300 1234567"
          className={input}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request inspection"}
      </button>
      <p className="text-xs text-slate-500">
        Our team will contact you to confirm the available service and next
        steps. No payment is collected through the website.
      </p>
    </form>
  );
}

const input =
  "w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
