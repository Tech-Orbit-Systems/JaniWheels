"use client";

import Image from "@/components/StoredImage";
import { useActionState, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, MapPin, Save, Trash2 } from "lucide-react";
import { updateListingAction } from "@/lib/listings/manage-actions";
import type { SellState } from "@/lib/listings/sell-actions";
import { MapLocationPicker } from "@/components/MapLocationPicker";

type Option = { id: number; name: string };
type Listing = {
  id: number; vertical: "car" | "bike" | "part"; status: string; title: string;
  description: string | null; pricePkr: number; isNegotiable: boolean;
  cityId: number; areaId: number | null; customCityName: string | null; customAreaName: string | null;
  exactLatitude: number | null; exactLongitude: number | null;
  makeId: number | null; modelId: number | null; variantId: number | null;
  customMakeName: string | null; customModelName: string | null; customVariantName: string | null;
  year: number | null; mileageKm: number | null; assembly: "local" | "imported" | null;
  registeredCityId: number | null; carIsUnregistered: boolean | null; carColor: string | null;
  ownerCount: number | null; lastTokenPaidYear: number | null; hasAuctionSheet: boolean | null; auctionGrade: string | null;
  bikeRegisteredCityId: number | null; bikeIsUnregistered: boolean | null; bikeColor: string | null;
  hasDocuments: boolean | null; bikeType: string | null; bikeCondition: string | null;
  ignitionType: string | null; engineType: string | null; numberOfGears: number | null;
  motorPowerWatts: number | null; batteryType: string | null; batteryVoltage: number | null;
  batteryCapacityAh: number | null; claimedRangeKm: number | null; topSpeedKph: number | null;
  chargingTimeMinutes: number | null; batteryHealthPercent: number | null;
  batteryRemovable: boolean | null; chargerIncluded: boolean | null; batteryWarrantyMonths: number | null;
  categoryId: number | null; partCondition: "new" | "used" | "refurbished" | null;
  partBrand: string | null; customCategoryName: string | null; partNumber: string | null;
  oemNumber: string | null; partOrigin: string | null; priceUnit: string | null;
  compatibleMakeId: number | null; compatibleModelId: number | null;
  customCompatibleMakeName: string | null; customCompatibleModelName: string | null;
  compatibleYearFrom: number | null; compatibleYearTo: number | null; partPosition: string | null;
  deliveryOption: string | null; warrantyMonths: number | null; stockQty: number | null;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, index) => CURRENT_YEAR - index);

export function ListingEditForm({ listing, cities, initialAreas, images: originalImages, makes, initialModels,
  initialVariants, compatibleModels: initialCompatibleModels, categories, features, selectedFeatureIds, customFeatures }: {
  listing: Listing; cities: Option[]; initialAreas: Option[]; images: string[]; makes: Option[];
  initialModels: Option[]; initialVariants: Option[]; compatibleModels: Option[]; categories: Option[];
  features: (Option & { groupName: string })[]; selectedFeatureIds: number[]; customFeatures: string[];
}) {
  const [state, action, pending] = useActionState<SellState, FormData>(updateListingAction.bind(null, listing.id), {});
  const [cityId, setCityId] = useState(String(listing.cityId));
  const [areaId, setAreaId] = useState(listing.areaId ? String(listing.areaId) : "");
  const [areas, setAreas] = useState(initialAreas);
  const [makeId, setMakeId] = useState(listing.makeId ? String(listing.makeId) : "");
  const [modelId, setModelId] = useState(listing.modelId ? String(listing.modelId) : "");
  const [variantId, setVariantId] = useState(listing.variantId ? String(listing.variantId) : "");
  const [models, setModels] = useState(initialModels);
  const [variants, setVariants] = useState(initialVariants);
  const [compatibleMakeId, setCompatibleMakeId] = useState(listing.compatibleMakeId ? String(listing.compatibleMakeId) : "");
  const [compatibleModels, setCompatibleModels] = useState(initialCompatibleModels);
  const [compatibleModelId, setCompatibleModelId] = useState(listing.compatibleModelId ? String(listing.compatibleModelId) : "");
  const [bikeType, setBikeType] = useState(listing.bikeType ?? "motorcycle");
  const [carIsUnregistered, setCarIsUnregistered] = useState(Boolean(listing.carIsUnregistered));
  const [hasAuctionSheet, setHasAuctionSheet] = useState(Boolean(listing.hasAuctionSheet));
  const [imageKeys, setImageKeys] = useState(originalImages);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const electric = bikeType.startsWith("electric-");
  const error = (field: string) => state.fieldErrors?.[field];

  async function load(url: string, key: "models" | "variants" | "areas") {
    const response = await fetch(url); const data = await response.json(); return data[key] ?? [];
  }
  async function changeCity(value: string) {
    setCityId(value);
    setAreaId("");
    setAreas(value ? await load(`/api/taxonomy?cityId=${value}`, "areas") : []);
  }
  async function changeMake(value: string) { setMakeId(value); setModelId(""); setVariantId(""); setVariants([]); setModels(value ? await load(`/api/taxonomy?makeId=${value}`, "models") : []); }
  async function changeModel(value: string) { setModelId(value); setVariantId(""); setVariants(value ? await load(`/api/taxonomy?modelId=${value}`, "variants") : []); }
  async function changeCompatibleMake(value: string) { setCompatibleMakeId(value); setCompatibleModelId(""); setCompatibleModels(value ? await load(`/api/taxonomy?makeId=${value}`, "models") : []); }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (imageKeys.length + files.length > 30) { setUploadError("An ad can have up to 30 photos."); return; }
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

  function move(from: number, to: number) {
    if (to < 0 || to >= imageKeys.length || from === to) return;
    setImageKeys((keys) => { const next = [...keys]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  }

  return <form action={action} className="space-y-6">
    {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{state.error}</p>}

    {listing.vertical !== "part" && <Section title="Vehicle identity">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Make"><select value={makeId} onChange={(event) => changeMake(event.target.value)} className={inputClass}><option value="">Not listed / enter below</option>{makes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Model"><select value={modelId} onChange={(event) => changeModel(event.target.value)} disabled={!models.length} className={inputClass}><option value="">Select / not listed</option>{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Variant" error={error("variantId")}><select name="variantId" value={variantId} onChange={(event) => setVariantId(event.target.value)} disabled={!variants.length} className={inputClass}><option value="">Select / enter below</option>{variants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Make not listed"><input name="customMakeName" maxLength={80} defaultValue={listing.customMakeName ?? ""} className={inputClass} /></Field>
        <Field label="Model not listed"><input name="customModelName" maxLength={80} defaultValue={listing.customModelName ?? ""} className={inputClass} /></Field>
        <Field label="Variant not listed"><input name="customVariantName" maxLength={80} defaultValue={listing.customVariantName ?? ""} className={inputClass} /></Field>
      </div>
    </Section>}

    {listing.vertical === "car" && <>
      <Section title="Car details"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Model year"><select name="year" defaultValue={listing.year ?? ""} required className={inputClass}>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
        <Field label="Mileage (km)"><input name="mileageKm" type="number" min={0} defaultValue={listing.mileageKm ?? 0} required className={inputClass} /></Field>
        <Field label="Assembly"><select name="assembly" defaultValue={listing.assembly ?? "local"} className={inputClass}><option value="local">Local</option><option value="imported">Imported</option></select></Field>
        <Field label="Colour"><input name="color" maxLength={40} defaultValue={listing.carColor ?? ""} className={inputClass} /></Field>
        {!carIsUnregistered && <Field label="Registered city" error={error("registeredCityId")}><select name="registeredCityId" defaultValue={listing.registeredCityId ?? ""} className={inputClass}><option value="">Not specified</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>}
        <Field label="Owner count"><input name="ownerCount" type="number" min={1} max={20} defaultValue={listing.ownerCount ?? ""} className={inputClass} /></Field>
        {!carIsUnregistered && <Field label="Last token paid" error={error("lastTokenPaidYear")}><select name="lastTokenPaidYear" defaultValue={listing.lastTokenPaidYear ?? ""} className={inputClass}><option value="">Not specified</option>{YEARS.filter((year) => year >= 1990).map((year) => <option key={year}>{year}</option>)}</select></Field>}
        {hasAuctionSheet && <Field label="Auction grade" error={error("auctionGrade")}><input name="auctionGrade" maxLength={10} defaultValue={listing.auctionGrade ?? ""} className={inputClass} /></Field>}
      </div><Checks><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="isUnregistered" checked={carIsUnregistered} onChange={(event) => setCarIsUnregistered(event.target.checked)} className="size-4 accent-blue-600" />Unregistered</label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="hasAuctionSheet" checked={hasAuctionSheet} onChange={(event) => setHasAuctionSheet(event.target.checked)} className="size-4 accent-blue-600" />Auction sheet available</label></Checks></Section>
    </>}

    {listing.vertical === "bike" && <>
      <Section title="Bike details"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Bike type"><select name="bikeType" value={bikeType} onChange={(event) => setBikeType(event.target.value)} className={inputClass}><option value="motorcycle">Motorcycle</option><option value="sports">Sports bike</option><option value="cruiser">Cruiser</option><option value="trail">Trail</option><option value="scooter">Scooter</option><option value="three-wheeler">Three-wheeler</option><option value="electric-motorcycle">Electric motorcycle</option><option value="electric-scooter">Electric scooter</option><option value="electric-bicycle">Electric bicycle</option></select></Field>
        <Field label="Condition"><select name="condition" defaultValue={listing.bikeCondition ?? "used"} className={inputClass}><option value="new">New</option><option value="used">Used</option></select></Field>
        <Field label="Model year"><select name="year" defaultValue={listing.year ?? ""} className={inputClass}>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
        <Field label="Mileage (km)"><input name="mileageKm" type="number" min={0} defaultValue={listing.mileageKm ?? 0} className={inputClass} /></Field>
        <Field label="Assembly"><select name="assembly" defaultValue={listing.assembly ?? "local"} className={inputClass}><option value="local">Local</option><option value="imported">Imported</option></select></Field>
        <Field label="Colour"><input name="color" defaultValue={listing.bikeColor ?? ""} className={inputClass} /></Field>
        <Field label="Registered city"><select name="registeredCityId" defaultValue={listing.bikeRegisteredCityId ?? ""} className={inputClass}><option value="">Not specified</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
        {!electric && <><Field label="Ignition"><select name="ignitionType" defaultValue={listing.ignitionType ?? "kick-and-self"} className={inputClass}><option value="kick">Kick</option><option value="self">Self</option><option value="kick-and-self">Kick and self</option></select></Field><Field label="Engine type"><select name="engineType" defaultValue={listing.engineType ?? "four-stroke"} className={inputClass}><option value="two-stroke">Two-stroke</option><option value="four-stroke">Four-stroke</option></select></Field><Field label="Number of gears"><input name="numberOfGears" type="number" min={1} max={8} defaultValue={listing.numberOfGears ?? 4} className={inputClass} /></Field></>}
      </div><Checks><Check name="isUnregistered" label="Unregistered" checked={Boolean(listing.bikeIsUnregistered)} /><Check name="hasDocuments" label="Documents available" checked={Boolean(listing.hasDocuments)} /></Checks></Section>
      {electric && <Section title="Electric specifications"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Motor power (W)"><input name="motorPowerWatts" type="number" min={250} defaultValue={listing.motorPowerWatts ?? ""} required className={inputClass} /></Field>
        <Field label="Battery type"><select name="batteryType" defaultValue={listing.batteryType ?? "lithium-ion"} className={inputClass}><option value="lead-acid">Lead acid</option><option value="graphene">Graphene</option><option value="lithium-ion">Lithium-ion</option><option value="lfp">LFP</option><option value="other">Other</option></select></Field>
        <Field label="Voltage"><input name="batteryVoltage" type="number" min={24} defaultValue={listing.batteryVoltage ?? ""} required className={inputClass} /></Field>
        <Field label="Capacity (Ah)"><input name="batteryCapacityAh" type="number" min={5} defaultValue={listing.batteryCapacityAh ?? ""} required className={inputClass} /></Field>
        <Field label="Range (km)"><input name="claimedRangeKm" type="number" min={5} defaultValue={listing.claimedRangeKm ?? ""} required className={inputClass} /></Field>
        <Field label="Top speed (km/h)"><input name="topSpeedKph" type="number" min={10} defaultValue={listing.topSpeedKph ?? ""} className={inputClass} /></Field>
        <Field label="Charging time (minutes)"><input name="chargingTimeMinutes" type="number" min={30} defaultValue={listing.chargingTimeMinutes ?? ""} required className={inputClass} /></Field>
        <Field label="Battery health %"><input name="batteryHealthPercent" type="number" min={1} max={100} defaultValue={listing.batteryHealthPercent ?? ""} className={inputClass} /></Field>
        <Field label="Battery warranty months"><input name="batteryWarrantyMonths" type="number" min={0} max={120} defaultValue={listing.batteryWarrantyMonths ?? 0} className={inputClass} /></Field>
      </div><Checks><Check name="batteryRemovable" label="Removable battery" checked={Boolean(listing.batteryRemovable)} /><Check name="chargerIncluded" label="Charger included" checked={Boolean(listing.chargerIncluded)} /></Checks></Section>}
    </>}

    {listing.vertical === "part" && <>
      <Section title="Part identity"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Detailed category"><select name="categoryId" defaultValue={listing.categoryId ?? ""} required className={inputClass}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label="Exact type not listed"><input name="customCategoryName" maxLength={80} defaultValue={listing.customCategoryName ?? ""} className={inputClass} /></Field>
        <Field label="Brand"><input name="brand" maxLength={80} defaultValue={listing.partBrand ?? ""} required className={inputClass} /></Field>
        <Field label="Condition"><select name="condition" defaultValue={listing.partCondition ?? "new"} className={inputClass}><option value="new">Brand new</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></Field>
        <Field label="Part number"><input name="partNumber" maxLength={100} defaultValue={listing.partNumber ?? ""} className={inputClass} /></Field>
        <Field label="OEM/reference number"><input name="oemNumber" maxLength={100} defaultValue={listing.oemNumber ?? ""} className={inputClass} /></Field>
        <Field label="Origin"><select name="partOrigin" defaultValue={listing.partOrigin ?? "not-sure"} className={inputClass}><option value="genuine-oem">Genuine / OEM</option><option value="aftermarket">Aftermarket</option><option value="local">Local</option><option value="imported-used">Imported used / Kabli</option><option value="not-sure">Not sure</option></select></Field>
        <Field label="Side/position"><select name="position" defaultValue={listing.partPosition ?? "not-applicable"} className={inputClass}><option value="not-applicable">Not applicable</option><option value="front">Front</option><option value="rear">Rear</option><option value="left">Left</option><option value="right">Right</option><option value="front-left">Front left</option><option value="front-right">Front right</option><option value="rear-left">Rear left</option><option value="rear-right">Rear right</option></select></Field>
      </div></Section>
      <Section title="Compatibility"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Compatible make"><select name="compatibleMakeId" value={compatibleMakeId} onChange={(event) => changeCompatibleMake(event.target.value)} className={inputClass}><option value="">Universal / not specified</option>{makes.map((make) => <option key={make.id} value={make.id}>{make.name}</option>)}</select></Field>
        <Field label="Compatible model"><select name="compatibleModelId" value={compatibleModelId} onChange={(event) => setCompatibleModelId(event.target.value)} disabled={!compatibleModels.length} className={inputClass}><option value="">All models / not specified</option>{compatibleModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></Field>
        <Field label="Custom make"><input name="customCompatibleMakeName" maxLength={80} defaultValue={listing.customCompatibleMakeName ?? ""} className={inputClass} /></Field>
        <Field label="Custom model"><input name="customCompatibleModelName" maxLength={80} defaultValue={listing.customCompatibleModelName ?? ""} className={inputClass} /></Field>
        <Field label="Fits from year"><select name="compatibleYearFrom" defaultValue={listing.compatibleYearFrom ?? ""} className={inputClass}><option value="">Any</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
        <Field label="Fits to year"><select name="compatibleYearTo" defaultValue={listing.compatibleYearTo ?? ""} className={inputClass}><option value="">Current / any</option>{YEARS.map((year) => <option key={year}>{year}</option>)}</select></Field>
      </div></Section>
      <Section title="Stock and delivery"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Price unit"><select name="priceUnit" defaultValue={listing.priceUnit ?? "piece"} className={inputClass}><option value="piece">Piece</option><option value="pair">Pair</option><option value="set">Set</option><option value="kit">Kit</option><option value="litre">Litre</option></select></Field>
        <Field label="Stock quantity"><input name="stockQty" type="number" min={1} max={10000} defaultValue={listing.stockQty ?? 1} className={inputClass} /></Field>
        <Field label="Warranty months"><input name="warrantyMonths" type="number" min={0} max={120} defaultValue={listing.warrantyMonths ?? 0} className={inputClass} /></Field>
        <Field label="Delivery"><select name="deliveryOption" defaultValue={listing.deliveryOption ?? "pickup"} className={inputClass}><option value="pickup">Buyer pickup</option><option value="courier">Courier</option><option value="pickup-or-courier">Pickup or courier</option></select></Field>
      </div></Section>
    </>}

    <Section title="Price and location" icon={<MapPin size={19} />}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Price (PKR)" error={error("pricePkr")}><input name="pricePkr" type="number" min={listing.vertical === "car" ? 50000 : listing.vertical === "bike" ? 10000 : 500} defaultValue={listing.pricePkr} required className={inputClass} /></Field>
      <Field label="City" error={error("cityId")}><select name="cityId" value={cityId} onChange={(event) => changeCity(event.target.value)} required className={inputClass}>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></Field>
      <Field label="Area"><select name="areaId" value={areaId} onChange={(event) => setAreaId(event.target.value)} className={inputClass}><option value="">Not specified</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field>
      <Field label="Town/city not listed"><input name="customCityName" maxLength={80} defaultValue={listing.customCityName ?? ""} className={inputClass} /></Field>
      <Field label="Area not listed"><input name="customAreaName" maxLength={80} defaultValue={listing.customAreaName ?? ""} className={inputClass} /></Field>
    </div><MapLocationPicker initialLatitude={listing.exactLatitude} initialLongitude={listing.exactLongitude} /><Checks><Check name="isNegotiable" label="Price is negotiable" checked={listing.isNegotiable} /></Checks></Section>

    {listing.vertical !== "part" && <Section title="Features"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{features.map((feature) => <label key={feature.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700"><input type="checkbox" name="featureIds" value={feature.id} defaultChecked={selectedFeatureIds.includes(feature.id)} className="size-4 accent-blue-600" />{feature.name}</label>)}</div><Field label="Other features (comma or line separated)"><textarea name="customFeatureNames" rows={3} maxLength={1600} defaultValue={customFeatures.join(", ")} className={inputClass} /></Field></Section>}

    <Section title="Photos" icon={<Camera size={19} />}>
      <p className="text-sm text-slate-600">Drag photos or use arrows to reorder. The first photo is the primary image. At least one photo is required.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{imageKeys.map((key, index) => <div key={key} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[4/3] bg-slate-100"><Image src={`/uploads/${key}`} alt={`Ad photo ${index + 1}`} fill sizes="200px" className="object-cover" />{index === 0 && <span className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white">PRIMARY</span>}</div>
        <div className="flex items-center justify-between p-1.5"><button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="rounded p-1 text-slate-600 disabled:opacity-25"><ChevronLeft size={17} /></button><button type="button" onClick={() => setImageKeys((keys) => keys.filter((item) => item !== key))} className="rounded p-1 text-red-600"><Trash2 size={16} /></button><button type="button" onClick={() => move(index, index + 1)} disabled={index === imageKeys.length - 1} className="rounded p-1 text-slate-600 disabled:opacity-25"><ChevronRight size={17} /></button></div>
      </div>)}</div>
      <input type="file" accept="image/*" multiple onChange={(event) => upload(event.target.files)} className="block w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-extrabold file:text-white" />
      {uploading && <p className="text-sm text-slate-500">Uploading and optimizing…</p>}{uploadError && <ErrorText>{uploadError}</ErrorText>}{error("imageKeys") && <ErrorText>{error("imageKeys")}</ErrorText>}
      {imageKeys.map((key) => <input key={key} type="hidden" name="imageKeys" value={key} />)}
    </Section>

    <Section title="Description"><textarea name="description" rows={7} maxLength={5000} defaultValue={listing.description ?? ""} className={inputClass} /></Section>
    <button type="submit" disabled={pending || uploading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"><Save size={19} />{pending ? "Saving changes…" : listing.status === "rejected" ? "Save and resubmit ad" : "Save advertisement changes"}</button>
  </form>;
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100";
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">{icon}{title}</h2><div className="mt-5 space-y-4">{children}</div></section>; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-700">{label}{children}{error && <ErrorText>{error}</ErrorText>}</label>; }
function Checks({ children }: { children: React.ReactNode }) { return <div className="flex flex-wrap gap-5 pt-2">{children}</div>; }
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-blue-600" />{label}</label>; }
function ErrorText({ children }: { children?: React.ReactNode }) { return <span role="alert" className="mt-1 block text-xs font-semibold text-red-600">{children}</span>; }
