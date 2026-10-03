export async function readinessResponse(check: () => Promise<unknown>): Promise<Response> {
  let ready = false;
  try { await check(); ready = true; } catch { /* Never expose database/provider errors publicly. */ }
  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
