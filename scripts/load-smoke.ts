import { writeFile } from "node:fs/promises";

const base = process.env.ACCEPTANCE_BASE_URL ?? "http://127.0.0.1:3101";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Local load smoke requires a loopback server");
const paths = ["/", "/used-cars", "/used-bikes", "/auto-parts", "/dealers"];
const times: number[] = [];
let next = 0;
let failures = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (next < 100) {
    const index = next++;
    const start = performance.now();
    try {
      const response = await fetch(new URL(paths[index % paths.length], base), { signal: AbortSignal.timeout(30_000) });
      const body = await response.text();
      if (response.status !== 200 || body.includes("listings are temporarily unavailable")) failures++;
    } catch { failures++; }
    times.push(performance.now() - start);
  }
}));
times.sort((a, b) => a - b);
const result = { requests: times.length, concurrency: 5, failures, p50Ms: Math.round(times[49]), p95Ms: Math.round(times[94]), maxMs: Math.round(times[99]) };
await writeFile("docs/LOCAL_LOAD_SMOKE.md", `# Local HTTP load smoke\n\nRecorded ${new Date().toISOString()}, production build on loopback with isolated\nseeded PostgreSQL. ${result.requests} requests at concurrency ${result.concurrency}, distributed over\nhome, cars, bikes, parts and dealers. Responses are fully read.\n\n- Failed responses: ${failures}\n- p50: ${result.p50Ms} ms\n- p95: ${result.p95Ms} ms\n- Maximum: ${result.maxMs} ms\n\nThis bounded local smoke detects basic concurrent-read failures. It is not the\n500-user ramp/soak, representative media/network test or production capacity\nsign-off required before launch. Repeat those on the selected staging host.\n`);
console.log(result);
if (failures) process.exitCode = 1;
