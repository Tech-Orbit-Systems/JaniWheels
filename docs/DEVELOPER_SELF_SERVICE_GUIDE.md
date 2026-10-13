# JaniWheels: developer ki self-service guide

Ye guide Windows PowerShell par repo ko bina kisi assistant ke chalane, samajhne,
badalne aur GitHub par bhejne ke liye hai. Commands `D:\JaniWheels.com` se chalaen.
Production server par local/test commands chalane se pehle neeche wali warning zaroor parhen.

## 1. Project aik nazar mein

- Stack: Node.js (kam az kam 20.11), Next.js 15 App Router, React 19,
  TypeScript, Tailwind CSS 4, PostgreSQL aur Drizzle ORM.
- `src/app/`: pages, layouts aur API routes. `src/components/`: reusable UI.
  `src/lib/`: business rules, auth, listings, SEO, images aur security.
  `src/db/schema/`: database tables. `drizzle/`: versioned SQL migrations.
  `src/db/seed/`: curated reference data. `tests/`: database aur browser tests.
- `docs/PROJECT.md` product ki boundary aur architecture batata hai.
  `AGENTS.md` mein coding rules hain. Kisi feature ko badalne se pehle dono parhen.
- V1 classified marketplace hai: buyer seller se direct contact karta hai.
  Payments, shipping, subscriptions aur SMS OTP signed V1 scope mein nahin hain.

## 2. Pehli dafa local setup

1. Node.js aur PostgreSQL install karen. PowerShell mein versions check karen:

   ```powershell
   node --version
   npm --version
   psql --version
   ```

   `psql` na mile lekin PostgreSQL installed ho to uske `bin` folder ko PATH mein
   add karen, ya SQL Shell (psql) use karen. PostgreSQL service ka naam aur status:

   ```powershell
   Get-Service -Name 'postgresql*'
   Get-Service -Name 'postgresql*' | Where-Object Status -eq 'Stopped' | Start-Service
   ```

2. Local database aik dafa banaen. Password installation ke waqt jo set kiya tha
   woh use karen; command password prompt karegi:

   ```powershell
   psql -h localhost -U postgres -d postgres -c 'CREATE DATABASE janiwheels;'
   ```

   Agar `already exists` aaye to database pehle se bana hua hai; dobara banana zaroori nahin.

3. Repo mein dependencies aur local settings tayyar karen:

   ```powershell
   Set-Location D:\JaniWheels.com
   npm ci
   Copy-Item .env.example .env
   ```

   `.env` ko editor mein kholen aur kam az kam ye values set karen:

   ```text
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/janiwheels
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   SESSION_SECRET=YOUR_UNIQUE_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
   IMAGE_PROVIDER=local
   NEXT_PUBLIC_IMAGE_PROVIDER=local
   ```

   Naya secret banane ke liye `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   chala kar output `.env` mein paste karen. Password mein `@`, `#`, `/` ya space ho
   to URL-encode karen; warna database URL parse nahin hoga. `.env` kabhi commit,
   screenshot ya public chat mein share na karen. Local Google/Resend keys blank
   reh sakti hain; local verification/reset links server terminal mein aate hain.

4. Schema aur reference data load karen, phir app start karen:

   ```powershell
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

   Browser mein `http://localhost:3000` kholen. `Ctrl+C` se app band hogi;
   PostgreSQL service chalti rahegi. Baad mein sirf DB service aur `npm run dev`
   chahiye. Repo ka `.\start-dev.ps1` local PostgreSQL start karne aur known local
   auth/map schema repairs check karne ka shortcut bhi hai.

   Sample ads chahiye hon to **sirf local disposable DB** par
   `npx tsx src/db/seed/demo.ts` chalaen. `db:seed` sirf curated taxonomy,
   locations aur categories deta hai; demo users/ads nahin banata.

## 3. Roz ka development workflow

1. `git status --short --branch` se branch aur pending files dekhen.
   Naye kaam ke liye reviewed `main` se branch banaen:

   ```powershell
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c feature/short-description
   ```

   Agar `main` par pehle se uncommitted changes hon to pehle unhen samjhen;
   blindly switch, reset ya overwrite na karen.

2. Code editor mein `D:\JaniWheels.com` folder kholen. Feature ka route
   `src/app/` mein, uske rules `src/lib/` mein aur table `src/db/schema/` mein
   dhoonden. Search ke liye editor ka global search ya `rg 'term' src` use karen.
   Chhota change karen, dev server par browser se flow khud try karen aur terminal
   errors parhen. Client code mein secrets na rakhen; `NEXT_PUBLIC_` values browser
   ko dikh sakti hain.

3. Agar table/schema badla ho to migration generate aur inspect karen:

   ```powershell
   npm run db:generate
   git diff -- drizzle
   npm run db:migrate
   ```

   Migration ko pehle local DB par try karen. Production DB ka backup liye baghair
   migration na chalaen. `db:push` aur `db:reset` sirf disposable local DB ke liye
   hain; production par kabhi nahin.

4. Change verify karen:

   ```powershell
   npm run check
   npm run lint
   npm run build:safe
   ```

   Route ya interactive behavior badle to seeded DB aur running app ke saath
   `npm run sweep` bhi chalaen. End-to-end acceptance ke liye `npm run test:acceptance`
   chala sakte hain. Ye apni **`janiwheels_acceptance_test` DB ko drop/recreate**
   karta hai; `.env` ka `DATABASE_URL` local development DB ka hona chahiye,
   production ka nahin. Is command ko production credentials ke saath na chalaen.
   Local DB user ko test DB create/drop karne ki permission bhi chahiye.
   Pehli browser run se pehle zaroorat par `npx playwright install chromium webkit`.
   `npm run build:safe` verification ke liye `.next-build` banata hai; actual
   production-style local run ke liye `npm run build` phir `npm run start` hai.

5. Sirf intended files commit aur push karen:

   ```powershell
   git diff --check
   git status --short
   git diff
   git add path/to/changed-file
   git diff --cached
   git commit -m "Describe the change"
   git push -u origin feature/short-description
   ```

   `git add .` se pehle extra files dekhen; `.env`, uploads, logs, test artifacts
   aur customer data commit na karen. GitHub par branch se `main` ke liye PR kholen,
   CI result aur independent review dekhen, phir alag merge decision len.
   Push karna merge nahin hai. Tracker mein feature/test status aur remaining gaps
   sachay result ke mutabiq update karen.

## 4. Aam maslay aur pehla hal

| Masla | Kya check karen |
| --- | --- |
| `node`/`npm`/`psql` not recognized | Tool installed hai? Naya terminal kholen; Node/PostgreSQL `bin` PATH mein hai? |
| Port 5432 refused | `Get-Service -Name 'postgresql*'`; service start karen. `DATABASE_URL` ka host/port check karen. |
| `password authentication failed` | `.env` ka DB user/password aur PostgreSQL ka actual password milayen. Special characters URL-encode karen. |
| `database does not exist` | `psql ... -c 'CREATE DATABASE janiwheels;'` chalaen; URL mein DB naam check karen. |
| Missing table/relation | `npm run db:migrate`, phir `npm run db:seed`. Purane local auth/map schema issue par `.\start-dev.ps1` ya `npm run db:repair:google-auth` aur `npm run db:repair:map-location`. |
| Port 3000 in use | Dusra dev server band karen; `Get-NetTCPConnection -LocalPort 3000` se owner process dekhen. Port badalne par `.env` ka site URL bhi milayen. |
| Page khulti hai, data nahin | DB connection, migrations, seed aur dev terminal error check karen. `http://localhost:3000/api/health` sirf app+DB readiness batata hai. |
| Login/email link nahin milta | Local dev mein verification/reset URL server terminal mein dekhen. Google login ko alag OAuth credentials chahiye. |
| Image upload fail | `IMAGE_PROVIDER` aur `NEXT_PUBLIC_IMAGE_PROVIDER` dono `local` hon. Agar repo folder se bahar app start ki ho to `UPLOAD_DIR` absolute path rakhen. |
| `build:safe` fail | Pehla actionable error parhen; DB reachable aur migrated ho. `npm run check` aur `npm run lint` alag chala kar cause pakren. |
| Acceptance DB create/drop denied | `.env` local DB ko point kare aur local DB user ko `CREATEDB` permission ho. Production credentials use na karen. |
| Git push rejected | `git fetch origin`, branch/status check, remote changes samajh kar rebase/merge karen. `git push --force` se shared branch overwrite na karen. |

## 5. Zaroori safety aur launch notes

- Seller ke text se make/model/generation/variant rows na banaen; ye curated data hai.
  SEO index/canonical policy `src/lib/seo/indexation.ts` mein hai; SEO change ke
  baad `npm run check:seo` chalaen. Listing search facets sirf publishing code likhe.
- Prices integer PKR, phone E.164 format; forms ki validation errors user ko samajh
  aani chahiye. Default server components rakhen aur First Load JS 150 KB se kam.
- Production ko Node server, PostgreSQL, HTTPS, durable Cloudflare Images, email,
  OAuth, scheduled jobs, backups aur monitoring chahiye. Static/PHP-only hosting
  is app ko nahin chala sakti. `npm run check:deployment` config ka shape check
  karta hai, live services prove nahin karta.
- Production par `db:push`, `db:reset`, demo/acceptance seeds ya acceptance runner
  na chalaen. Pehle reviewed commit, staging test, DB backup, migration aur
  rollback plan tayyar karen. Production proxy app ka direct port block kare
  aur configured IP header khud overwrite kare.
- Launch ki actual checklist `docs/DEPLOYMENT_HANDOFF.md`,
  `docs/REGRESSION_CHECKLIST.md` aur `docs/PREHOSTING_ACCEPTANCE.md` mein hai.
  Private media: `docs/PRIVATE_MEDIA.md`; retention/restore:
  `docs/RETENTION_DECISIONS.md`; admin: `docs/ADMIN_BOOTSTRAP.md`.

## Agar phans jaen to yeh 6 cheezen note karen

Command, exact error ke **secret-free** relevant lines, `git status --short --branch`,
`node --version`, kaunsa DB environment hai (local/staging/production; password
nahin), aur issue dobara lane ke steps. In se developer bina andaza lagaye masla
reproduce kar sakta hai. `.env`, DB dump, session cookie aur API token kabhi
issue/PR mein paste na karen.
