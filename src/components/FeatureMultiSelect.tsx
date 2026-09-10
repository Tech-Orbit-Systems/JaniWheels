"use client";

import { ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";

export type FeatureChoice = {
  id: number;
  name: string;
  groupName: string;
};

export function FeatureMultiSelect({
  features,
  defaultSelectedIds = [],
}: {
  features: FeatureChoice[];
  defaultSelectedIds?: number[];
}) {
  const labelId = useId();
  const [selectedIds, setSelectedIds] = useState(() => new Set(defaultSelectedIds));
  const grouped = features.reduce<Record<string, FeatureChoice[]>>((groups, feature) => {
    (groups[feature.groupName] ??= []).push(feature);
    return groups;
  }, {});
  const selected = features.filter((feature) => selectedIds.has(feature.id));

  function setSelected(id: number, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div>
      <span id={labelId} className="block text-sm font-bold text-slate-700">Select features</span>
      <details className="group relative mt-1.5">
        <summary
          aria-labelledby={labelId}
          className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none marker:content-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20"
        >
          <span className={selected.length ? "font-semibold" : "text-slate-500"}>
            {selected.length ? `${selected.length} feature${selected.length === 1 ? "" : "s"} selected` : "Choose one or more features"}
          </span>
          <ChevronDown size={18} className="shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
        </summary>

        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          {Object.entries(grouped).map(([group, items]) => (
            <fieldset key={group} className="border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0">
              <legend className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">{group}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {items.map((feature) => (
                  <label key={feature.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      name="featureIds"
                      value={feature.id}
                      checked={selectedIds.has(feature.id)}
                      onChange={(event) => setSelected(feature.id, event.target.checked)}
                      className="size-4 accent-blue-600"
                    />
                    {feature.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
          {selected.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => setSelected(feature.id, false)}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              aria-label={`Remove ${feature.name}`}
            >
              {feature.name}<X size={13} aria-hidden />
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">You can select more than one option.</p>
    </div>
  );
}
