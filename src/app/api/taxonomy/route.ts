import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { models, variants } from "@/db/schema/taxonomy";
import { areas } from "@/db/schema/geo";

/**
 * Cascading dropdown data for the listing wizard: make -> model -> variant,
 * and city -> area.
 *
 * Public and cacheable — this is reference data, identical for everyone, and
 * it changes when someone edits the seed. An hour of CDN caching removes it
 * from the request path entirely.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const makeId = Number(searchParams.get("makeId"));
  const modelId = Number(searchParams.get("modelId"));
  const cityId = Number(searchParams.get("cityId"));

  const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

  if (Number.isSafeInteger(makeId) && makeId > 0) {
    const rows = await db
      .select({ id: models.id, name: models.name })
      .from(models)
      .where(and(eq(models.makeId, makeId), eq(models.isActive, true)))
      .orderBy(desc(models.popularity), asc(models.name));
    return NextResponse.json({ models: rows }, { headers });
  }

  if (Number.isSafeInteger(modelId) && modelId > 0) {
    const rows = await db
      .select({
        id: variants.id,
        name: variants.name,
        engineCc: variants.engineCc,
      })
      .from(variants)
      .where(and(eq(variants.modelId, modelId), eq(variants.isActive, true)))
      .orderBy(asc(variants.name));
    return NextResponse.json({ variants: rows }, { headers });
  }

  if (Number.isSafeInteger(cityId) && cityId > 0) {
    const rows = await db
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(eq(areas.cityId, cityId))
      .orderBy(asc(areas.name));
    return NextResponse.json({ areas: rows }, { headers });
  }

  return NextResponse.json({ error: "Nothing requested" }, { status: 400 });
}
