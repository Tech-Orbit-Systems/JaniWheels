/**
 * Pakistani number formatting.
 *
 * Prices in this market are spoken in lacs and crore, not millions. A listing
 * that says "PKR 4,800,000" reads as foreign; "PKR 48 lacs" is what a buyer
 * actually says out loud. Get this wrong and the site feels imported.
 *
 *   1 lac (lakh) = 100,000
 *   1 crore      = 100 lacs = 10,000,000
 */

const LAC = 100_000;
const CRORE = 10_000_000;

/** Strip trailing ".0" so we render "48 lacs", not "48.0 lacs". */
function trim(n: number, dp: number): string {
  return Number(n.toFixed(dp)).toString();
}

export function formatPkr(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";

  if (amount >= CRORE) {
    return `PKR ${trim(amount / CRORE, 2)} crore`;
  }
  if (amount >= LAC) {
    // Two decimals below 10 lacs (7.25 lacs), one above (53.5 lacs) — matches
    // how prices are quoted in practice.
    const lacs = amount / LAC;
    return `PKR ${trim(lacs, lacs < 10 ? 2 : 1)} lacs`;
  }
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

/** Full precision, for the price field on a detail page and for schema.org. */
export function formatPkrExact(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function formatMileage(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString("en-PK")} km`;
}

export function formatEngine(cc: number | null | undefined): string {
  return cc == null ? "—" : `${cc.toLocaleString("en-PK")} cc`;
}

/**
 * Normalize a Pakistani phone number to E.164.
 * Accepts 03001234567, 3001234567, +923001234567, 0092-300-1234567.
 * Returns null when the input is not a valid PK mobile number.
 */
export function normalizePkPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");

  let national: string | null = null;
  if (digits.startsWith("0092")) national = digits.slice(4);
  else if (digits.startsWith("92")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // PK mobile numbers are 10 digits nationally and start with 3.
  if (!/^3\d{9}$/.test(national)) return null;
  return `+92${national}`;
}

/** 0300 1234567 — how the number is displayed once revealed. */
export function displayPkPhone(e164: string): string {
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164);
  if (!m) return e164;
  return `0${m[1]} ${m[2]}`;
}

/** Masked form shown before the reveal event fires. */
export function maskPkPhone(e164: string): string {
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164);
  if (!m) return "03XXXXXXXXX";
  return `0${m[1]} XXXXXXX`;
}

export function relativeTime(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  return `${Math.floor(months / 12)} year${months < 24 ? "" : "s"} ago`;
}
