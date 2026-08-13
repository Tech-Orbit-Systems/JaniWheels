import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storeImage } from "@/lib/images/storage";

export const runtime = "nodejs";

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

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files received." }, { status: 400 });
  }
  if (files.length > 30) {
    return NextResponse.json({ error: "Too many files." }, { status: 400 });
  }

  const stored: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await storeImage(file);
    if (result.ok) stored.push(result.image.key);
    else errors.push(`${file.name}: ${result.error}`);
  }

  return NextResponse.json({ keys: stored, errors });
}
