import "dotenv/config";
import postgres from "postgres";
import {operationsReport} from "../src/lib/operations/report";
let sql: ReturnType<typeof postgres> | undefined;
try {
  const url=process.env.DATABASE_URL;
  if (!url || process.argv.length!==4 || process.argv[2]!=="--database" || decodeURIComponent(new URL(url).pathname.slice(1))!==process.argv[3]) throw new Error("Use --database with the exact database name.");
  sql=postgres(url,{max:1});
  console.log(JSON.stringify(await operationsReport(sql),null,2));
} catch {
  console.error("Operations report unavailable. Confirm --database, connectivity and migrations; no data was changed.");
  process.exitCode=1;
} finally {await sql?.end();}
