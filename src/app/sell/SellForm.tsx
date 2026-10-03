"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createCarListingAction,
  type SellState,
} from "@/lib/listings/sell-actions";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { FeatureMultiSelect } from "@/components/FeatureMultiSelect";

interface Option {
  id: number;
  name: string;
}
interface FeatureOption extends Option {
  groupName: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

/**
 * The listing wizard.
 *
 * One scrolling page rather than a multi-step flow. Every step boundary is a
 * place a seller on a phone drops out, and this form is short enough not to
 * need them. The only genuinely required decisions are variant, city, year,
 * price, mileage and one photo.
 *
 * Make/model/variant cascade from the taxonomy API — a seller cannot type a
 * model name. Ad-local fallback labels cover rare vehicles without changing
 * the curated taxonomy used by search facets and price analytics.
 */
export function SellForm({
  makes,
  cities,
  features,
}: {
  makes: Option[];
  cities: Option[];
  features: FeatureOption[];
}) {
  const [state, action, pending] = useActionState<SellState, FormData>(
    createCarListingAction,
    {},
  );

  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [cityId, setCityId] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [variants, setVariants] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUnregistered, setIsUnregistered] = useState(false);
  const [hasAuctionSheet, setHasAuctionSheet] = useState(false);

  useEffect(() => {
    if (!makeId) return setModels([]);
    fetch(`/api/taxonomy?makeId=${makeId}`)
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []));
    setModelId("");
    setVariants([]);
  }, [makeId]);

  useEffect(() => {
    if (!modelId) return setVariants([]);
    fetch(`/api/taxonomy?modelId=${modelId}`)
      .then((r) => r.json())
      .then((d) => setVariants(d.variants ?? []));
  }, [modelId]);

  useEffect(() => {
    if (!cityId) return setAreas([]);
    fetch(`/api/taxonomy?cityId=${cityId}`)
      .then((r) => r.json())
      .then((d) => setAreas(d.areas ?? []));
  }, [cityId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);

    const body = new FormData();
    Array.from(files).forEach((f) => body.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (data.keys?.length) setImageKeys((k) => [...k, ...data.keys]);
      if (data.errors?.length) setUploadError(data.errors.join(" "));
      if (!res.ok) setUploadError(data.error ?? "Upload failed.");
    } catch {
      setUploadError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <Section title="Which car?">
        <Field label="Make" error={err("variantId")}>
          <select
            value={makeId}
            onChange={(e) => setMakeId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Model">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className={selectClass}
            disabled={!models.length}
          >
            <option value="">Select model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Variant"
          hint="Exact variant — this is what powers the price comparison buyers see."
          error={err("variantId")}
        >
          <select name="variantId" className={selectClass} disabled={!variants.length}>
            <option value="">Select variant</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>

        <details className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-blue-800">Make, model or variant not listed?</summary>
          <p className="mt-2 text-xs text-blue-700">Enter the missing details below. They are saved only on this ad and do not become marketplace filters.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Make name" error={err("customMakeName")}><input name="customMakeName" maxLength={80} className={inputClass} placeholder="e.g. Geely" /></Field>
            <Field label="Model name" error={err("customModelName")}><input name="customModelName" maxLength={80} className={inputClass} placeholder="e.g. CK" /></Field>
            <Field label="Variant / trim"><input name="customVariantName" maxLength={80} className={inputClass} placeholder="Optional" /></Field>
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model year" error={err("year")}>
            <select name="year" className={selectClass} required>
              <option value="">Select year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>

          <Field label="Mileage (km)" error={err("mileageKm")}>
            <input name="mileageKm" type="number" inputMode="numeric" min={0} placeholder="73000" className={inputClass} required />
          </Field>
        </div>
      </Section>

      <Section title="Where is it?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={err("cityId")}>
            <select
              name="cityId"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Select city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Area (optional)">
            <select name="areaId" className={selectClass} disabled={!areas.length}>
              <option value="">Select area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="City / town not listed" hint="Enter it for this ad, and select its nearest official city or district above for search.">
          <input name="customCityName" maxLength={80} className={inputClass} placeholder="Town or municipality" />
        </Field>
        <Field label="Locality / area not listed" hint="Saved only on this ad. Select the nearest official city above.">
          <input name="customAreaName" maxLength={80} className={inputClass} placeholder="Town, society, sector or village" />
        </Field>
        <MapLocationPicker />
      </Section>

      <Section title="Condition & price">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (PKR)" hint="Enter the full amount, e.g. 4800000" error={err("pricePkr")}>
            <input name="pricePkr" type="number" inputMode="numeric" min={50000} placeholder="4800000" className={inputClass} required />
          </Field>

          <Field label="Assembly">
            <select name="assembly" className={selectClass} defaultValue="local">
              <option value="local">Local</option>
              <option value="imported">Imported</option>
            </select>
          </Field>

          <Field label="Colour">
            <input name="color" type="text" placeholder="White" className={inputClass} />
          </Field>

          <Field label="Number of owners">
            <input name="ownerCount" type="number" inputMode="numeric" min={1} max={20} className={inputClass} />
          </Field>
          {!isUnregistered && (
            <>
              <Field label="Registered city" error={err("registeredCityId")}>
                <select name="registeredCityId" className={selectClass}>
                  <option value="">Not specified</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
              </Field>
              <Field label="Last token paid year" error={err("lastTokenPaidYear")}>
                <select name="lastTokenPaidYear" className={selectClass}>
                  <option value="">Not specified</option>
                  {YEARS.filter((year) => year >= 1990).map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </Field>
            </>
          )}
          {hasAuctionSheet && (
            <Field label="Auction grade" error={err("auctionGrade")}>
              <input name="auctionGrade" type="text" maxLength={10} placeholder="e.g. 4.5" className={inputClass} />
            </Field>
          )}
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <Check name="isNegotiable" label="Price negotiable" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="isUnregistered" checked={isUnregistered} onChange={(event) => setIsUnregistered(event.target.checked)} className="h-4 w-4" />Unregistered</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="hasAuctionSheet" checked={hasAuctionSheet} onChange={(event) => setHasAuctionSheet(event.target.checked)} className="h-4 w-4" />Auction sheet available</label>
        </div>
      </Section>

      <Section title="Photos" hint="Listings without photos barely sell. Six or more is ideal.">
        <label className="block text-sm font-medium text-slate-700">Choose car photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => upload(e.target.files)}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium"
          />
        </label>
        {uploading && <p className="mt-2 text-sm text-slate-500">Uploading…</p>}
        {uploadError && <p role="alert" className="mt-2 text-sm text-red-600">{uploadError}</p>}
        {err("imageKeys") && <p role="alert" className="mt-2 text-sm text-red-600">{err("imageKeys")}</p>}

        {imageKeys.length > 0 && (
          <p className="mt-2 text-sm text-emerald-700">
            {imageKeys.length} photo{imageKeys.length === 1 ? "" : "s"} added
          </p>
        )}
        {imageKeys.map((k) => (
          <input key={k} type="hidden" name="imageKeys" value={k} />
        ))}
      </Section>

      <Section title="Features">
        <FeatureMultiSelect features={features} />
        <Field label="Other features not listed" hint="Separate multiple features with commas. These stay on this ad and never become filters automatically.">
          <textarea name="customFeatureNames" rows={2} maxLength={800} className={inputClass} placeholder="Example: cassette player, manual choke, solar ventilation fan" />
        </Field>
      </Section>

      <Section
        title="Description"
        hint="Phone numbers and links are removed automatically — buyers reach you through the Show number button, which is how we can prove the ad worked."
      >
        <textarea
          name="description"
          rows={6}
          maxLength={5000}
          placeholder="Condition, service history, anything that needs attention…"
          className={inputClass}
        />
      </Section>

      <button
        type="submit"
        disabled={pending || uploading}
        className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post ad — free"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded border border-slate-300 px-3 py-2.5 text-base text-slate-900";
const selectClass = inputClass + " bg-white";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className={hint ? "space-y-4" : "mt-3 space-y-4"}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        <span className="mt-1 block">{children}</span>
      </label>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} className="h-4 w-4" />
      {label}
    </label>
  );
}
