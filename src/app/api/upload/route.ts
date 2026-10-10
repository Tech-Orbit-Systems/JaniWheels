import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storeImage } from "@/lib/images/storage";
import { removeStoredImage, MAX_UPLOAD_BYTES } from "@/lib/images/storage";
import { db } from "@/db";
import { pendingUploads } from "@/db/schema/listings";
import { and, eq, gt, sql } from "drizzle-orm";
import { allowPublicAction } from "@/lib/security/rate-limit";
import { permitsMutationOrigin } from "@/lib/security/origin";
import { logSafeError } from "@/lib/operations/safe-error";

export const runtime = "nodejs";

const MAX_UPLOADS_PER_HOUR = 60;
const MAX_BYTES_PER_HOUR = 300 * 1024 * 1024;
const MAX_REQUEST_BYTES = 30 * MAX_UPLOAD_BYTES + 2 * 1024 * 1024;

/**
 * Image upload endpoint for the listing wizard.
 *
 * Authenticated only — an open upload endpoint becomes free file hosting for
 * strangers within days of being discovered.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!permitsMutationOrigin(request,process.env.NEXT_PUBLIC_SITE_URL)) {
    return NextResponse.json({ error: "Cross-site uploads are not allowed." }, { status: 403 });
  }
  if (!await allowPublicAction(
    "image-upload", `user:${user.id}`, request.headers,
    { max: 30, sourceMax: 300, windowMs: 60 * 60_000 },
  )) {
    return NextResponse.json({ error: "Hourly upload request limit reached. Please try again later." }, { status: 429 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Upload request is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }
  if (files.length > 30) {
    return NextResponse.json({ error: "Too many files." }, { status: 400 });
  }
  const requestBytes = files.reduce((total, file) => total + file.size, 0);
  if (files.some((file) => file.size === 0 || file.size > MAX_UPLOAD_BYTES)) {
    return NextResponse.json({ error: "Each image must be between 1 byte and 10 MB." }, { status: 400 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count, bytes }] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      bytes: sql<number>`COALESCE(SUM(${pendingUploads.bytes}), 0)::int`,
    })
    .from(pendingUploads)
    .where(and(eq(pendingUploads.userId, user.id), gt(pendingUploads.createdAt, oneHourAgo)));
  if (count + files.length > MAX_UPLOADS_PER_HOUR || bytes + requestBytes > MAX_BYTES_PER_HOUR) {
    return NextResponse.json({ error: "Hourly upload limit reached. Please try again later." }, { status: 429 });
  }

  const stored: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await storeImage(file);
    if (!result.ok) {
      errors.push(`${file.name}: ${result.error}`);
      continue;
    }
    try {
      await db.insert(pendingUploads).values({
        storageKey: result.image.key,
        userId: user.id,
        bytes: result.image.bytes,
      });
      stored.push(result.image.key);
    } catch (error) {
      await removeStoredImage(result.image.key);
      logSafeError("upload.ownership_registration_failed", error);
      errors.push(`${file.name}: Upload failed. Try again.`);
    }
  }

  return NextResponse.json({ keys: stored, errors });
}
