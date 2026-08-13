# Going Live — Deployment and Cost

Everything needed to put JaniWheels into production, and what it costs at
three realistic stages of growth.

Costs are given in **USD and PKR at ~PKR 280 / USD**. Rates move; treat the
PKR figures as indicative and the USD ones as the anchor. All third-party
pricing is as published at time of writing and should be re-checked before
committing.

---

## 1. Pre-launch checklist

Ordered by what blocks launch, not by effort.

### Blocking

| # | Item | Notes |
|---|---|---|
| 1 | **Complete a real payment transaction in sandbox** | The gateway logic is fully unit-tested but no live transaction has ever completed. Field names and hash ordering differ per merchant account and must be verified against your own JazzCash/Easypaisa documentation. |
| 2 | **PTA-registered SMS sender ID** | Start early — approval is not fast. Until then OTPs send from a shortcode with lower deliverability. |
| 3 | **Replace all development secrets** | `SESSION_SECRET`, `CRON_SECRET` must be regenerated. Never reuse the values in `.env`. |
| 4 | **Move images off local disk** | Set `IMAGE_PROVIDER=cloudflare` (or S3/R2). Local disk does not survive a redeploy and has no CDN. |
| 5 | **Seed real inventory** | An empty marketplace converts nobody. See §6. |
| 6 | **Managed Postgres with automated backups** | Not the app server's disk. |
| 7 | **Privacy policy and terms** | Required by both payment gateways before merchant approval. |

### Strongly recommended

- Error monitoring (Sentry) — you cannot debug production from user reports.
- Uptime monitoring with SMS alerts.
- Google Search Console + Analytics, sitemap submitted.
- A staging environment. `robots.ts` already serves `Disallow: /` off-production.
- Rate limiting at the edge (Cloudflare) on `/api/*`.

---

## 2. Architecture in production

```
        Cloudflare (DNS, CDN, WAF, rate limiting)
                      │
        ┌─────────────┴─────────────┐
        │      App servers          │   Next.js on Node, 2+ instances
        │      behind a load        │   behind nginx or a managed LB
        │      balancer             │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────┐
   PostgreSQL      R2 / CF        Scheduler      SMS gateway
   (managed,       Images         (cron →        (local
    + replica)     (media)        /api/cron)     aggregator)
```

### Region

Latency to Pakistan matters more than list price:

| Region | Approx. RTT from Karachi/Lahore |
|---|---|
| **Mumbai (ap-south-1)** | 30–50 ms — closest |
| **UAE (me-central-1)** | 40–70 ms |
| **Singapore** | 80–120 ms |
| **Europe (Hetzner)** | 120–180 ms — cheapest, noticeably slower |

Cloudflare in front absorbs most of the static penalty, but server-rendered
HTML still pays the round trip. **Mumbai or UAE is the right default.** Hetzner
in Germany is defensible at year-1 budgets if you accept the latency.

---

## 3. Cost by stage

### Stage 1 — Launch (0–50k visits/month, <5,000 listings)

| Item | Provider | USD/mo | PKR/mo |
|---|---|---:|---:|
| App server (4 GB, 2 vCPU) | DigitalOcean / Hetzner | 24 | 6,700 |
| PostgreSQL (managed, small) | Neon Launch / DO | 19 | 5,300 |
| Object storage + CDN | Cloudflare R2 | 5 | 1,400 |
| DNS / CDN / WAF | Cloudflare Free | 0 | 0 |
| SMS (~10k OTP) | Local aggregator @ ~PKR 1 | — | 10,000 |
| Transactional email | Resend | 0–20 | 0–5,600 |
| Error monitoring | Sentry Free | 0 | 0 |
| **Total** | | **~68–88** | **~23,000–29,000** |

Domain: `.com` ~$12/yr, `.pk` ~PKR 3,500/yr (PKNIC).

### Stage 2 — Traction (500k visits/month, ~50,000 listings)

| Item | USD/mo | PKR/mo |
|---|---:|---:|
| App servers (2 × 8 GB) + load balancer | 110 | 31,000 |
| PostgreSQL (managed, 4 GB, backups) | 90 | 25,000 |
| Object storage + image delivery (~500k images) | 55 | 15,000 |
| Cloudflare Pro | 20 | 5,600 |
| SMS (~60k OTP + alerts) | — | 60,000 |
| Email, monitoring, uptime | 60 | 17,000 |
| **Total** | **~335** | **~154,000** |

### Stage 3 — Scale (5M visits/month, ~300,000 listings)

| Item | USD/mo | PKR/mo |
|---|---:|---:|
| App tier (4–6 instances, autoscaling) | 600 | 168,000 |
| PostgreSQL (primary + read replica, 16 GB) | 450 | 126,000 |
| Object storage + image delivery (3–5M images) | 250 | 70,000 |
| Search cluster (Typesense) | 120 | 34,000 |
| Cloudflare Business | 200 | 56,000 |
| SMS (~300k) | — | 300,000 |
| Monitoring, logging, email, backups | 180 | 50,000 |
| **Total** | **~1,800** | **~804,000** |

### The number people get wrong

**SMS is the cost that scales fastest, and Twilio will bankrupt you here.**

| Provider | Per SMS | 60,000 OTP/month |
|---|---:|---:|
| Local PK aggregator | ~PKR 1.00 | **PKR 60,000** |
| Twilio international A2P | ~PKR 14 | **PKR 840,000** |

A 14× difference. Use a local aggregator (Jazz, Telenor, Branded SMS
Pakistan). The code already abstracts the provider — only `sms.ts` changes.

### Payment gateway

- Merchant discount rate: **~2.5–3.5%** per transaction.
- One-time integration/onboarding: **PKR 25,000–50,000** typical.
- Settlement is usually T+2 to T+7. Plan working capital accordingly.

---

## 4. The cost that dominates everything

Infrastructure is not the expense. **People are**, by an order of magnitude.

Indicative Pakistan monthly salaries:

| Role | PKR/month | Needed from |
|---|---:|---|
| Senior full-stack developer | 300,000–500,000 | Day 1 |
| Mid developer | 150,000–250,000 | Month 6 |
| Content / taxonomy maintainer | 60,000–100,000 | Day 1 (part-time) |
| Moderator | 50,000–80,000 | At ~5k listings |
| Dealer sales rep | 60,000 + commission | Day 1 |
| Vehicle inspector (per city) | 60,000–90,000 + travel | When inspection launches |
| Marketing / performance | 100,000–200,000 | Month 3 |

A credible year-2 team of six is **PKR 800,000–1,200,000/month**. Against
that, a PKR 154,000 infrastructure bill is a rounding error.

**Five-year realistic burn: PKR 200–400 million (roughly USD 700k–1.4M)**,
dominated by salaries and customer acquisition.

---

## 5. Deployment steps

### 5.1 Provision

```bash
# Example: Ubuntu 22.04, Mumbai region
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```

### 5.2 Configure

Copy `.env.example` to `.env` and fill every value. Generate secrets properly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Set `UPLOAD_DIR` to an absolute path if using the local image provider — the
default is relative to the process working directory, which differs under
systemd and pm2.

### 5.3 Build and migrate

```bash
npm ci && npm run build
```

```bash
npm run db:migrate && npm run db:seed
```

`db:seed` loads geography and the vehicle catalogue. It is idempotent. Do
**not** run `src/db/seed/demo.ts` in production — it generates fake listings.

### 5.4 Run

```bash
pm2 start npm --name janiwheels -- start && pm2 save && pm2 startup
```

Put nginx in front, terminate TLS with certbot, proxy to `localhost:3000`.

### 5.5 Schedule the jobs

```bash
0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/price-snapshots
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/expire-listings
30 4 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/purge-expired
```

### 5.6 Verify

```bash
npm run check && npm run sweep
```

Point `SWEEP_BASE` at the production URL to crawl the live site.

Then confirm manually: `robots.txt` allows crawling, `sitemap.xml` returns
listings, a test OTP arrives, and one real payment completes end to end.

---

## 6. Solving the cold start

The hardest launch problem, and no amount of engineering solves it.

An empty marketplace converts nobody: no listings → no buyers → no listings.
The only known solutions are manual.

1. **Recruit 30–50 dealers in one city.** Free forever. Bulk-import their
   inventory yourself using the CSV tool. This is a sales activity, not a
   product one.
2. **Do not launch nationally.** Own Lahore or Karachi completely before
   opening a second city. Thin national coverage looks abandoned everywhere.
3. **Lead with the price calculator.** "What is my car worth" has enormous
   search volume and converts a curious owner into a seller. It works with
   zero listings on day one and is the cheapest acquisition channel available.
4. **Buy nothing until organic works.** Paid traffic to an empty marketplace
   burns money and teaches you nothing.

---

## 7. Backups and recovery

- Automated daily Postgres backups with **7–30 day retention**, held off the
  database host.
- **Test a restore before launch.** An untested backup is not a backup.
- Object storage: enable versioning; user photos are irreplaceable.
- Document a recovery runbook. Target RTO < 4 hours, RPO < 24 hours.

---

## 8. Legal and compliance (Pakistan)

- Company registration (SECP) — required for a merchant account.
- NTN and sales tax registration.
- PTA sender-ID approval for branded SMS.
- Privacy policy and terms covering personal data, required by the gateways.
- Consumer-protection considerations if you ever hold funds in escrow — this
  build deliberately does not.
