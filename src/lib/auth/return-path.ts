const LOCAL_ORIGIN = "https://janiwheels.invalid";

export function safeReturnPath(value: string | null | undefined): string {
  if (typeof value !== "string" || !value || value.length > 2048 || !value.startsWith("/")) return "/";
  let decoded = value;
  try {
    for (let i = 0; i < 3; i++) {
      if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/";
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/";
    const target = new URL(value, LOCAL_ORIGIN);
    if (target.origin !== LOCAL_ORIGIN || target.pathname.startsWith("//")) return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}
