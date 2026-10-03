import "server-only";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

/** Capture real action-generated links only inside an isolated acceptance database. */
export async function captureAcceptanceEmailLink(
  kind: "verification" | "reset",
  email: string,
  url: string,
): Promise<boolean> {
  const directory = process.env.ACCEPTANCE_EMAIL_DIR;
  if (!directory) return false;

  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : "";
  if (!/(?:_test|_acceptance)$/.test(databaseName) || !isAbsolute(directory)) {
    throw new Error("Acceptance email capture requires an isolated test database and absolute directory.");
  }

  const key = createHash("sha256").update(`${kind}:${email.toLowerCase()}`).digest("hex");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${kind}-${key}.url`), url, { encoding: "utf8", mode: 0o600 });
  return true;
}
