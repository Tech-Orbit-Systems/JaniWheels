"use client";

import { useActionState, useState } from "react";
import { requestSellAssistanceAction, type SellAssistanceState } from "@/lib/trust/sell-assistance-actions";

type Option = { id: number; name: string };
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#f7b500] focus:outline-none focus:ring-2 focus:ring-[#f7b500]/20";

export function SellAssistanceForm({ cities, makes }: { cities: Option[]; makes: Option[] }) {
  const [state, action, pending] = useActionState<SellAssistanceState, FormData>(requestSellAssistanceAction, {});
  const [models, setModels] = useState<Option[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const error = (name: string) => state.fieldErrors?.[name];

  async function loadModels(makeId: string) {
    setModels([]);
    if (!makeId) return;
    setLoadingModels(true);
    try {
      const response = await fetch(`/api/taxonomy?makeId=${encodeURIComponent(makeId)}`);
      const data = (await response.json()) as { models?: Option[] };
      setModels(data.models ?? []);
    } finally {
      setLoadingModels(false);
    }
  }

  if (state.ok) return <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5"><h2 className="font-bold text-emerald-950">Request submitted</h2><p className="mt-1 text-sm text-emerald-900">Reference <strong>{state.reference}</strong>. You can read updates from our team in your dashboard.</p><a href="/dashboard/sell-assistance" className="mt-4 inline-flex rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Track my request</a></div>;

  return <form action={action} className="space-y-7">
    {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    <Section title="1. Tell us about your car" description="Accurate details help our team prepare before calling you.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make" error={error("makeId")}><select name="makeId" required defaultValue="" onChange={(event) => void loadModels(event.target.value)} className={input}><option value="" disabled>Select make</option>{makes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Model" error={error("modelId")}><select name="modelId" required defaultValue="" disabled={loadingModels || models.length === 0} className={input}><option value="" disabled>{loadingModels ? "Loading models…" : "Select model"}</option>{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Model year" error={error("year")}><input name="year" type="number" min="1940" max={new Date().getFullYear() + 1} required placeholder="2020" className={input} /></Field>
        <Field label="Mileage (km)" error={error("mileageKm")}><input name="mileageKm" type="number" min="0" max="2000000" required placeholder="65000" className={input} /></Field>
        <Field label="Registration city" error={error("registrationCity")}><input name="registrationCity" required placeholder="Lahore" className={input} /></Field>
        <Field label="Ownership / documents" error={error("ownershipStatus")}><select name="ownershipStatus" required defaultValue="" className={input}><option value="" disabled>Select status</option><option value="own_name">Registered in my name</option><option value="open_letter">Open transfer letter</option><option value="bank_financed">Bank financed</option><option value="company_owned">Company owned</option><option value="other">Other</option></select></Field>
        <Field label="Overall condition" error={error("vehicleCondition")}><select name="vehicleCondition" required defaultValue="" className={input}><option value="" disabled>Select condition</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_work">Needs mechanical/body work</option><option value="accidental">Accidental/repaired</option></select></Field>
        <Field label="Your expected price (PKR, optional)" hint="This is your expectation, not a JaniWheels valuation." error={error("expectedPricePkr")}><input name="expectedPricePkr" type="number" min="50000" max="500000000" step="1000" placeholder="4500000" className={input} /></Field>
      </div>
    </Section>
    <Section title="2. Selling preferences" description="Tell us how soon you want to sell and how we should reach you.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Selling timeline" error={error("sellingTimeline")}><select name="sellingTimeline" required defaultValue="" className={input}><option value="" disabled>Select timeline</option><option value="urgent">As soon as possible</option><option value="within_month">Within one month</option><option value="one_to_three_months">Within 1–3 months</option><option value="exploring">Just exploring</option></select></Field>
        <Field label="Vehicle city" error={error("cityId")}><select name="cityId" required defaultValue="" className={input}><option value="" disabled>Select city</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Vehicle location" error={error("address")}><input name="address" required placeholder="Area or address where the car can be viewed" className={input} /></Field>
        <Field label="Mobile number" error={error("contactPhone")}><input name="contactPhone" type="tel" inputMode="numeric" required placeholder="0300 1234567" className={input} /></Field>
        <Field label="Preferred contact" error={error("preferredContact")}><select name="preferredContact" required defaultValue="either" className={input}><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="either">Phone or WhatsApp</option></select></Field>
        <Field label="Best time to contact (optional)" error={error("bestContactTime")}><input name="bestContactTime" placeholder="e.g. Weekdays after 5 PM" className={input} /></Field>
      </div>
      <Field label="Anything our team should know? (optional)" error={error("sellerNotes")}><textarea name="sellerNotes" rows={4} maxLength={1500} placeholder="Major repairs, document situation, existing offers, or other useful context" className={input} /></Field>
    </Section>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Important:</strong> This submits a service request only. JaniWheels does not promise a valuation, buyer, sale price, sale date, payment handling, or ownership transfer through this form.</div>
    <button disabled={pending} className="w-full rounded-lg bg-[#f7b500] px-5 py-3.5 font-bold text-[#151515] hover:bg-[#ffc62b] disabled:opacity-60">{pending ? "Submitting request…" : "Request Sell My Car Assistance"}</button>
  </form>;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section><h2 className="text-lg font-bold text-slate-950">{title}</h2><p className="mb-4 mt-1 text-sm text-slate-500">{description}</p><div className="space-y-4">{children}</div></section>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}{children}{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}{error && <span role="alert" className="mt-1 block text-xs font-normal text-red-700">{error}</span>}</label>; }
