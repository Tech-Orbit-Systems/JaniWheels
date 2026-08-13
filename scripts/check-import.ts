/**
 * Bulk-import checks:  npm run check:import
 *
 * The CSV path is where dealer inventory enters the system, so its failure
 * modes are expensive: a mis-parsed row becomes a wrong price on a live
 * listing, and a wrongly-matched model poisons the facet graph and the price
 * data permanently.
 *
 * The parser assertions are pure. The row-validation ones hit the database
 * because resolving a model name is the whole point of that step.
 */

import "dotenv/config";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { users, dealers } from "../src/db/schema/users";
import { listings } from "../src/db/schema/listings";
import { parseCsv, mapHeaders, normalizeHeader } from "../src/lib/dealers/csv";
import { previewImport, commitImport } from "../src/lib/dealers/bulk-import";

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`${name}\n    expected: ${e}\n    actual:   ${a}`);
}

async function main() {
  console.log("Bulk import checks\n" + "=".repeat(40));

  // ---- CSV parsing -------------------------------------------------------
  check("simple rows", parseCsv("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);

  // Excel writes "Lahore, Punjab" as a quoted field. A split(",") mangles it.
  check(
    "quoted field containing a comma",
    parseCsv('make,city\nToyota,"Lahore, Punjab"'),
    [
      ["make", "city"],
      ["Toyota", "Lahore, Punjab"],
    ],
  );

  check(
    "escaped double quotes",
    parseCsv('a\n"He said ""hi"""'),
    [["a"], ['He said "hi"']],
  );

  // Description columns routinely contain newlines.
  check(
    "embedded newline inside a quoted field",
    parseCsv('a,b\n1,"line one\nline two"'),
    [
      ["a", "b"],
      ["1", "line one\nline two"],
    ],
  );

  check("CRLF line endings", parseCsv("a,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);

  check("trailing blank lines are dropped", parseCsv("a,b\n1,2\n\n\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);

  check("row without trailing newline", parseCsv("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);

  // "CSV UTF-8" export from Excel prepends a BOM, which silently turns the
  // first header into "﻿make" and breaks column matching.
  check(
    "UTF-8 BOM is stripped",
    parseCsv("﻿make,model\nToyota,Corolla")[0][0],
    "make",
  );

  // ---- header mapping ----------------------------------------------------
  check("header normalization", normalizeHeader("Model Year"), "modelyear");

  const cols = mapHeaders([
    "Brand",
    "Model",
    "Model Year",
    "Asking Price",
    "Location",
    "KMs",
  ]);
  check("alias: Brand -> make", cols.make, 0);
  check("alias: Location -> city", cols.city, 4);
  check("alias: KMs -> mileage", cols.mileage, 5);
  // "Model Year" must win the year slot without stealing the model slot.
  check("Model stays model", cols.model, 1);
  check("Model Year becomes year", cols.year, 2);

  // ---- row validation (database-backed) ----------------------------------
  const csv = [
    "make,model,variant,year,price,mileage,city",
    "Toyota,Corolla,Altis Automatic 1.6,2021,48.5 lacs,73000,Lahore",
    "Honda,Civic,,2020,6200000,45000,Karachi",
    "Toyota,Corrola,,2021,4800000,50000,Lahore", // misspelt model
    "Toyota,Corolla,,1890,4800000,50000,Lahore", // impossible year
    "Toyota,Corolla,,2021,50,50000,Lahore", // bare "50" => 50 lacs
    "Toyota,Corolla,,2021,4800000,50000,Atlantis", // unknown city
  ].join("\n");

  const preview = await previewImport(csv);

  check("valid rows are imported", preview.valid.length, 3);
  check("bad rows are reported", preview.errors.length, 3);

  const lacs = preview.valid.find((v) => v.row === 2);
  check('"48.5 lacs" parses to 4,850,000', lacs?.pricePkr, 4_850_000);

  const bare = preview.valid.find((v) => v.row === 6);
  check('bare "50" is read as 50 lacs, not 50 rupees', bare?.pricePkr, 5_000_000);

  const misspelt = preview.errors.find((e) => e.row === 4);
  check("misspelt model is rejected, never invented", misspelt?.field, "model");

  const badYear = preview.errors.find((e) => e.row === 5);
  check("impossible year is rejected", badYear?.field, "year");

  const badCity = preview.errors.find((e) => e.row === 7);
  check("unknown city is rejected", badCity?.field, "city");

  // A file missing a required column should fail fast with a useful message
  // rather than importing garbage.
  const noPrice = await previewImport("make,model,year,city\nToyota,Corolla,2021,Lahore");
  check("missing required column fails fast", noPrice.valid.length, 0);
  check(
    "missing column is named",
    noPrice.errors[0]?.field,
    "price",
  );

  // ---- commit path -------------------------------------------------------
  // Preview passing does not mean import works. Bulk-imported rows carry no
  // photos, and an unguarded `.values([])` on the images insert fails every
  // single row while the preview still reports them as valid.
  const okCsv = [
    "make,model,variant,year,price,mileage,city",
    "Toyota,Corolla,Altis Automatic 1.6,2021,48.5 lacs,73000,Lahore",
  ].join("\n");

  const okPreview = await previewImport(okCsv);
  check("commit fixture previews cleanly", okPreview.valid.length, 1);

  const [seller] = await db.select({ id: users.id }).from(users).limit(1);
  const [dealer] = await db.select({ id: dealers.id }).from(dealers).limit(1);

  if (seller && dealer) {
    const result = await commitImport(seller.id, dealer.id, okPreview.valid, 10);
    check("row imports without photos", result.imported, 1);
    check("no per-row failures", result.failed, []);

    // Clean up so re-running doesn't accumulate rows.
    if (result.imported > 0) {
      const created = await db
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.dealerId, dealer.id))
        .orderBy(desc(listings.id))
        .limit(result.imported);
      await db.delete(listings).where(
        inArray(listings.id, created.map((c) => c.id)),
      );
    }
  } else {
    failures.push("commit path skipped — no seller/dealer fixture in the database");
  }

  console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error(`  FAIL  ${f}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
