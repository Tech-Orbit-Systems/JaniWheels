import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { readLocalStoredImage, removeStoredImage, storeImage } from "../src/lib/images/storage";
import { imageDeliveryUrl } from "../src/lib/images/url";
import { boundedFormData } from "../src/lib/security/bounded-form-data";
import { clientIp } from "../src/lib/security/client-ip";

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
  const svg = await storeImage(new File(["<svg onload='alert(1)'/>"] , "attack.jpg", { type: "image/jpeg" }));
  check("SVG disguised as JPEG is rejected", !svg.ok);
  const oversized = await storeImage(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  check("file over ten MiB is rejected before decode", !oversized.ok);
  const tainted = await storeImage(new File([new Uint8Array(Buffer.concat([png, Buffer.from("<script>alert(1)</script>")]))], "polyglot.png", { type: "image/png" }));
  if (tainted.ok) {
    const clean = await readFile(path.join(temp, tainted.image.key));
    check("trailing script is stripped by re-encoding", !clean.includes(Buffer.from("<script>")));
    await removeStoredImage(tainted.image.key);
  } else check("trailing script is stripped by re-encoding", true);
  const form = new FormData();
  form.append("files", new File([new Uint8Array(png)], "car.png", { type: "image/png" }));
  const request = new Request("http://localhost/upload", { method: "POST", body: form });
  const received = await boundedFormData(request, 1024 * 1024);
  check("multipart body within byte cap parses", received?.getAll("files").length === 1);
  const second = new Request("http://localhost/upload", { method: "POST", body: form });
  const bytes = new Uint8Array(await second.arrayBuffer());
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(bytes); controller.close(); } });
  const streamed = new Request("http://localhost/upload", { method: "POST", headers: { "content-type": second.headers.get("content-type")! }, body: stream, duplex: "half" } as RequestInit);
  let capped = false;
  try { await boundedFormData(streamed, 50); }
  catch (error) { capped = error instanceof RangeError && error.message === "UPLOAD_REQUEST_TOO_LARGE"; }
  check("body without Content-Length still hits byte cap", capped);
  const savedHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  try {
    const forged = new Headers({ "x-real-ip": "203.0.113.40", "cf-connecting-ip": "198.51.100.99" });
    delete process.env.TRUSTED_PROXY_IP_HEADER;
    check("unconfigured proxy headers are ignored", clientIp(forged) === null);
    process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
    check("only configured proxy header is read", clientIp(forged) === "203.0.113.40");
    check("IP lists and malformed values are rejected", clientIp(new Headers({ "x-real-ip": "203.0.113.40, 198.51.100.99" })) === null);
  } finally { if (savedHeader === undefined) delete process.env.TRUSTED_PROXY_IP_HEADER; else process.env.TRUSTED_PROXY_IP_HEADER = savedHeader; }
  check("unsafe cleanup key is rejected", !(await removeStoredImage("../../secret.jpg")));
  await mkdir(path.join(temp, "listings"));
  await writeFile(path.join(temp, "listings", "legacy-fixture.jpg"), await sharp(png).jpeg().toBuffer());
  const legacy = await readLocalStoredImage("listings/legacy-fixture.jpg");
  check("legacy development photos remain readable as safe WebP after migration", legacy?.subarray(8, 12).toString("ascii") === "WEBP");
  check("legacy storage cannot traverse directories", await readLocalStoredImage("listings/../secret.jpg") === null);

  process.env.UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
  let rejectedPublicStorage = false;
  try { await storeImage(new File([new Uint8Array(png)], "private.png", { type: "image/png" })); }
  catch (error) { rejectedPublicStorage = error instanceof Error && error.message.includes("outside public/"); }
  check("local storage cannot bypass authorization through public files", rejectedPublicStorage);
  process.env.UPLOAD_DIR = temp;

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
