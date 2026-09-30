import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { removeStoredImage, storeImage } from "../src/lib/images/storage";
import { imageDeliveryUrl } from "../src/lib/images/url";

const temp = await mkdtemp(path.join(tmpdir(), "janiwheels-upload-check-"));
process.env.IMAGE_PROVIDER = "local";
process.env.UPLOAD_DIR = temp;

let failed = 0;
function check(name: string, passed: boolean) {
  if (!passed) failed++;
  console.log(`${passed ? "✓" : "✗"} ${name}`);
}

try {
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#1d4ed8" },
  }).png().toBuffer();
  const valid = await storeImage(new File([new Uint8Array(png)], "car.png", { type: "image/png" }));
  check("decodable image accepted", valid.ok);

  if (valid.ok) {
    const stored = await readFile(path.join(temp, valid.image.key));
    check("original is re-encoded as WebP", valid.image.key.endsWith(".webp") && stored.subarray(8, 12).toString("ascii") === "WEBP");
    check("generated key has safe format", /^\d{6}\/[a-f0-9]{32}\.webp$/.test(valid.image.key));
    check("owned storage object can be removed", await removeStoredImage(valid.image.key));
  }

  const disguised = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not an image")]);
  const invalid = await storeImage(new File([new Uint8Array(disguised)], "attack.jpg", { type: "image/jpeg" }));
  check("magic-byte-only fake is rejected", !invalid.ok);
  check("unsafe cleanup key is rejected", !(await removeStoredImage("../../secret.jpg")));

  process.env.IMAGE_PROVIDER = "s3";
  let rejectedUpload = false;
  let rejectedCleanup = false;
  try { await storeImage(new File([new Uint8Array(png)], "unsupported.png", { type: "image/png" })); }
  catch (error) { rejectedUpload = error instanceof Error && error.message.includes("Unsupported IMAGE_PROVIDER"); }
  try { await removeStoredImage("202609/0123456789abcdef0123456789abcdef.webp"); }
  catch (error) { rejectedCleanup = error instanceof Error && error.message.includes("Unsupported IMAGE_PROVIDER"); }
  check("unsupported storage provider cannot silently write locally", rejectedUpload && rejectedCleanup);
  process.env.IMAGE_PROVIDER = "local";

  process.env.NEXT_PUBLIC_IMAGE_PROVIDER = "s3";
  let rejectedDelivery = false;
  try { imageDeliveryUrl("202609/0123456789abcdef0123456789abcdef.webp", 480); }
  catch (error) { rejectedDelivery = error instanceof Error && error.message.includes("Unsupported NEXT_PUBLIC_IMAGE_PROVIDER"); }
  check("unsupported delivery provider cannot silently use local URLs", rejectedDelivery);
  process.env.NEXT_PUBLIC_IMAGE_PROVIDER = "local";
} finally {
  await rm(temp, { recursive: true, force: true });
}

if (failed) process.exit(1);
