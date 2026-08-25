"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { buildPath, ENUM_VALUES, type FacetState } from "@/lib/seo/facets";

type Make = { id: number; name: string; slug: string };
type Model = { id: number; name: string; slug: string; fullSlug: string };
type City = { id: number; name: string; slug: string };
type Feature = { id: number; name: string; slug: string };

export function VehicleFilters({ state, makes, cities, features }: {
  state: FacetState; makes: Make[]; cities: City[]; features: Feature[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(state.make || state.city || state.price || state.year));
  const [makeId, setMakeId] = useState(state.make ? String(state.make.id) : "");
  const [modelId, setModelId] = useState(state.model ? String(state.model.id) : "");
  const [models, setModels] = useState<Model[]>(state.model ? [{ id: state.model.id, name: state.model.name, slug: state.model.slug, fullSlug: `${state.model.makeSlug}-${state.model.slug}` }] : []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!makeId) { setModels([]); setModelId(""); return; }
    fetch(`/api/taxonomy?makeId=${makeId}`)
      .then((response) => response.json())
      .then((data) => setModels(data.models ?? []))
      .catch(() => setModels([]));
  }, [makeId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const range = (minKey: string, maxKey: string) => {
      const min = optionalNumber(data.get(minKey)); const max = optionalNumber(data.get(maxKey));
      if (min !== undefined && max !== undefined && min > max) throw new Error(`${minKey} must not exceed ${maxKey}.`);
      return min !== undefined || max !== undefined ? { min, max } : undefined;
    };
    try {
      const make = makes.find((item) => String(item.id) === makeId);
      const model = models.find((item) => String(item.id) === modelId);
      const city = cities.find((item) => String(item.id) === data.get("cityId"));
      const selectedFeatures = data.getAll("feature").map(String);
      const next: FacetState = {
        vertical: state.vertical,
        make: make ? { id: make.id, name: make.name, slug: make.slug } : undefined,
        model: model && make ? { id: model.id, name: model.name, slug: model.slug, makeSlug: make.slug } : undefined,
        city: city ? { id: city.id, name: city.name, slug: city.slug } : undefined,
        bodyType: text(data.get("bodyType")), transmission: text(data.get("transmission")),
        fuel: text(data.get("fuel")), assembly: text(data.get("assembly")),
        feature: selectedFeatures.length ? selectedFeatures : undefined,
        price: range("minPrice", "maxPrice"), year: range("minYear", "maxYear"),
        mileage: range("minMileage", "maxMileage"), engine: range("minEngine", "maxEngine"),
        sort: state.sort,
      };
      setError(null); router.push(buildPath(next));
    } catch (reason) { setError(reason instanceof Error ? "Check that every minimum is below its maximum." : "Invalid filters."); }
  }

  const bike = state.vertical === "bike";
  return <aside className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5" aria-expanded={open}>
      <span className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-[#a97700]"><SlidersHorizontal size={18} /></span><span><strong className="block text-slate-950">Find the right {bike ? "bike" : "car"}</strong><span className="text-xs text-slate-500">Make, model, location, price and specifications</span></span></span>
      <span className="text-sm font-bold text-[#a97700]">{open ? "Hide" : "Show filters"}</span>
    </button>
    {open && <form onSubmit={submit} className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Make"><select value={makeId} onChange={(e) => { setMakeId(e.target.value); setModelId(""); }} className={input}><option value="">All makes</option>{makes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Model"><select value={modelId} onChange={e => setModelId(e.target.value)} disabled={!models.length} className={input}><option value="">All models</option>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="City"><select name="cityId" defaultValue={state.city?.id ?? ""} className={input}><option value="">All Pakistan</option>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Fuel"><select name="fuel" defaultValue={state.fuel ?? ""} className={input}><option value="">Any fuel</option>{ENUM_VALUES.fuel?.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
      </div>
      {!bike && <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Body type"><select name="bodyType" defaultValue={state.bodyType ?? ""} className={input}><option value="">Any body type</option>{ENUM_VALUES.bodyType?.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
        <Field label="Transmission"><select name="transmission" defaultValue={state.transmission ?? ""} className={input}><option value="">Any transmission</option>{ENUM_VALUES.transmission?.map(v => <option key={v}>{label(v)}</option>)}</select></Field>
        <Field label="Assembly"><select name="assembly" defaultValue={state.assembly ?? ""} className={input}><option value="">Any assembly</option>{ENUM_VALUES.assembly?.map(v => <option key={v}>{label(v)}</option>)}</select></Field>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Range label="Price (PKR)" min="minPrice" max="maxPrice" values={state.price} />
        <Range label="Model year" min="minYear" max="maxYear" values={state.year} />
        <Range label="Mileage (km)" min="minMileage" max="maxMileage" values={state.mileage} />
        <Range label={bike ? "Engine / motor" : "Engine (cc)"} min="minEngine" max="maxEngine" values={state.engine} />
      </div>
      {!bike && features.length > 0 && <fieldset><legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-600">Features</legend><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{features.map(f => <label key={f.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><input type="checkbox" name="feature" value={f.slug} defaultChecked={state.feature?.includes(f.slug)} className="accent-[#f7b500]" />{f.name}</label>)}</div></fieldset>}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={() => router.push(bike ? "/used-bikes" : "/used-cars")} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"><X size={16} /> Clear</button><button className="inline-flex items-center gap-2 rounded-xl bg-[#f7b500] px-5 py-2.5 text-sm font-extrabold text-[#151515] hover:bg-[#ffc62b]"><Search size={17} /> Show results</button></div>
    </form>}
  </aside>;
}

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-[#d59d00] focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100";
function Field({ label: title, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">{title}</span>{children}</label>; }
function Range({ label: title, min, max, values }: { label: string; min: string; max: string; values?: { min?: number; max?: number } }) { return <fieldset><legend className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-600">{title}</legend><div className="grid grid-cols-2 gap-2"><input name={min} type="number" min={0} defaultValue={values?.min} placeholder="Min" className={input} /><input name={max} type="number" min={0} defaultValue={values?.max} placeholder="Max" className={input} /></div></fieldset>; }
function optionalNumber(value: FormDataEntryValue | null) { const n = Number(value); return value !== null && value !== "" && Number.isSafeInteger(n) && n >= 0 ? n : undefined; }
function text(value: FormDataEntryValue | null) { return typeof value === "string" && value ? value : undefined; }
function label(value: string) { return value.split("-").map(v => v[0].toUpperCase() + v.slice(1)).join(" "); }
