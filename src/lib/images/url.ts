export function imageDeliveryUrl(key: string, _width: number): string {
  void _width; // Private uploads use the bounded provider variant, never a public optimizer URL.
  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER ?? "local";
  if (provider !== "local" && provider !== "cloudflare") throw new Error(`Unsupported NEXT_PUBLIC_IMAGE_PROVIDER: ${provider}`);
  return `/uploads/${key}`;
}
