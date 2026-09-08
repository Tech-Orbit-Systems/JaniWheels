import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["about", "contact", "terms", "privacy", "safety", "report-concern"] as const;
for (const page of pages) {
  const source = await readFile(new URL(`../src/app/${page}/page.tsx`, import.meta.url), "utf8");
  assert.match(source, /export const metadata: Metadata/);
  assert.ok(source.includes(`abs("/${page}")`), `${page} must declare its canonical URL`);
  assert.match(source, /<ContentPage/);
}

const footer = await readFile(new URL("../src/components/SiteFooter.tsx", import.meta.url), "utf8");
for (const page of pages) assert.ok(footer.includes(`"/${page}"`), `Footer must link to /${page}`);
assert.match(await readFile(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8"), /not a party/i);
assert.match(await readFile(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8"), /Google credentials and passwords are not stored/i);
assert.match(await readFile(new URL("../src/app/safety/page.tsx", import.meta.url), "utf8"), /does not collect transaction payments/i);
const contact = await readFile(new URL("../src/app/contact/page.tsx", import.meta.url), "utf8");
assert.ok(contact.includes("mailto:info@janiwheels.com"), "Contact page must expose the official email link");
assert.ok(contact.includes("tel:+923333294075"), "Contact page must expose the official call link");
assert.ok(contact.includes("https://wa.me/923333294075"), "Contact page must expose the official WhatsApp link");

console.log(`Legal/content checks passed (${pages.length} pages).`);
