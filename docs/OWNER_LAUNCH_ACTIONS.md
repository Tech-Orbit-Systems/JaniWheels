# JaniWheels: owner launch checklist

Updated: 5 October 2026. A retention policy and B1 badge decision are approved; no repeat approval is needed. Local development acceptance is distinct from production acceptance. PR #6 remains under review; a push does not merge it.

## 1. Hosting and database access

**Aap ka step:** Hosting account/project, production PostgreSQL, domain DNS access aur budget arrange karein. Production URL aur named administrator account batayein. Secrets ko secure environment settings mein rakhein; chat ya tracker mein paste na karein.

**Us ke baad development:** HTTPS, environment validation, migrations, verified administrator bootstrap, health/readiness, restore maintenance mode aur staging deployment configure aur verify karna. Production data par destructive commands preview aur approved policy ke baghair na chalayein.

## 2. Email and images providers

**Aap ka step:** Resend account mein owned sending domain verify karein, DNS records lagayein aur test mailbox dein. Cloudflare Images account mein required private delivery/variants aur signing credentials available karein. Existing image IDs/import source batayein agar production images pehle se hain.

**Us ke baad development:** Secure credentials configuration; public/private image lifecycle and migration rehearsal; saved-search scheduling, retries, opt-out and real inbox acceptance. Mock success ko live provider acceptance nahi kaha jayega.

Reference: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Cloudflare private images](https://developers.cloudflare.com/images/optimization/hosted-images/serve-private-images/).

## 3. Google configuration, if enabled for launch

**Aap ka step:** Production Google OAuth client/redirect domain access dein. Maps ke liye billing-enabled project aur domain/API restricted browser key configure karein.

**Us ke baad development:** Production sign-in redirect aur map loading/error fallback acceptance. Browser key ko unrestricted na rakhein.

Reference: [Google Maps key setup](https://developers.google.com/maps/documentation/javascript/get-api-key).

## 4. Backup, deletion ledger and monitoring

**Aap ka step:** Backup/storage account, independent deletion-ledger storage, monitoring account aur operational alert recipient specify karein. Rolling backup period approved 30 days hai.

**Us ke baad development:** Backup and restore rehearsal, ledger export/replay, retention and media worker scheduling, overdue hold reviews, email backlog and readiness/error alerts. Scheduler ko live configure karke logs/alerts verify karna baqi hai.

## 5. Independent PR review and protected main

**Aap ka step:** Repository administrator se required checks/protection configure karwayein aur PR #6 ka independent review arrange karein. Review ke baad main merge ko separate action samjhein.

**Us ke baad development:** Review fixes, latest head checks, approved merge and release verification. Current local evidence/tracker feature branch par maintained hai.

## 6. Actual device acceptance

**Aap ka step:** Staging HTTPS URL par Android Chrome aur iPhone Safari test karein: signup/login, car/bike/part ad, camera/gallery photo selection, keyboard, contact, dealer/services, account closure/recovery. Slow network, screen reader aur enlarged text bhi check karein. Issue ke saath device/browser, steps aur screenshot bhejein.

**Us ke baad development:** Reported issues fix karke same flows recheck. Desktop/mobile browser automation actual camera, touch, assistive technology aur device acceptance ka substitute nahi hai.

## 7. Production-sized load and final launch

**Aap ka step:** Staging host and approved load-test window provide karein; production privacy/provider/legal copy review karein. Hosting capability aur data volume select hone ke baad load target agree karein.

**Us ke baad development:** Concurrent browsing/publishing and provider latency test, resource limits tune, launch checklist and rollback rehearsal. Local 20,000-ad query benchmark concurrent production users ka result nahi hai.

## Measurement recommendation

V1 mein existing raw page renders aur contact events ko clearly labelled aggregate reporting ke saath use karein. Yeh unique humans, completed sales ya inbox delivery ka proof nahi hain. Extra visitor identifiers/external analytics abhi introduce nahi kiye gaye. Agar unique-human measurement chahiye ho to privacy/consent aur methodology ka separate decision dein; baqi development is decision ke baghair proceed kar sakti hai.

## Operator reporting

`npm run ops:report -- --database EXACT_DATABASE_NAME` read-only aggregate JSON deta hai: inventory, contact totals, manual service status, email backlog, overdue holds aur media retries. Personal email, phone, listing text, complaint/hold reasons aur provider secrets is output mein nahi aate. Production monitoring integration aur recipients configuration baqi hai.
