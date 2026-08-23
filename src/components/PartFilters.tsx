"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { buildPath, type FacetState } from "@/lib/seo/facets";

type Entity = { id: number; name: string };
type Category = Entity & { slug: string; label: string };
type City = Entity & { slug: string };

export function PartFilters({
  state,
  categories,
  makes,
  cities,
  brands,
}: {
  state: FacetState;
  categories: Category[];
  makes: Entity[];
  cities: City[];
  brands: string[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(state.category?.id ? String(state.category.id) : "");
  const [cityId, setCityId] = useState(state.city?.id ? String(state.city.id) : "");
  const [condition, setCondition] = useState(state.condition ?? "");
  const [makeId, setMakeId] = useState(state.compatibleMakeId ? String(state.compatibleMakeId) : "");
  const [modelId, setModelId] = useState(state.compatibleModelId ? String(state.compatibleModelId) : "");
  const [models, setModels] = useState<Entity[]>([]);
  const [areas, setAreas] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!makeId) { setModels([]); setModelId(""); return; }
    fetch(`/api/taxonomy?makeId=${makeId}`)
      .then((response) => response.json())
      .then((data) => setModels(data.models ?? []))
      .catch(() => setModels([]));
  }, [makeId]);

  useEffect(() => {
    if (!cityId) { setAreas([]); return; }
    fetch(`/api/taxonomy?cityId=${cityId}`)
      .then((response) => response.json())
      .then((data) => setAreas(data.areas ?? []))
      .catch(() => setAreas([]));
  }, [cityId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minPrice = optionalNumber(data.get("minPrice"));
    const maxPrice = optionalNumber(data.get("maxPrice"));
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      setError("Minimum price cannot be greater than maximum price.");
      return;
    }
    setError(null);

    const category = categories.find((item) => String(item.id) === categoryId);
    const city = cities.find((item) => String(item.id) === cityId);
    const next: FacetState = {
      vertical: "part",
      category: category ? { id: category.id, slug: category.slug, name: category.name } : undefined,
      city: city ? { id: city.id, slug: city.slug, name: city.name } : undefined,
      condition: condition || undefined,
      keyword: optionalText(data.get("keyword"), 80),
      areaId: optionalNumber(data.get("areaId")),
      compatibleMakeId: optionalNumber(data.get("makeId")),
      compatibleModelId: optionalNumber(data.get("modelId")),
      compatibleYear: optionalNumber(data.get("compatibleYear")),
      brand: optionalText(data.get("brand"), 80),
      partOrigin: optionalText(data.get("partOrigin"), 30),
      sellerType: data.get("sellerType") === "dealer" || data.get("sellerType") === "individual"
        ? data.get("sellerType") as "dealer" | "individual"
        : undefined,
      inStock: data.get("inStock") === "on",
      price: minPrice !== undefined || maxPrice !== undefined ? { min: minPrice, max: maxPrice } : undefined,
      sort: state.sort,
    };
    router.push(buildPath(next));
  }

  const currentYear = new Date().getFullYear() + 1;

  return (
    <aside className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><SlidersHorizontal size={18} aria-hidden /></span>
          <div><h2 className="font-extrabold text-slate-950">Find the exact part</h2><p className="text-xs text-slate-500">Search by fitment, identifier, condition and location.</p></div>
        </div>
        <button type="button" onClick={() => router.push("/auto-parts")} className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"><X size={15} /> Clear</button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
          <input name="keyword" defaultValue={state.keyword} maxLength={80} className={`${inputClass} pl-10`} placeholder="Part name, OEM number, part number or keyword" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Detailed category"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></FilterField>
          <FilterField label="Condition"><select value={condition} onChange={(event) => setCondition(event.target.value)} className={inputClass}><option value="">Any condition</option><option value="new">Brand new</option><option value="used">Used</option><option value="refurbished">Refurbished / reconditioned</option></select></FilterField>
          <FilterField label="City"><select value={cityId} onChange={(event) => setCityId(event.target.value)} className={inputClass}><option value="">All Pakistan</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></FilterField>
          <FilterField label="Area"><select name="areaId" defaultValue={state.areaId ? String(state.areaId) : ""} disabled={!areas.length} className={inputClass}><option value="">{cityId ? "All areas" : "Select city first"}</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></FilterField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Compatible make"><select name="makeId" value={makeId} onChange={(event) => setMakeId(event.target.value)} className={inputClass}><option value="">Universal / any make</option>{makes.map((make) => <option key={make.id} value={make.id}>{make.name}</option>)}</select></FilterField>
          <FilterField label="Compatible model"><select name="modelId" value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!models.length} className={inputClass}><option value="">{makeId ? "All models" : "Select make first"}</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></FilterField>
          <FilterField label="Compatible year"><select name="compatibleYear" defaultValue={state.compatibleYear ?? ""} className={inputClass}><option value="">Any year</option>{Array.from({ length: currentYear - 1969 }, (_, index) => currentYear - index).map((year) => <option key={year}>{year}</option>)}</select></FilterField>
          <FilterField label="Part brand"><input name="brand" defaultValue={state.brand} list="part-brands" maxLength={80} className={inputClass} placeholder="Select or type brand" /><datalist id="part-brands">{brands.map((brand) => <option key={brand} value={brand} />)}</datalist></FilterField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Part origin"><select name="partOrigin" defaultValue={state.partOrigin ?? ""} className={inputClass}><option value="">Any origin</option><option value="genuine-oem">Genuine / OEM</option><option value="aftermarket">Aftermarket branded</option><option value="local">Locally manufactured</option><option value="imported-used">Imported used / Kabli</option><option value="not-sure">Not specified</option></select></FilterField>
          <FilterField label="Seller type"><select name="sellerType" defaultValue={state.sellerType ?? ""} className={inputClass}><option value="">Any seller</option><option value="individual">Individual</option><option value="dealer">Dealer</option></select></FilterField>
          <FilterField label="Minimum price"><input name="minPrice" type="number" min={0} defaultValue={state.price?.min} inputMode="numeric" className={inputClass} placeholder="PKR" /></FilterField>
          <FilterField label="Maximum price"><input name="maxPrice" type="number" min={0} defaultValue={state.price?.max} inputMode="numeric" className={inputClass} placeholder="PKR" /></FilterField>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="inStock" type="checkbox" defaultChecked={state.inStock} className="size-4 accent-blue-600" />Available now</label>
          <button type="submit" className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"><Search size={17} /> Search parts</button>
        </div>
      </form>
    </aside>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100";
function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</span>{children}</label>; }
function optionalNumber(value: FormDataEntryValue | null) { const parsed = Number(value); return value !== null && value !== "" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined; }
function optionalText(value: FormDataEntryValue | null, max: number) { const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : ""; return text || undefined; }
