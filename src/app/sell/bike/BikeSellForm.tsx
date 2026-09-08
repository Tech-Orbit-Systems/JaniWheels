"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { BatteryCharging, Bike, Camera, MapPin, ShieldCheck, Zap } from "lucide-react";
import { createBikeListingAction, type SellState } from "@/lib/listings/sell-actions";
import { MapLocationPicker } from "@/components/MapLocationPicker";

type Option = { id: number; name: string };
type MakeOption = Option & { isElectric: boolean };
type FeatureOption = Option & { groupName: string };
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

export function BikeSellForm({ makes, cities, features }: { makes: MakeOption[]; cities: Option[]; features: FeatureOption[] }) {
  const [state, action, pending] = useActionState<SellState, FormData>(createBikeListingAction, {});
  const [bikeType, setBikeType] = useState("motorcycle");
  const electric = bikeType.startsWith("electric-");
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [cityId, setCityId] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [variants, setVariants] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visibleMakes = useMemo(() => makes.filter((make) => make.isElectric === electric), [makes, electric]);
  useEffect(() => { setMakeId(""); setModelId(""); setModels([]); setVariants([]); }, [electric]);
  useEffect(() => {
    if (!makeId) return setModels([]);
    fetch(`/api/taxonomy?makeId=${makeId}`).then((r) => r.json()).then((data) => setModels(data.models ?? []));
    setModelId(""); setVariants([]);
  }, [makeId]);
  useEffect(() => {
    if (!modelId) return setVariants([]);
    fetch(`/api/taxonomy?modelId=${modelId}`).then((r) => r.json()).then((data) => setVariants(data.variants ?? []));
  }, [modelId]);
  useEffect(() => {
    if (!cityId) return setAreas([]);
    fetch(`/api/taxonomy?cityId=${cityId}`).then((r) => r.json()).then((data) => setAreas(data.areas ?? []));
  }, [cityId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setUploadError(null);
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (data.keys?.length) setImageKeys((keys) => [...keys, ...data.keys].slice(0, 30));
      if (!response.ok || data.errors?.length) setUploadError(data.error ?? data.errors?.join(" ") ?? "Upload failed.");
    } catch { setUploadError("Upload failed. Check your connection."); }
    finally { setUploading(false); }
  }

  const error = (field: string) => state.fieldErrors?.[field];
  const groupedFeatures = features.reduce<Record<string, FeatureOption[]>>((groups, feature) => {
    (groups[feature.groupName] ??= []).push(feature); return groups;
  }, {});

  return (
    <form action={action} className="space-y-6">
      {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{state.error}</p>}

      <FormSection icon={Bike} title="Choose your bike type" hint="This changes the form to show only relevant specifications.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["motorcycle", "Standard Motorcycle"], ["sports", "Sports Bike"], ["cruiser", "Cruiser"],
            ["trail", "Trail / Off-road"], ["scooter", "Petrol Scooter"], ["three-wheeler", "Three Wheeler"],
            ["electric-motorcycle", "Electric Motorcycle"], ["electric-scooter", "Electric Scooter"], ["electric-bicycle", "Electric Bicycle"],
          ].map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold transition ${bikeType === value ? "border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
              <input type="radio" name="bikeType" value={value} checked={bikeType === value} onChange={() => setBikeType(value)} className="sr-only" />
              {value.startsWith("electric-") && <Zap size={16} className="mb-2 text-blue-600" aria-hidden />}{label}
            </label>
          ))}
        </div>
        {error("bikeType") && <ErrorText>{error("bikeType")}</ErrorText>}
      </FormSection>

      <FormSection icon={electric ? Zap : Bike} title={electric ? "Which electric bike?" : "Which bike?"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make" error={error("variantId")}><select value={makeId} onChange={(e) => setMakeId(e.target.value)} className={selectClass}><option value="">Select make</option>{visibleMakes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <Field label="Model"><select value={modelId} onChange={(e) => setModelId(e.target.value)} className={selectClass} disabled={!models.length}><option value="">Select model</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <Field label="Variant" error={error("variantId")}><select name="variantId" className={selectClass} disabled={!variants.length}><option value="">Select variant</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
          <Field label="Condition"><select name="condition" className={selectClass} defaultValue="used"><option value="used">Used</option><option value="new">New / unregistered stock</option></select></Field>
          <Field label="Model year" error={error("year")}><select name="year" className={selectClass} required><option value="">Select year</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
          <Field label="Mileage (km)" error={error("mileageKm")}><input name="mileageKm" type="number" min={0} max={500000} inputMode="numeric" className={inputClass} required /></Field>
        </div>
        <details className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-blue-900">Bike or e-bike not listed?</summary>
          <p className="mt-2 text-xs text-blue-800">Enter it for this ad only. It will not create a global make, model or filter.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Make name" error={error("customMakeName")}><input name="customMakeName" maxLength={80} className={inputClass} /></Field>
            <Field label="Model name" error={error("customModelName")}><input name="customModelName" maxLength={80} className={inputClass} /></Field>
            <Field label="Variant / trim"><input name="customVariantName" maxLength={80} className={inputClass} /></Field>
          </div>
        </details>
      </FormSection>

      {electric ? (
        <FormSection icon={BatteryCharging} title="Electric motor & battery" hint="Use the figures printed on the motor, battery or charger label where possible.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Motor power (watts)" error={error("motorPowerWatts")}><input name="motorPowerWatts" type="number" min={250} max={50000} placeholder="1500" className={inputClass} required /></Field>
            <Field label="Battery type" error={error("batteryType")}><select name="batteryType" className={selectClass} required defaultValue=""><option value="">Select battery</option><option value="lead-acid">Lead acid</option><option value="graphene">Graphene</option><option value="lithium-ion">Lithium-ion</option><option value="lfp">Lithium iron phosphate (LFP)</option><option value="other">Other</option></select></Field>
            <Field label="Battery voltage (V)" error={error("batteryVoltage")}><input name="batteryVoltage" type="number" min={24} max={120} placeholder="72" className={inputClass} required /></Field>
            <Field label="Battery capacity (Ah)" error={error("batteryCapacityAh")}><input name="batteryCapacityAh" type="number" min={5} max={300} placeholder="32" className={inputClass} required /></Field>
            <Field label="Range per charge (km)" error={error("claimedRangeKm")}><input name="claimedRangeKm" type="number" min={5} max={500} placeholder="80" className={inputClass} required /></Field>
            <Field label="Top speed (km/h)"><input name="topSpeedKph" type="number" min={10} max={250} placeholder="55" className={inputClass} /></Field>
            <Field label="Full charge time (minutes)" hint="Example: 6 hours = 360 minutes" error={error("chargingTimeMinutes")}><input name="chargingTimeMinutes" type="number" min={30} max={1440} placeholder="360" className={inputClass} required /></Field>
            <Field label="Battery health (%)" hint="For used batteries"><input name="batteryHealthPercent" type="number" min={1} max={100} placeholder="90" className={inputClass} /></Field>
            <Field label="Battery warranty remaining (months)"><input name="batteryWarrantyMonths" type="number" min={0} max={120} defaultValue={0} className={inputClass} /></Field>
          </div>
          <div className="flex flex-wrap gap-5"><Check name="batteryRemovable" label="Removable battery" /><Check name="chargerIncluded" label="Original charger included" defaultChecked /></div>
        </FormSection>
      ) : (
        <FormSection icon={ShieldCheck} title="Engine & starting system">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ignition"><select name="ignitionType" className={selectClass} defaultValue="kick-and-self"><option value="kick">Kick start</option><option value="self">Self start</option><option value="kick-and-self">Kick & self start</option></select></Field>
            <Field label="Engine cycle"><select name="engineType" className={selectClass} defaultValue="four-stroke"><option value="four-stroke">4-stroke</option><option value="two-stroke">2-stroke</option></select></Field>
            <Field label="Number of gears"><input name="numberOfGears" type="number" min={1} max={8} defaultValue={4} className={inputClass} /></Field>
          </div>
        </FormSection>
      )}

      <FormSection icon={MapPin} title="Registration, location & price">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={error("cityId")}><select name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)} className={selectClass} required><option value="">Select city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
          <Field label="Area"><select name="areaId" className={selectClass} disabled={!areas.length}><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field>
          <Field label="Registered city"><select name="registeredCityId" className={selectClass}><option value="">Unregistered / not specified</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
          <Field label="Price (PKR)" error={error("pricePkr")}><input name="pricePkr" type="number" min={10000} inputMode="numeric" className={inputClass} required /></Field>
          <Field label="Colour"><input name="color" maxLength={40} className={inputClass} /></Field>
          <Field label="Assembly"><select name="assembly" className={selectClass} defaultValue="local"><option value="local">Local</option><option value="imported">Imported</option></select></Field>
        </div>
        <Field label="City / town not listed" hint="Enter it for this ad, and select its nearest official city or district above for search."><input name="customCityName" maxLength={80} className={inputClass} placeholder="Town or municipality" /></Field>
        <Field label="Locality / area not listed" hint="Saved only on this ad. Select the nearest official city above."><input name="customAreaName" maxLength={80} className={inputClass} placeholder="Sector, society or village" /></Field>
        <MapLocationPicker />
        <div className="flex flex-wrap gap-5"><Check name="hasDocuments" label="Complete documents available" defaultChecked /><Check name="isUnregistered" label="Unregistered" /><Check name="isNegotiable" label="Price negotiable" /></div>
      </FormSection>

      <FormSection icon={Camera} title="Photos" hint="Add clear left, right, front, rear, meter and document/label photos.">
        <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} className="block w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-bold file:text-white" />
        {uploading && <p className="text-sm text-slate-500">Uploading…</p>}{uploadError && <ErrorText>{uploadError}</ErrorText>}{error("imageKeys") && <ErrorText>{error("imageKeys")}</ErrorText>}
        {imageKeys.length > 0 && <p className="text-sm font-bold text-blue-700">{imageKeys.length} photo{imageKeys.length === 1 ? "" : "s"} added</p>}
        {imageKeys.map((key) => <input key={key} type="hidden" name="imageKeys" value={key} />)}
      </FormSection>

      <FormSection icon={ShieldCheck} title="Features & condition notes">
        {Object.entries(groupedFeatures).map(([group, items]) => <div key={group}><h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">{group}</h3><div className="flex flex-wrap gap-3">{items.map((feature) => <Check key={feature.id} name="featureIds" value={String(feature.id)} label={feature.name} />)}</div></div>)}
        <Field label="Other features not listed" hint="Comma-separated; saved only on this ad."><textarea name="customFeatureNames" rows={2} maxLength={800} className={inputClass} placeholder="Example: sidecar, carburetor heater, custom battery monitor" /></Field>
        <Field label="Description" hint="Mention maintenance, battery replacement, accident history, faults and modifications."><textarea name="description" rows={6} maxLength={5000} className={inputClass} /></Field>
      </FormSection>

      <button type="submit" disabled={pending || uploading} className="w-full rounded-xl bg-blue-600 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{pending ? "Posting your bike…" : electric ? "Post Electric Bike Ad — Free" : "Post Bike Ad — Free"}</button>
    </form>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const selectClass = inputClass;
function FormSection({ icon: Icon, title, hint, children }: { icon: typeof Bike; title: string; hint?: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Icon size={21} aria-hidden /></span><div><h2 className="text-lg font-extrabold text-slate-950">{title}</h2>{hint && <p className="mt-1 text-sm leading-6 text-slate-500">{hint}</p>}</div></div><div className="mt-5 space-y-4">{children}</div></section>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><span className="mt-1.5 block">{children}</span>{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}{error && <ErrorText>{error}</ErrorText>}</label>; }
function Check({ name, label, value, defaultChecked = false }: { name: string; label: string; value?: string; defaultChecked?: boolean }) { return <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-blue-600" />{label}</label>; }
function ErrorText({ children }: { children?: React.ReactNode }) { return <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{children}</span>; }
