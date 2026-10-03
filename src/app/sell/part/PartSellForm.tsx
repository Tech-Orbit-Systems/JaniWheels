"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Boxes, Camera, CarFront, MapPin, PackageCheck, Tags } from "lucide-react";
import { createPartListingAction, type SellState } from "@/lib/listings/sell-actions";
import { MapLocationPicker } from "@/components/MapLocationPicker";

type Option = { id: number; name: string };
type Category = Option & { parentId: number | null };
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

export function PartSellForm({ categories, makes, cities }: { categories: Category[]; makes: Option[]; cities: Option[] }) {
  const [state, action, pending] = useActionState<SellState, FormData>(createPartListingAction, {});
  const [makeId, setMakeId] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<Option[]>([]);
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => { if (!makeId) return setModels([]); fetch(`/api/taxonomy?makeId=${makeId}`).then((r) => r.json()).then((data) => setModels(data.models ?? [])); }, [makeId]);
  useEffect(() => { if (!cityId) return setAreas([]); fetch(`/api/taxonomy?cityId=${cityId}`).then((r) => r.json()).then((data) => setAreas(data.areas ?? [])); }, [cityId]);

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const parents = new Set(categories.map((category) => category.parentId).filter((id): id is number => id !== null));
    function label(category: Category): string {
      const names = [category.name]; let parentId = category.parentId;
      while (parentId) { const parent = byId.get(parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parentId; }
      return names.join(" › ");
    }
    return categories.filter((category) => !parents.has(category.id)).map((category) => ({ id: category.id, label: label(category) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setUploadError(null);
    const body = new FormData(); Array.from(files).forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (data.keys?.length) setImageKeys((keys) => [...keys, ...data.keys].slice(0, 30));
      if (!response.ok || data.errors?.length) setUploadError(data.error ?? data.errors?.join(" ") ?? "Upload failed.");
    } catch { setUploadError("Upload failed. Check your connection."); }
    finally { setUploading(false); }
  }

  const error = (field: string) => state.fieldErrors?.[field];
  return (
    <form action={action} className="space-y-6">
      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{state.error}</p>}
      <FormSection icon={Tags} title="Identify the part" hint="Choose the most specific option. Detailed categorisation makes your ad appear in the right searches.">
        <Field label="Detailed category" error={error("categoryId")}><select name="categoryId" className={selectClass} required defaultValue=""><option value="">Select detailed category…</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
        <Field label="Exact part type not listed" hint="Choose the closest category above, then enter the exact type here. It stays only on this ad."><input name="customCategoryName" maxLength={80} className={inputClass} placeholder="Example: vacuum switching valve" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Part brand / manufacturer" hint="Examples: Toyota, Honda, Bosch, Denso, KYB" error={error("brand")}><input name="brand" maxLength={80} className={inputClass} required /></Field>
          <Field label="Part origin" error={error("partOrigin")}><select name="partOrigin" className={selectClass} defaultValue="not-sure" required><option value="genuine-oem">Genuine / OEM</option><option value="aftermarket">Aftermarket branded</option><option value="local">Locally manufactured</option><option value="imported-used">Imported used / Kabli</option><option value="not-sure">Not sure</option></select></Field>
          <Field label="Manufacturer part number"><input name="partNumber" maxLength={100} placeholder="e.g. 90915-YZZD2" className={inputClass} /></Field>
          <Field label="OEM / reference number"><input name="oemNumber" maxLength={100} placeholder="Number printed on original part" className={inputClass} /></Field>
          <Field label="Side / position"><select name="position" className={selectClass} defaultValue="not-applicable"><option value="not-applicable">Not applicable</option><option value="front">Front</option><option value="rear">Rear</option><option value="left">Left</option><option value="right">Right</option><option value="front-left">Front left</option><option value="front-right">Front right</option><option value="rear-left">Rear left</option><option value="rear-right">Rear right</option></select></Field>
          <Field label="Condition" error={error("condition")}><select name="condition" className={selectClass} defaultValue="new" required><option value="new">Brand new</option><option value="used">Used</option><option value="refurbished">Refurbished / reconditioned</option></select></Field>
        </div>
      </FormSection>

      <FormSection icon={CarFront} title="Vehicle compatibility" hint="Leave make and model blank only when the item is genuinely universal.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compatible make"><select name="compatibleMakeId" value={makeId} onChange={(e) => setMakeId(e.target.value)} className={selectClass}><option value="">Universal / not specified</option>{makes.map((make) => <option key={make.id} value={make.id}>{make.name}</option>)}</select></Field>
          <Field label="Compatible model" error={error("compatibleModelId")}><select name="compatibleModelId" className={selectClass} disabled={!models.length} defaultValue=""><option value="">{makeId ? "All models / select model" : "Select make first"}</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
          <Field label="Compatible make not listed" error={error("customCompatibleMakeName")}><input name="customCompatibleMakeName" maxLength={80} className={inputClass} placeholder="Ad-only make" /></Field>
          <Field label="Compatible model not listed" error={error("customCompatibleModelName")}><input name="customCompatibleModelName" maxLength={80} className={inputClass} placeholder="Ad-only model" /></Field>
          <Field label="Fits model years from"><select name="compatibleYearFrom" className={selectClass} defaultValue=""><option value="">Any / not specified</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
          <Field label="Fits model years to" error={error("compatibleYearTo")}><select name="compatibleYearTo" className={selectClass} defaultValue=""><option value="">Current / not specified</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
        </div>
      </FormSection>

      <FormSection icon={Boxes} title="Price, quantity & warranty">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Price (PKR)" error={error("pricePkr")}><input name="pricePkr" type="number" min={500} inputMode="numeric" className={inputClass} required /></Field>
          <Field label="Price is per"><select name="priceUnit" className={selectClass} defaultValue="piece"><option value="piece">Piece / item</option><option value="pair">Pair</option><option value="set">Set</option><option value="kit">Kit</option><option value="litre">Litre</option></select></Field>
          <Field label="Available quantity" error={error("stockQty")}><input name="stockQty" type="number" min={1} max={10000} defaultValue={1} className={inputClass} required /></Field>
          <Field label="Warranty (months)"><input name="warrantyMonths" type="number" min={0} max={120} defaultValue={0} className={inputClass} /></Field>
          <Field label="Handover option"><select name="deliveryOption" className={selectClass} defaultValue="pickup"><option value="pickup">Buyer pickup only</option><option value="courier">Courier can be arranged directly</option><option value="pickup-or-courier">Pickup or courier</option></select></Field>
        </div>
        <Check name="isNegotiable" label="Price is negotiable" />
      </FormSection>

      <FormSection icon={MapPin} title="Part location"><div className="grid gap-4 sm:grid-cols-2"><Field label="City" error={error("cityId")}><select name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)} className={selectClass} required><option value="">Select city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field><Field label="Area"><select name="areaId" className={selectClass} disabled={!areas.length}><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field></div><Field label="City / town not listed" hint="Enter it for this ad, and select its nearest official city or district above for search."><input name="customCityName" maxLength={80} className={inputClass} placeholder="Town or municipality" /></Field><Field label="Locality / area not listed" hint="Saved only on this ad."><input name="customAreaName" maxLength={80} className={inputClass} placeholder="Market, sector or village" /></Field><MapLocationPicker /></FormSection>

      <FormSection icon={Camera} title="Part photos" hint="Photograph the actual item, packaging, labels, connectors, mounting points and any damage.">
        <input type="file" aria-label="Choose part photos" accept="image/*" multiple onChange={(e) => upload(e.target.files)} className="block w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-extrabold file:text-white" />
        {uploading && <p className="text-sm text-slate-500">Uploading…</p>}{uploadError && <ErrorText>{uploadError}</ErrorText>}{error("imageKeys") && <ErrorText>{error("imageKeys")}</ErrorText>}{imageKeys.length > 0 && <p className="text-sm font-bold text-blue-700">{imageKeys.length} photo{imageKeys.length === 1 ? "" : "s"} added</p>}{imageKeys.map((key) => <input key={key} type="hidden" name="imageKeys" value={key} />)}
      </FormSection>

      <FormSection icon={PackageCheck} title="Description & fitment notes" hint="Phone numbers, emails and external links are removed automatically."><textarea name="description" rows={7} maxLength={5000} className={inputClass} placeholder="Mention exact fitment, measurements, included items, condition, defects, installation needs and warranty terms…" /></FormSection>
      <button type="submit" disabled={pending || uploading} className="w-full rounded-xl bg-blue-600 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{pending ? "Posting your part…" : "Post Auto Part Ad — Free"}</button>
    </form>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const selectClass = inputClass;
function FormSection({ icon: Icon, title, hint, children }: { icon: typeof Tags; title: string; hint?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Icon size={21} aria-hidden /></span><div><h2 className="text-lg font-extrabold text-slate-950">{title}</h2>{hint && <p className="mt-1 text-sm leading-6 text-slate-500">{hint}</p>}</div></div><div className="mt-5 space-y-4">{children}</div></section>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><span className="mt-1.5 block">{children}</span>{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}{error && <ErrorText>{error}</ErrorText>}</label>; }
function Check({ name, label }: { name: string; label: string }) { return <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" name={name} className="size-4 accent-blue-600" />{label}</label>; }
function ErrorText({ children }: { children?: React.ReactNode }) { return <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{children}</span>; }
