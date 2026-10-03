import { sql } from "drizzle-orm";
import { db } from "@/db";
import { readinessResponse } from "@/lib/operations/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return readinessResponse(() => db.execute(sql`SELECT 1`));
}
