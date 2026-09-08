import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`alter table "listings" add column if not exists "exact_latitude" double precision`;
    await tx`alter table "listings" add column if not exists "exact_longitude" double precision`;
    await tx`alter table "listings" add column if not exists "approximate_latitude" double precision`;
    await tx`alter table "listings" add column if not exists "approximate_longitude" double precision`;
  });
  const [state] = await sql<{ count: number }[]>`select count(*)::int as count from information_schema.columns where table_schema='public' and table_name='listings' and column_name in ('exact_latitude','exact_longitude','approximate_latitude','approximate_longitude')`;
  if (state?.count !== 4) throw new Error("Map-location schema repair did not complete.");
  console.log("  [DB] Map-location schema present");
} finally { await sql.end(); }
