"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Option {
  id: number;
  name: string;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Navigates rather than fetching, so every valuation is a real shareable URL
 * and the back button works. The only client state is the cascading
 * dropdowns, which need it.
 */
export function CalculatorForm({
  makes,
  cities,
}: {
  makes: Option[];
  cities: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<Option[]>([]);
  const [variants, setVariants] = useState<Option[]>([]);

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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const qs = new URLSearchParams();

    for (const k of ["variantId", "year", "cityId", "mileage"]) {
      const v = form.get(k);
      if (v) qs.set(k, String(v));
    }
    const modelName = models.find((m) => String(m.id) === modelId)?.name;
    if (modelName) qs.set("modelName", modelName);

    router.push(`/price-calculator?${qs.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make">
          <select
            value={makeId}
            onChange={(e) => setMakeId(e.target.value)}
            required
            className={input}
          >
            <option value="">Select make</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Model">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            required
            disabled={!models.length}
            className={input}
          >
            <option value="">Select model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Variant">
          <select name="variantId" required disabled={!variants.length} className={input}>
            <option value="">Select variant</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Model year">
          <select
            name="year"
            required
            className={input}
            defaultValue={params.get("year") ?? ""}
          >
            <option value="">Select year</option>
            {Array.from({ length: 26 }, (_, i) => CURRENT_YEAR - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>

        <Field label="City (optional)">
          <select name="cityId" className={input} defaultValue={params.get("cityId") ?? ""}>
            <option value="">Any city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mileage in km (optional)">
          <input
            name="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="73000"
            defaultValue={params.get("mileage") ?? ""}
            className={input}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
      >
        Calculate value
      </button>
    </form>
  );
}

const input =
  "w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
