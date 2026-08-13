/**
 * Flat-rate EMI.
 *
 * This is how car financing is actually quoted in Pakistan — the markup is
 * calculated on the full principal for the whole term, not on the reducing
 * balance.
 *
 * Using the standard reducing-balance amortisation formula here would
 * understate the monthly payment by a wide margin, and every lead would be
 * annoyed when the bank's real figure arrived. A calculator that flatters
 * the number is worse than no calculator.
 *
 * Kept out of actions.ts because every export from a "use server" module
 * must be an async function.
 */
export function calculateEmi(
  principalPkr: number,
  annualRatePct: number,
  months: number,
): { monthlyPkr: number; totalPkr: number; totalInterestPkr: number } {
  if (principalPkr <= 0 || months <= 0) {
    return { monthlyPkr: 0, totalPkr: 0, totalInterestPkr: 0 };
  }

  const interest = principalPkr * (annualRatePct / 100) * (months / 12);
  const total = principalPkr + interest;

  return {
    monthlyPkr: Math.round(total / months),
    totalPkr: Math.round(total),
    totalInterestPkr: Math.round(interest),
  };
}
