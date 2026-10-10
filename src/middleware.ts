import { NextResponse } from "next/server";
export function middleware() {
  // A restored backup stays offline until deletion replay has completed.
  if (process.env.RESTORE_REPLAY_REQUIRED === "true") return new NextResponse("Restore maintenance in progress", { status: 503, headers: { "Cache-Control":"no-store", "Retry-After":"300", "X-Robots-Tag":"noindex" } });
  return NextResponse.next();
}
