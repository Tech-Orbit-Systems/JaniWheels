"use client";

import { useActionState, useEffect, useState } from "react";
import { createPartListingAction, type SellState } from "@/lib/listings/sell-actions";

type Option = { id: number; name: string };
type Category = Option & { parentId: number | null };

export function PartSellForm({
  categories,
  makes,
  cities,
}: {
  categories: Category[];
  makes: Option[];
  cities: Option[];
}) {
  const [state, action, pending] = useActionState<SellState, FormData>(createPartListingAction, {});
  const [makeId, setMakeId] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [cityId, setCityId] = useState("");
  const [areas, setAreas] = useState<Option[]>([]);
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!makeId) return setModels([]);
    fetch(`/api/taxonomy?makeId=${makeId}`).then((r) => r.json()).then((d) => setModels(d.models ?? []));
  }, [makeId]);
  useEffect(() => {
    if (!cityId) return setAreas([]);
    fetch(`/api/taxonomy?cityId=${cityId}`).then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
  }, [cityId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setUploadError(null);
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (data.keys?.length) setImageKeys((keys) => [...keys, ...data.keys]);
      if (!response.ok || data.errors?.length) setUploadError(data.error ?? data.errors?.join(" ") ?? "Upload failed.");
    } catch { setUploadError("Upload failed. Check your connection."); }
    finally { setUploading(false); }
  }
  const error = (field: string) => state.fieldErrors?.[field];
  const parents = categories.filter((category) => category.parentId === null);
  const children = (parentId: number) => categories.filter((category) => category.parentId === parentId);

  return (
    <form action={action} className="space-y-6">
      {state.error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      <Section title="What part are you selling?" hint="Choose the most specific category so buyers can find it.">
        <Field label="Part category" error={error("categoryId")}>
          <select name="categoryId" className={selectClass} required defaultValue="">
            <option value="">Select category</option>
            {parents.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                {children(parent.id).map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Part brand" hint="For example: Suzuki, Bosch, Denso" error={error("brand")}>
            <input name="brand" className={inputClass} maxLength={80} required />
          </Field>
          <Field label="Part number (optional)">
            <input name="partNumber" className={inputClass} maxLength={100} placeholder="e.g. 90915-YZZD2" />
          </Field>
        </div>
      </Section>

      <Section title="Vehicle compatibility" hint="Leave blank if this is a universal part.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compatible make">
            <select name="compatibleMakeId" value={makeId} onChange={(e) => setMakeId(e.target.value)} className={selectClass}>
              <option value="">Universal / not specified</option>
              {makes.map((make) => <option key={make.id} value={make.id}>{make.name}</option>)}
            </select>
          </Field>
          <Field label="Compatible model">
            <select name="compatibleModelId" className={selectClass} disabled={!models.length} defaultValue="">
              <option value="">{makeId ? "Any model from this make" : "Select make first"}</option>
              {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Condition, stock & price">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Condition" error={error("condition")}>
            <select name="condition" className={selectClass} defaultValue="new" required><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select>
          </Field>
          <Field label="Stock quantity" error={error("stockQty")}><input name="stockQty" type="number" min={1} defaultValue={1} className={inputClass} required /></Field>
          <Field label="Warranty (months)" hint="Use 0 if no warranty"><input name="warrantyMonths" type="number" min={0} max={120} defaultValue={0} className={inputClass} /></Field>
          <Field label="Price (PKR)" error={error("pricePkr")}><input name="pricePkr" type="number" min={500} inputMode="numeric" className={inputClass} required /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="isNegotiable" className="h-4 w-4" />Price negotiable</label>
      </Section>

      <Section title="Where is it?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={error("cityId")}><select name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)} className={selectClass} required><option value="">Select city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
          <Field label="Area (optional)"><select name="areaId" className={selectClass} disabled={!areas.length}><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field>
        </div>
      </Section>

      <Section title="Photos" hint="Use clear photos of the actual part, label and packaging.">
        <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium" />
        {uploading && <p className="text-sm text-slate-500">Uploading…</p>}
        {uploadError && <p role="alert" className="text-sm text-red-600">{uploadError}</p>}
        {error("imageKeys") && <p role="alert" className="text-sm text-red-600">{error("imageKeys")}</p>}
        {imageKeys.length > 0 && <p className="text-sm text-emerald-700">{imageKeys.length} photo{imageKeys.length === 1 ? "" : "s"} added</p>}
        {imageKeys.map((key) => <input key={key} type="hidden" name="imageKeys" value={key} />)}
      </Section>

      <Section title="Description" hint="Phone numbers and links are removed automatically.">
        <textarea name="description" rows={6} maxLength={5000} className={inputClass} placeholder="Mention fitment, condition and anything a buyer should know…" />
      </Section>
      <button type="submit" disabled={pending || uploading} className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60">{pending ? "Posting…" : "Post Auto Part — free"}</button>
    </form>
  );
}

const inputClass = "w-full rounded border border-slate-300 px-3 py-2.5 text-base text-slate-900";
const selectClass = `${inputClass} bg-white`;
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-base font-semibold text-slate-900">{title}</h2>{hint && <p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p>}<div className={hint ? "space-y-4" : "mt-3 space-y-4"}>{children}</div></section>;
}
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700">{label}</label><div className="mt-1">{children}</div>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}{error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}
