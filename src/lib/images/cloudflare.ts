import "server-only";
import { createHmac } from "node:crypto";
import { CLOUDFLARE_KEY } from "./keys";

export function privateCloudflareUrl(key: string, now = Date.now()): string {
  const id = CLOUDFLARE_KEY.exec(key)?.[1];
  const hash = process.env.NEXT_PUBLIC_CF_IMAGES_HASH;
  const variant = process.env.CF_IMAGES_PRIVATE_VARIANT;
  const secret = process.env.CF_IMAGES_SIGNING_KEY;
  if (!id || !hash || !/^[\w-]+$/.test(hash) || !variant || !/^[\w-]+$/.test(variant) || !secret) {
    throw new Error("Private image delivery is not configured.");
  }
  const url = new URL(`https://imagedelivery.net/${hash}/${id}/${variant}`);
  url.searchParams.set("exp", String(Math.floor(now / 1000) + 60));
  url.searchParams.set("sig", createHmac("sha256", secret).update(url.pathname + "?" + url.searchParams.toString()).digest("hex"));
  return url.toString();
}

export async function readPrivateCloudflareImage(key: string): Promise<Buffer | null> {
  // Keep the signed URL server-side. Every browser request must recheck current visibility.
  const response = await fetch(privateCloudflareUrl(key), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("Private image delivery failed.");
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 10 * 1024 * 1024) throw new Error("Image delivery exceeded the size limit.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}
