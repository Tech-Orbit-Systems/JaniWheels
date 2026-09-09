import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const layout = await read("src/app/layout.tsx");
assert.ok(layout.includes('href="#main-content"'), "The shared layout must expose a keyboard skip link");
assert.ok(layout.includes('id="main-content"'), "The shared layout must expose the skip-link target");

const styles = await read("src/app/globals.css");
assert.match(styles, /overflow-x:\s*clip/, "The shared layout must protect narrow screens from horizontal overflow");
assert.match(styles, /:focus-visible/, "Interactive controls must retain a visible keyboard focus treatment");

const header = await read("src/components/SiteHeader.tsx");
assert.ok(header.includes("calc(100vw-2rem)"), "The mobile navigation must fit inside narrow viewports");
assert.ok(header.includes('aria-label="Mobile navigation"'), "The mobile navigation must have an accessible name");

const footer = await read("src/components/SiteFooter.tsx");
assert.ok(footer.includes("mailto:info@janiwheels.com"), "The footer must expose the official email address");
assert.ok(footer.includes("tel:+923333294075"), "The footer must expose the official call number");
assert.ok(footer.includes("https://wa.me/923333294075"), "The footer must expose the official WhatsApp number");

console.log("Branding and responsive-shell checks passed.");
