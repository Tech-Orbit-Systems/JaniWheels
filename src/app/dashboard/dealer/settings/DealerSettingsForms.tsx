"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  removeDealerLogoAction,
  updateDealerLogoAction,
  updateDealerProfileAction,
  type DealerFormState,
} from "@/lib/dealers/actions";

type Dealer = {
  businessName: string;
  cityId: number;
  address: string | null;
  landline: string | null;
  whatsapp: string | null;
  about: string | null;
  logoUrl: string | null;
  logoSrc: string | null;
};

export function DealerSettingsForms({
  dealer,
  cities,
}: {
  dealer: Dealer;
  cities: { id: number; name: string }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <ProfileForm dealer={dealer} cities={cities} />
      <LogoForm dealer={dealer} />
    </div>
  );
}

function ProfileForm({
  dealer,
  cities,
}: {
  dealer: Dealer;
  cities: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<DealerFormState, FormData>(
    updateDealerProfileAction,
    {},
  );
  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="font-semibold text-slate-900">Public dealership details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your storefront address stays permanent. Changing identity details on a verified profile sends it for review again.
        </p>
      </div>
      <Message state={state} />

      <Field label="Business name" error={error("businessName")}>
        <input name="businessName" required maxLength={120} defaultValue={dealer.businessName} className={input} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" error={error("cityId")}>
          <select name="cityId" required defaultValue={dealer.cityId} className={input}>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </Field>
        <Field label="Showroom address" error={error("address")}>
          <input name="address" maxLength={240} defaultValue={dealer.address ?? ""} placeholder="Main Boulevard, Gulberg" className={input} />
        </Field>
        <Field label="Landline" error={error("landline")}>
          <input name="landline" maxLength={30} defaultValue={dealer.landline ?? ""} placeholder="042 35700000" className={input} />
        </Field>
        <Field label="WhatsApp mobile" error={error("whatsapp")}>
          <input name="whatsapp" maxLength={30} defaultValue={dealer.whatsapp ?? ""} placeholder="0300 1234567" className={input} />
        </Field>
      </div>

      <Field label="About your showroom" error={error("about")}>
        <textarea name="about" rows={6} maxLength={2000} defaultValue={dealer.about ?? ""} placeholder="What you specialise in, how long you have been trading, and details that help buyers trust your showroom." className={input} />
      </Field>

      <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save dealer profile"}
      </button>
    </form>
  );
}

function LogoForm({ dealer }: { dealer: Dealer }) {
  const [state, action, pending] = useActionState<DealerFormState, FormData>(
    updateDealerLogoAction,
    {},
  );
  return (
    <section className="h-fit rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Dealer logo</h2>
      <p className="mt-1 text-sm text-slate-500">Use a clear square logo. Maximum file size: 5 MB.</p>
      <div className="relative mx-auto my-5 size-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {dealer.logoSrc ? (
          <Image src={dealer.logoSrc} alt={`${dealer.businessName} logo`} fill sizes="128px" className="object-contain p-2" />
        ) : (
          <span className="flex size-full items-center justify-center text-4xl font-bold text-slate-400">{dealer.businessName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <Message state={state} />
      <form action={action} className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">Choose dealer logo
          <input name="logo" type="file" required accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium" />
        </label>
        <button type="submit" disabled={pending} className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {pending ? "Uploading…" : dealer.logoUrl ? "Replace logo" : "Upload logo"}
        </button>
      </form>
      {dealer.logoUrl && (
        <form action={removeDealerLogoAction} className="mt-3">
          <button className="w-full text-sm font-medium text-red-700 hover:underline">Remove logo</button>
        </form>
      )}
    </section>
  );
}

function Message({ state }: { state: DealerFormState }) {
  if (state.error) return <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>;
  if (state.success) return <p role="status" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</p>;
  return null;
}

const input = "w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        <span className="mt-1 block">{children}</span>
      </label>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
