"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  previewBulkAction,
  commitBulkAction,
  type BulkState,
} from "@/lib/dealers/actions";

/**
 * Two-stage upload: preview, then confirm.
 *
 * A dealer pushing thirty cars live wants to see what will happen first —
 * and when eleven rows have problems, they need to know which eleven and
 * why, by the row number in their own spreadsheet.
 */
export function BulkUploadForm() {
  const [state, action, pending] = useActionState<BulkState, FormData>(
    async (prev, formData) =>
      prev.stage === "preview"
        ? commitBulkAction(prev, formData)
        : previewBulkAction(prev, formData),
    { stage: "idle" },
  );

  if (state.stage === "done") {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
        <h2 className="font-semibold text-emerald-900">
          Imported {state.imported} listing{state.imported === 1 ? "" : "s"}
        </h2>
        {state.quotaBlocked ? (
          <p className="mt-1 text-sm text-emerald-900">
            {state.quotaBlocked} row{state.quotaBlocked === 1 ? "" : "s"} were
            skipped because you&apos;ve reached your plan&apos;s listing quota.
          </p>
        ) : null}

        {state.errors && state.errors.length > 0 && (
          <ErrorTable errors={state.errors} />
        )}

        <div className="mt-4 flex gap-2">
          <Link
            href="/dashboard/dealer"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to console
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      {state.stage === "idle" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium text-slate-700">
            CSV file
          </label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium"
          />
          <button
            type="submit"
            disabled={pending}
            className="mt-4 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Checking…" : "Check file"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Ready to import
          </h2>

          <dl className="mt-3 flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Rows in file</dt>
              <dd className="text-lg font-bold text-slate-900">
                {state.totalRows}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Will import</dt>
              <dd className="text-lg font-bold text-emerald-700">
                {state.validCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Problems</dt>
              <dd className="text-lg font-bold text-amber-700">
                {state.errors?.length ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Slots left on plan</dt>
              <dd className="text-lg font-bold text-slate-900">
                {state.quotaRemaining}
              </dd>
            </div>
          </dl>

          {(state.validCount ?? 0) > (state.quotaRemaining ?? 0) && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Your plan has {state.quotaRemaining} slots left, so only the
              first {state.quotaRemaining} rows will go live. Upgrade to
              publish the rest.
            </p>
          )}

          {state.unmappedColumns && state.unmappedColumns.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Ignored columns: {state.unmappedColumns.join(", ")}
            </p>
          )}

          {state.errors && state.errors.length > 0 && (
            <ErrorTable errors={state.errors} />
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={pending || (state.validCount ?? 0) === 0}
              className="rounded bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending
                ? "Importing…"
                : `Import ${Math.min(state.validCount ?? 0, state.quotaRemaining ?? 0)} listings`}
            </button>
            <Link
              href="/dashboard/dealer/bulk"
              className="rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Start over
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}

function ErrorTable({
  errors,
}: {
  errors: { row: number; field?: string; message: string }[];
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-slate-800">
        Rows we couldn&apos;t import
      </h3>
      <div className="mt-2 max-h-64 overflow-y-auto rounded border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-1.5 font-medium">Row</th>
              <th className="px-3 py-1.5 font-medium">Field</th>
              <th className="px-3 py-1.5 font-medium">Problem</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e, i) => (
              <tr key={`${e.row}-${i}`} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono">{e.row || "header"}</td>
                <td className="px-3 py-1.5 text-slate-500">{e.field ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-700">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
