export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRuntimeEnvironment } = await import("./lib/env");
    assertRuntimeEnvironment();
  }
}
import type { Instrumentation } from "next";


export const onRequestError: Instrumentation.onRequestError = (_error, request, context) => {
  void _error;
  // Route templates let operators group failures without collecting request
  // bodies, query strings, cookies, credentials or customer identifiers.
  console.error(JSON.stringify({ event: "request.failed", at: new Date().toISOString(),
    method: request.method, route: context.routePath, kind: context.routeType }));
};
