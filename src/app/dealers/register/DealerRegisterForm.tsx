"use client";

import { useActionState } from "react";
import {
  registerDealerAction,
  type DealerFormState,
} from "@/lib/dealers/actions";

export function DealerRegisterForm({
  cities,
}: {
  cities: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<DealerFormState, FormData>(
    registerDealerAction,
    {},
  );

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <Field label="Business name" error={err("businessName")}>
        <input
          name="businessName"
          required
          placeholder="Al-Karam Motors"
          className={input}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field label="Showroom address">
          <input name="address" placeholder="Main Boulevard, Gulberg" className={input} />
        </Field>

        <Field label="Landline">
          <input name="landline" placeholder="042 35700000" className={input} />
        </Field>

        <Field label="WhatsApp">
          <input name="whatsapp" placeholder="0300 1234567" className={input} />
        </Field>
      </div>

      <Field label="About your showroom">
        <textarea
          name="about"
          rows={4}
          maxLength={2000}
          placeholder="What you specialise in, how long you've been trading, anything that builds confidence."
          className={input}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create dealer account"}
      </button>
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
