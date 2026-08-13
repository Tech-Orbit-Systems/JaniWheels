import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser, getActivePlan } from "@/lib/dealers/queries";
import { BulkUploadForm } from "./BulkUploadForm";

export const metadata: Metadata = {
  title: "Bulk upload",
  robots: { index: false, follow: false },
};

export default async function BulkUploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/dealer/bulk");

  const dealer = await getDealerForUser(user.id);
  if (!dealer) redirect("/dealers/register");

  const plan = await getActivePlan(dealer.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/dashboard/dealer" className="text-sm text-blue-700 hover:underline">
        ← Dealer console
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        Bulk upload inventory
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Upload a CSV of your stock. We&apos;ll show you exactly what will be
        imported before anything goes live.
      </p>

      {!plan?.bulkUpload ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            Bulk upload is included in the <strong>Showroom</strong> plan and
            above.
          </p>
          <Link
            href="/dashboard/dealer"
            className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            See plans
          </Link>
        </div>
      ) : (
        <BulkUploadForm />
      )}

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">File format</h2>
        <p className="mt-1 text-sm text-slate-600">
          One row per car. Column names are matched loosely, so an existing
          export usually works as-is.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Column</th>
                <th className="py-1 pr-4 font-medium">Required</th>
                <th className="py-1 font-medium">Also accepted</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {[
                ["make", "yes", "brand, manufacturer"],
                ["model", "yes", "—"],
                ["year", "yes", "model year, reg year"],
                ["price", "yes", "asking price — “48.5 lacs” works"],
                ["city", "yes", "location"],
                ["variant", "no", "trim, version"],
                ["mileage", "no", "km, kms, driven"],
                ["color", "no", "colour"],
                ["assembly", "no", "origin — local or imported"],
                ["description", "no", "details, comments, remarks"],
              ].map(([c, req, alt]) => (
                <tr key={c} className="border-t border-slate-100">
                  <td className="py-1 pr-4 font-mono">{c}</td>
                  <td className="py-1 pr-4">{req}</td>
                  <td className="py-1 text-slate-500">{alt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Make and model must match our catalogue — we never invent a model
          from a spelling we don&apos;t recognise, because that would break
          price comparisons for everyone. Any row we can&apos;t match is
          reported back with its row number.
        </p>
      </section>
    </main>
  );
}
