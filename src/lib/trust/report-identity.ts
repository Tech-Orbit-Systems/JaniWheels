import { createHmac } from "node:crypto";
import { clientIp } from "@/lib/security/client-ip";

/** A trusted source can file only one anonymous report for the same ad. */
export function anonymousReportId(headers: Headers, cookieId: string | null): string | null {
  if (!process.env.TRUSTED_PROXY_IP_HEADER) return cookieId;
  const ip = clientIp(headers);
  const secret = process.env.SESSION_SECRET;
  if (!ip || !secret) return null;
  return `src:${createHmac("sha256", secret).update(`listing-report\0${ip}`).digest("hex")}`;
}
