# Local HTTP load smoke

Recorded 2026-10-13T02:50:41.027Z, production build on loopback with isolated
seeded PostgreSQL. 100 requests at concurrency 5, distributed over
home, cars, bikes, parts and dealers. Responses are fully read.

- Failed responses: 0
- p50: 250 ms
- p95: 585 ms
- Maximum: 811 ms

This bounded local smoke detects basic concurrent-read failures. It is not the
500-user ramp/soak, representative media/network test or production capacity
sign-off required before launch. Repeat those on the selected staging host.
