import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Image storage.
 *
 * Photos are the single heaviest thing this site serves — 20 phone photos per
 * car, and most buyers are on a mid-range Android over 4G. Two decisions
 * follow from that:
 *
 *   1. Store a KEY, never a URL. `listing_images.storage_key` holds an opaque
 *      key so moving CDN later is a config change, not a data migration over
 *      millions of rows.
 *   2. Never serve the original. A 4MB 4000x3000 phone JPEG resized on the fly
 *      to 480px is the difference between a search page that loads and one
 *      that doesn't.
 *
 * `local` writes to public/uploads and is fine for development. It is not
 * fine for production — you will run out of disk and have no CDN in front.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Where the `local` provider writes.
 *
 * Deliberately NOT bare `process.cwd()`. The server's working directory is
 * not guaranteed to be the project root — a systemd unit with a different
 * WorkingDirectory, pm2, a monorepo task runner, or `next dev <dir>` launched
 * from elsewhere all change it. When that happens uploads land outside
 * public/, every image 404s, and nothing errors: the upload returns 200 and
 * the file is simply written into the void.
 *
 * Set UPLOAD_DIR to an absolute path to pin it.
 */
function localUploadDir(): string {
  return (
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads")
  );
}

export const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

export interface StoredImage {
  key: string;
  bytes: number;
}

function newKey(ext: string): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${yyyymm}/${randomBytes(16).toString("hex")}.${ext}`;
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}

export async function storeImage(
  file: File,
): Promise<{ ok: true; image: StoredImage } | { ok: false; error: string }> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { ok: false, error: "That file type isn't supported." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Images must be under 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  /**
   * Content-Type on an upload is attacker-controlled. Check magic bytes so a
   * .php or .svg cannot arrive wearing an image/jpeg label — SVG in
   * particular carries script and would be stored XSS if ever served inline.
   */
  if (!looksLikeImage(buffer)) {
    return { ok: false, error: "That file isn't a valid image." };
  }

  const key = newKey(extensionFor(file.type));
  const provider = process.env.IMAGE_PROVIDER ?? "local";

  if (provider === "cloudflare") {
    return storeOnCloudflare(key, buffer, file.type);
  }

  const dest = path.join(localUploadDir(), key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);

  return { ok: true, image: { key, bytes: buffer.length } };
}

/** Magic-byte sniffing for the formats we accept. */
function looksLikeImage(b: Buffer): boolean {
  if (b.length < 12) return false;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return true;

  // RIFF....WEBP
  if (b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP") return true;

  // ISO-BMFF box types used by AVIF and HEIC
  if (b.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = b.subarray(8, 12).toString("ascii");
    if (["avif", "avis", "heic", "heix", "hevc", "mif1", "msf1"].includes(brand))
      return true;
  }

  return false;
}

async function storeOnCloudflare(
  key: string,
  buffer: Buffer,
  mime: string,
): Promise<{ ok: true; image: StoredImage } | { ok: false; error: string }> {
  const account = process.env.CF_IMAGES_ACCOUNT_ID;
  const token = process.env.CF_IMAGES_API_TOKEN;
  if (!account || !token) {
    return { ok: false, error: "Image storage is not configured." };
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), key);
  form.append("id", key);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/images/v1`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form },
  );

  if (!res.ok) {
    console.error(`Cloudflare Images upload failed: ${res.status}`);
    return { ok: false, error: "Upload failed. Try again." };
  }

  return { ok: true, image: { key, bytes: buffer.length } };
}
