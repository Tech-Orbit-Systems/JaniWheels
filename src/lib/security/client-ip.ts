import { isIP } from "node:net";

/** Read only the header that the deployment's last trusted proxy overwrites. */
export function clientIp(headers: Headers): string | null {
  const header = process.env.TRUSTED_PROXY_IP_HEADER;
  if (!["cf-connecting-ip", "x-real-ip", "x-forwarded-for"].includes(header ?? "")) return null;
  const ip = headers.get(header!)?.trim();
  // A trusted proxy supplies one canonical address, never a client-supplied chain.
  return ip && isIP(ip) ? ip : null;
}
