import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import sharp from "sharp";
import { privateCloudflareUrl } from "../src/lib/images/cloudflare";
import { readStoredImage, removeStoredImage, storeImage } from "../src/lib/images/storage";
import { imageDeliveryUrl } from "../src/lib/images/url";
import { UPLOAD_KEY } from "../src/lib/images/keys";

const id = "11223344-5566-7788-99aa-bbccddeeff00";
const key = `cf/${id}`;
Object.assign(process.env, { IMAGE_PROVIDER: "cloudflare", NEXT_PUBLIC_IMAGE_PROVIDER: "cloudflare",
  CF_IMAGES_ACCOUNT_ID: "test-account", CF_IMAGES_API_TOKEN: "test-token",
  NEXT_PUBLIC_CF_IMAGES_HASH: "test-hash", CF_IMAGES_PRIVATE_VARIANT: "private", CF_IMAGES_SIGNING_KEY: "test-signing-key" });
const originalFetch = globalThis.fetch;
const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer();
try {
  const signed = new URL(privateCloudflareUrl(key, 1_000_000));
  assert.equal(signed.searchParams.get("exp"), "1060");
  assert.equal(signed.searchParams.get("sig"), createHmac("sha256", "test-signing-key").update(`/test-hash/${id}/private?exp=1060`).digest("hex"));
  assert.equal(imageDeliveryUrl(key, 480), `/uploads/${key}`);
  assert.ok(UPLOAD_KEY.test(key));
  assert.throws(() => privateCloudflareUrl("202610/0123456789abcdef0123456789abcdef.webp"));
  let mode = "upload";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === "DELETE") {
      assert.ok(url.endsWith(`/images/v1/${id}`));
      return new Response(null, { status: 200 });
    }
    if (url.startsWith("https://api.cloudflare.com/")) {
      const form = init?.body as FormData;
      assert.equal(form.get("requireSignedURLs"), "true");
      assert.equal(form.has("id"), false);
      return Response.json({ success: true, result: { id, requireSignedURLs: mode !== "unsafe" } });
    }
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.ok(new URL(url).searchParams.has("sig"));
    if (mode === "missing") return new Response(null, { status: 404 });
    if (mode === "failure") return new Response("provider secret", { status: 503 });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
  };
  const upload = () => storeImage(new File([new Uint8Array(png)], "photo.png", { type: "image/png" }));
  const result = await upload();
  assert.ok(result.ok && result.image.key === key);
  assert.equal((await readStoredImage(key))?.subarray(8, 12).toString(), "WEBP");
  assert.ok(await removeStoredImage(key));
  mode = "unsafe";
  assert.equal((await upload()).ok, false);
  mode = "missing";
  assert.equal(await readStoredImage(key), null);
  mode = "failure";
  await assert.rejects(readStoredImage(key), /Private image delivery failed/);
  delete process.env.CF_IMAGES_SIGNING_KEY;
  assert.equal((await upload()).ok, false);
  await assert.rejects(readStoredImage(key), /not configured/);
  console.log("Cloudflare private upload, signing, proxy, cleanup and failure checks passed (mock provider).");
} finally { globalThis.fetch = originalFetch; }
