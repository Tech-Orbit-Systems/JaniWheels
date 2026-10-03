import { isAbsolute, relative, resolve, sep } from "node:path";

export function environmentIssues(env: Record<string, string | undefined>, launch = false): string[] {
  const issues: string[] = [];
  const required = (key: string) => { if (!env[key]?.trim()) issues.push(`${key} is required`); };
  required("DATABASE_URL");
  try { if (!["postgres:", "postgresql:"].includes(new URL(env.DATABASE_URL ?? "").protocol)) issues.push("DATABASE_URL must use PostgreSQL"); }
  catch { if (env.DATABASE_URL) issues.push("DATABASE_URL must be a valid URL"); }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.startsWith("change-me")) issues.push("SESSION_SECRET must be a non-placeholder secret of at least 32 characters");
  required("NEXT_PUBLIC_SITE_URL");
  try {
    const origin = new URL(env.NEXT_PUBLIC_SITE_URL ?? "");
    if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") issues.push("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without credentials, path, query or fragment");
    if (launch && (origin.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))) issues.push("Launch requires a public HTTPS NEXT_PUBLIC_SITE_URL");
  } catch { if (env.NEXT_PUBLIC_SITE_URL) issues.push("NEXT_PUBLIC_SITE_URL must be a valid origin"); }
  const provider = env.IMAGE_PROVIDER ?? "local";
  if (!["local", "cloudflare"].includes(provider)) issues.push("IMAGE_PROVIDER must be local or cloudflare");
  if ((env.NEXT_PUBLIC_IMAGE_PROVIDER ?? "local") !== provider) issues.push("Image provider settings must match");
  if (provider === "cloudflare") for (const key of ["CF_IMAGES_ACCOUNT_ID", "CF_IMAGES_API_TOKEN", "NEXT_PUBLIC_CF_IMAGES_HASH", "CF_IMAGES_SIGNING_KEY", "CF_IMAGES_PRIVATE_VARIANT"]) required(key);
  if (env.UPLOAD_DIR) {
    const inside = relative(resolve("public"), resolve(env.UPLOAD_DIR));
    if (!isAbsolute(env.UPLOAD_DIR) || !inside || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside))) issues.push("UPLOAD_DIR must be absolute and outside public/");
  }
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) issues.push("Google OAuth requires both client ID and secret");
  if (launch) {
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET"]) required(key);
    if ((env.CRON_SECRET?.length ?? 0) < 32) issues.push("Launch CRON_SECRET must contain at least 32 characters");
    if (provider !== "cloudflare") issues.push("Launch requires durable Cloudflare image storage");
    if (env.ACCEPTANCE_EMAIL_DIR) issues.push("Acceptance email capture must be disabled for launch");
  }
  return issues;
}

export function assertRuntimeEnvironment() {
  const issues = environmentIssues(process.env);
  if (issues.length) throw new Error(`Environment configuration is invalid:\n${issues.join("\n")}`);
}
