export function permitsMutationOrigin(request: Request, configuredOrigin?: string): boolean {
  if (request.headers.get("sec-fetch-site")==="cross-site") return false;
  const origin = request.headers.get("origin");
  // Cookie SameSite and Fetch Metadata protect clients without Origin; an
  // explicit Origin must match the configured site, including scheme/port.
  if (!origin) return true;
  try {
    const supplied = new URL(origin);
    return !supplied.username && !supplied.password && supplied.origin===new URL(configuredOrigin ?? request.url).origin && origin===supplied.origin;
  } catch { return false; }
}
