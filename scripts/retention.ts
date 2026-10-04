import "dotenv/config";
import postgres from "postgres";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { earlyDeletion, drainMediaDeletions, exportLedger, replayLedger, RetentionError, runRetention, type RetentionLedger } from "../src/lib/retention/core";
import { removeStoredImage } from "../src/lib/images/storage";

const args = process.argv.slice(2);
const command = args.shift() ?? "preview";
let sql: ReturnType<typeof postgres> | undefined;
try {
  const options = new Map<string,string>();
  for (let i=0;i<args.length;i+=2) {
    if (!["--database","--operator","--cutoff","--limit","--file","--resource","--id","--reason"].includes(args[i]) || options.has(args[i]) || !args[i+1] || args[i+1].startsWith("--")) throw new RetentionError("Invalid retention arguments.");
    options.set(args[i],args[i+1]);
  }
  if (!["preview","apply","media","export-ledger","replay","early-preview","early-apply"].includes(command)) throw new RetentionError("Unknown retention command.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new RetentionError("DATABASE_URL is required.");
  if (decodeURIComponent(new URL(url).pathname.slice(1))!==options.get("--database")) throw new RetentionError("--database must exactly match the target database name.");
  const operator = options.get("--operator") ?? "";
  if (!operator.trim() || operator.length>160) throw new RetentionError("--operator is required and must be at most 160 characters.");
  const limit = Number(options.get("--limit") ?? 25);
  if (!Number.isSafeInteger(limit) || limit<1 || limit>100) throw new RetentionError("--limit must be a whole number between 1 and 100.");
  sql = postgres(url,{max:1});
  if (command==="preview" || command==="apply") {
    console.log(JSON.stringify(await runRetention(sql,{apply:command==="apply",cutoff:new Date(options.get("--cutoff") ?? Date.now()),operator,limit})));
  } else if (command==="early-preview" || command==="early-apply") {
    console.log(JSON.stringify(await earlyDeletion(sql,options.get("--resource") as "listing" | "inspection" | "assistance",Number(options.get("--id")),operator,options.get("--reason") ?? "",command==="early-apply")));
  } else if (command==="media") console.log(JSON.stringify(await drainMediaDeletions(sql,removeStoredImage,limit)));
  else {
    const file = options.get("--file") ?? "";
    const inside = relative(resolve("public"),resolve(file));
    if (!isAbsolute(file) || !inside || (!inside.startsWith(`..${sep}`) && inside!==".." && !isAbsolute(inside))) throw new RetentionError("--file must be absolute and outside public/. Store the ledger securely outside the database backup.");
    if (command==="export-ledger") {
      await writeFile(file,JSON.stringify(await exportLedger(sql)),{encoding:"utf8",mode:0o600,flag:"wx"});
      console.log("Restore ledger exported. Store it in restricted durable storage independent of the database backup.");
    } else console.log(JSON.stringify(await replayLedger(sql,JSON.parse(await readFile(file,"utf8")) as RetentionLedger,operator)));
  }
} catch (error) {
  console.error(error instanceof RetentionError ? error.message : "Retention operation failed. No provider or database details are displayed. Check restricted operator logs.");
  process.exitCode=1;
} finally { await sql?.end(); }
