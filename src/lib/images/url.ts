export function imageDeliveryUrl(key: string, width: number): string {
  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? "local";
  if (provider === "cloudflare") {
    return `https://imagedelivery.net/${process.env.NEXT_PUBLIC_CF_IMAGES_HASH}/${key}/w=${width}`;
  }
  return `/uploads/${key}`;
}
