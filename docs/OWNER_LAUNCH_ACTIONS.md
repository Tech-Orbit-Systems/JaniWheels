# JaniWheels: owner launch checklist

Updated: 8 October 2026. A retention policy and B1 badge decision are approved; no repeat approval is needed. Local development acceptance is distinct from production acceptance. PR #6 remains under review; a push does not merge it. The owner has assigned hosting and deployment to an external team. Give that team `DEPLOYMENT_HANDOFF.md` and the reviewed repository release; ask it to return the launch evidence listed there.

## 1. Hosting and database access

**Aap ka step:** External deployment team ko hosting, production PostgreSQL, active cPanel DNS aur budget ka access dein. Production URL aur named administrator account batayein. Current site sirf Coming Soon hai; old site/mailbox data migration ki zaroorat nahin, as confirmed 8 October 2026. Secrets ko secure environment settings mein rakhein; chat ya tracker mein paste na karein.

**Us ke baad external deployment team:** HTTPS, environment validation, migrations, verified administrator bootstrap, health/readiness, restore maintenance mode aur staging deployment configure aur verify kare. Development team code defects aur reported failures fix karegi. Production data par destructive commands preview aur approved policy ke baghair na chalayein.

## 2. Email and images providers

**Aap ka step:** Resend account mein owned sending domain verify karein, DNS records lagayein aur test mailbox dein. Cloudflare Images account mein required private delivery/variants aur signing credentials available karein. Existing image IDs/import source batayein agar production images pehle se hain.

**Us ke baad external deployment team:** Secure credentials configuration; public/private image lifecycle; saved-search scheduling, retries, opt-out aur real inbox acceptance. New site par existing image migration ki zaroorat nahin jab tak old objects identify na hon. Mock success ko live provider acceptance nahi kaha jayega.

Reference: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Cloudflare private images](https://developers.cloudflare.com/images/optimization/hosted-images/serve-private-images/).

## 3. Google configuration, if enabled for launch

**Aap ka step:** Production Google OAuth client/redirect domain access dein. Maps ke liye billing-enabled project aur domain/API restricted browser key configure karein.

**Us ke baad external deployment team:** Production sign-in redirect aur map loading/error fallback acceptance. Browser key ko unrestricted na rakhein. Development team reported code defects fix karegi.

Reference: [Google Maps key setup](https://developers.google.com/maps/documentation/javascript/get-api-key).

## 4. Backup, deletion ledger and monitoring

**Aap ka step:** Backup/storage account, independent deletion-ledger storage, monitoring account aur operational alert recipient specify karein. Rolling backup period approved 30 days hai.

**Us ke baad external deployment team:** Backup and restore rehearsal, ledger export/replay, retention and media worker scheduling, overdue hold reviews, email backlog and readiness/error alerts. Scheduler ko live configure karke logs/alerts verify karna baqi hai.

## 5. Independent PR review and protected main

**Aap ka step:** Repository administrator se required checks/protection configure karwayein aur PR #6 ka independent review arrange karein. Review ke baad main merge ko separate action samjhein.

**Us ke baad development:** Review fixes, latest head checks, approved merge and release verification. Current local evidence/tracker feature branch par maintained hai.

## 6. Actual device acceptance

**Aap ka step:** Staging HTTPS URL par Android Chrome aur iPhone Safari test karein: signup/login, car/bike/part ad, camera/gallery photo selection, keyboard, contact, dealer/services, account closure/recovery. Slow network, screen reader aur enlarged text bhi check karein. Issue ke saath device/browser, steps aur screenshot bhejein.

**Us ke baad development:** Reported code issues fix karke same flows recheck. External deployment team live environment defects resolve karegi. Desktop/mobile browser automation actual camera, touch, assistive technology aur device acceptance ka substitute nahi hai.

QA note: Full Linux CI run 49 mein WebKit navigation/upload pass hain. Windows par concurrent local suites ke dauran Auto Parts tab ki stability wait timeout hui; local WebKit upload pass hai. Actual iPhone par homepage navigation/search ko bhi acceptance mein include karein. Overlapping local run ko full local pass claim nahi kiya gaya.

## 7. Production-sized load and final launch

**Aap ka step:** Staging host and approved load-test window provide karein; production privacy/provider/legal copy review karein. Hosting capability aur data volume select hone ke baad load target agree karein.

**Us ke baad external deployment team:** Concurrent browsing/publishing and provider latency test, resource limits tune, launch checklist and rollback rehearsal. Development team code-related findings fix karegi. Local 20,000-ad query benchmark concurrent production users ka result nahi hai.

## Measurement recommendation

V1 mein existing raw page renders aur contact events ko clearly labelled aggregate reporting ke saath use karein. Yeh unique humans, completed sales ya inbox delivery ka proof nahi hain. Extra visitor identifiers/external analytics abhi introduce nahi kiye gaye. Agar unique-human measurement chahiye ho to privacy/consent aur methodology ka separate decision dein; baqi development is decision ke baghair proceed kar sakti hai.

## Operator reporting

`npm run ops:report -- --database EXACT_DATABASE_NAME` read-only aggregate JSON deta hai: inventory, contact totals, manual service status, email backlog, overdue holds aur media retries. Personal email, phone, listing text, complaint/hold reasons aur provider secrets is output mein nahi aate. Production monitoring integration aur recipients configuration baqi hai.
