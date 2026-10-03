# Local HTTP load smoke

Recorded 2026-10-03T03:01:19.223Z, production build on loopback with isolated
seeded PostgreSQL. 100 requests at concurrency 5, distributed over
home, cars, bikes, parts and dealers. Responses are fully read.

- Failed responses: 0
- p50: 253 ms
- p95: 517 ms
- Maximum: 839 ms

This bounded local smoke detects basic concurrent-read failures. It is not the
500-user ramp/soak, representative media/network test or production capacity
sign-off required before launch. Repeat those on the selected staging host.
