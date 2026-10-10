export function logSafeError(event: string, error: unknown): void {
  const code = error && typeof error === "object" && "code" in error
    ? error.code : undefined;
  console.error(JSON.stringify({
    event,
    code: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : "unknown",
  }));
}
