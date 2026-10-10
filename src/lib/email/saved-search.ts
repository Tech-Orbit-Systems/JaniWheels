import "server-only";

export interface AlertEmail { from: string; to: string[]; subject: string; text: string }

export function buildAlertEmail(to: string, title: string, listingPath: string): AlertEmail {
  const from = process.env.EMAIL_FROM;
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  if (!from || !["https:", "http:"].includes(origin.protocol)) throw new Error("Alert email is not configured.");
  return { from, to: [to], subject: "A new match on JaniWheels",
    text: `${title}\n\nView this listing: ${new URL(listingPath, origin.origin)}\n\nManage or turn off your saved-search alerts: ${origin.origin}/dashboard/saved-searches\n\nYou received this because alerts are enabled for your saved search.` };
}

export async function sendAlertEmail(payload: AlertEmail, key: string): Promise<void> {
  const token = process.env.RESEND_API_KEY;
  if (!token) throw new Error("Alert email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Alert provider HTTP ${response.status}`);
}
