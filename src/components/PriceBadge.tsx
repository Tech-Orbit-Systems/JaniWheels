import {
  VERDICT_LABEL,
  type PricePosition,
} from "@/lib/listings/price-position";

/**
 * Price vs market.
 *
 * The differentiator. A buyer looking at "PKR 48 lacs" has no idea whether
 * that is a bargain or a fantasy, and the incumbent has owned the data to
 * tell them for twenty years without ever doing it.
 *
 * The honesty rules are the feature. It renders nothing on a thin sample
 * rather than guessing, and it always states its basis — "below the median
 * of 34 similar cars in Lahore" is evidence a buyer can weigh, where "below
 * market" is just a claim.
 */

const STYLES: Record<string, string> = {
  great_price: "bg-emerald-50 text-emerald-800 border-emerald-200",
  good_price: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fair_price: "bg-slate-50 text-slate-700 border-slate-200",
  above_market: "bg-amber-50 text-amber-800 border-amber-200",
};

export function PriceBadge({ position }: { position: PricePosition }) {
  if (position.verdict === "unknown" || position.deltaPct === null) return null;

  const delta = position.deltaPct;
  const direction =
    delta < 0 ? `${Math.abs(delta)}% below` : delta > 0 ? `${delta}% above` : "at";

  return (
    <div
      className={`mt-2 rounded-md border px-3 py-2 text-sm ${STYLES[position.verdict]}`}
    >
      <span className="font-semibold">{VERDICT_LABEL[position.verdict]}</span>
      <span className="mx-1.5" aria-hidden>
        ·
      </span>
      <span>
        {direction} the {position.basis}
      </span>
    </div>
  );
}
