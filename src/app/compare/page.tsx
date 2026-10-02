import type { Metadata } from "next";
import Image from "@/components/StoredImage";
import Link from "next/link";
import { getListingDetail } from "@/lib/listings/detail";
import { buildListingPath } from "@/lib/listings/slug";
import { formatPkrExact, formatMileage, formatEngine } from "@/lib/format";

export const metadata: Metadata = { title: "Compare vehicles", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const vertical = sp.type === "bike" ? "bike" : "car";
  const raw = Array.isArray(sp.ids) ? sp.ids[0] : sp.ids;
  const ids = [...new Set((raw ?? "").split(",").map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 3);
  const resolved = await Promise.all(ids.map(id => getListingDetail(id, vertical)));
  const rows = resolved.filter((row): row is NonNullable<typeof row> => Boolean(row && row.status === "active" && row.vertical === vertical));
  const specs = vertical === "car"
    ? ["price", "year", "mileage", "engine", "transmission", "fuel", "body", "assembly", "colour", "registered", "owners"] as const
    : ["price", "year", "mileage", "engine", "fuel", "type", "condition", "range", "battery", "topSpeed", "documents"] as const;
  return <main className="mx-auto w-full max-w-7xl px-4 py-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">Compare {vertical === "bike" ? "bikes" : "cars"}</h1><p className="mt-1 text-sm text-slate-500">Up to three active vehicles, side by side.</p></div><Link href={vertical === "bike" ? "/used-bikes" : "/used-cars"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Add or change vehicles</Link></div>
    {rows.length < 2 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">Choose at least two active {vertical === "bike" ? "bikes" : "cars"} using the Compare buttons on listing cards.</div> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[720px] table-fixed border-collapse"><thead><tr><th className="w-40 border-b border-r border-slate-200 bg-slate-50 p-3 text-left text-xs uppercase text-slate-500">Vehicle</th>{rows.map(row => <th key={row.id} className="border-b border-slate-200 p-3 text-left align-top"><Link href={buildListingPath(vertical, row.slug, row.id)}><div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">{row.images[0] && <Image src={`/uploads/${row.images[0].key}`} alt={row.title} fill sizes="280px" className="object-cover" />}</div><span className="text-sm font-bold text-slate-950 hover:text-[#8a6500]">{row.title}</span><span className="mt-1 block text-xs font-normal text-slate-500">{row.cityName}</span></Link></th>)}</tr></thead><tbody>{specs.map(key => <tr key={key}><th className="border-r border-t border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase text-slate-500">{specLabel(key)}</th>{rows.map(row => <td key={row.id} className="border-t border-slate-200 p-3 text-sm font-semibold text-slate-800">{specValue(row, key)}</td>)}</tr>)}</tbody></table></div>}
  </main>;
}

function specLabel(key: string) { return ({ price: "Price", year: "Model year", mileage: "Mileage", engine: "Engine / motor", transmission: "Transmission", fuel: "Fuel", body: "Body type", assembly: "Assembly", colour: "Colour", registered: "Registered in", owners: "Owners", type: "Bike type", condition: "Condition", range: "Claimed range", battery: "Battery", topSpeed: "Top speed", documents: "Documents" } as Record<string, string>)[key] ?? key; }
function title(value: string | null) { return value ? value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "—"; }
function specValue(row: NonNullable<Awaited<ReturnType<typeof getListingDetail>>>, key: string): string {
  switch (key) {
    case "price": return formatPkrExact(row.pricePkr); case "year": return row.year ? String(row.year) : "—";
    case "mileage": return formatMileage(row.mileageKm); case "engine": return row.fuel === "electric" && row.bikeMotorPowerWatts ? `${row.bikeMotorPowerWatts.toLocaleString()} W` : formatEngine(row.engineCc);
    case "transmission": return title(row.transmission); case "fuel": return title(row.fuel); case "body": return title(row.bodyType); case "assembly": return title(row.assembly); case "colour": return row.color ?? "—";
    case "registered": return row.isUnregistered ? "Un-Registered" : row.registeredCityName ?? "—"; case "owners": return row.ownerCount ? String(row.ownerCount) : "—";
    case "type": return title(row.bikeType); case "condition": return title(row.bikeCondition); case "range": return row.bikeClaimedRangeKm ? `${row.bikeClaimedRangeKm} km` : "—";
    case "battery": return [row.bikeBatteryVoltage && `${row.bikeBatteryVoltage}V`, row.bikeBatteryCapacityAh && `${row.bikeBatteryCapacityAh}Ah`, row.bikeBatteryType && title(row.bikeBatteryType)].filter(Boolean).join(" · ") || "—";
    case "topSpeed": return row.bikeTopSpeedKph ? `${row.bikeTopSpeedKph} km/h` : "—"; case "documents": return row.bikeHasDocuments ? "Available" : "Not available"; default: return "—";
  }
}
