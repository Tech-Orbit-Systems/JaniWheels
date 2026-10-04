import type { Sql, TransactionSql } from "postgres";

export const HOLD_RESOURCES = ["account", "listing", "report", "inspection", "assistance", "moderation"] as const;
export type HoldResource = typeof HOLD_RESOURCES[number];
type Tx = TransactionSql;
const LOCK = 19403721;

export class RetentionError extends Error {}

export async function earlyDeletion(sql: Sql, resource: "listing" | "inspection" | "assistance", id: number, operator: string, reason: string, apply: boolean) {
  if (!["listing", "inspection", "assistance"].includes(resource) || !Number.isSafeInteger(id) || id < 1 || !operator.trim() || reason.trim().length < 5 || reason.length > 1000) throw new RetentionError("Specify a valid record, operator and approved deletion reason.");
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const tables = { listing: "listings", inspection: "inspections", assistance: "sell_assistance_requests" };
    if (!(await tx`SELECT id FROM ${tx(tables[resource])} WHERE id=${id} FOR UPDATE`).length) throw new RetentionError("The selected record does not exist.");
    if (await held(tx, resource, id)) throw new RetentionError("Necessary complaint evidence is held; review the hold before deletion.");
    if (resource === "listing" && (await tx`SELECT r.id FROM listing_reports r JOIN retention_holds h ON h.resource='report' AND h.resource_id=r.id AND h.released_at IS NULL WHERE r.listing_id=${id}
      UNION ALL SELECT m.id FROM moderation_log m JOIN retention_holds h ON h.resource='moderation' AND h.resource_id=m.id AND h.released_at IS NULL WHERE m.listing_id=${id}`).length) throw new RetentionError("Necessary complaint evidence is held; review the hold before deletion.");
    if (apply) {
      if (resource === "listing") await redactListing(tx, id);
      else await redactService(tx, resource, id);
      await tx`INSERT INTO retention_runs(operator,mode,cutoff,summary) VALUES (${operator},'approved-early-deletion',NOW(),${tx.json({resource,id,reason})})`;
    }
    return { resource, id, eligible: true, applied: apply };
  });
}

async function receipt(tx: Tx, resource: string, resourceId: number, action: string) {
  await tx`INSERT INTO retention_receipts(resource,resource_id,action) VALUES (${resource},${resourceId},${action})`;
}

async function queueMedia(tx: Tx, keys: (string | null)[]) {
  for (const key of new Set(keys.filter((key): key is string => Boolean(key)))) {
    await tx`INSERT INTO retention_media_deletions(storage_key) VALUES (${key}) ON CONFLICT DO NOTHING`;
  }
}

async function held(tx: Tx, resource: HoldResource, id: number): Promise<boolean> {
  const [hold] = await tx`SELECT id FROM retention_holds WHERE resource=${resource} AND resource_id=${id} AND released_at IS NULL LIMIT 1`;
  if (hold) return true;
  if (resource === "listing") {
    const [report] = await tx`SELECT id FROM listing_reports WHERE listing_id=${id} AND status='open' LIMIT 1`;
    return Boolean(report);
  }
  if (resource === "account") {
    const [report] = await tx`SELECT r.id FROM listing_reports r JOIN listings l ON l.id=r.listing_id
      WHERE (r.status='open' OR EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='report' AND h.resource_id=r.id AND h.released_at IS NULL)) AND (l.seller_id=${id} OR r.reporter_user_id=${id}) LIMIT 1`;
    return Boolean(report);
  }
  return false;
}

export async function closeAccount(sql: Sql, userId: number) {
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const [user] = await tx`SELECT * FROM users WHERE id=${userId} FOR UPDATE`;
    if (!user || user.is_banned || user.anonymized_at) throw new RetentionError("This account is not available.");
    if (user.is_admin) throw new RetentionError("Administrator accounts require an access handover before closure. Contact support.");
    if (user.closed_at) return;
    const inventory = await tx`SELECT id,status,updated_at FROM listings WHERE seller_id=${userId} FOR UPDATE`;
    const searches = await tx`SELECT id,alert_frequency FROM saved_searches WHERE user_id=${userId} FOR UPDATE`;
    const snapshot = { listings: inventory.map(l => ({ id: l.id, status: l.status })), searches: searches.map(s => ({ id: s.id, frequency: s.alert_frequency })) };
    await tx`UPDATE users SET closed_at=NOW(),closure_state=${tx.json(snapshot)},updated_at=NOW() WHERE id=${userId}`;
    await tx`UPDATE listings SET status='removed',updated_at=NOW() WHERE seller_id=${userId}`;
    await tx`UPDATE saved_searches SET alert_frequency='off' WHERE user_id=${userId}`;
    await tx`UPDATE saved_search_notifications SET suppressed_at=NOW(),last_error='Account closed'
      WHERE saved_search_id IN (SELECT id FROM saved_searches WHERE user_id=${userId}) AND delivered=false AND suppressed_at IS NULL`;
    await tx`DELETE FROM sessions WHERE user_id=${userId}`;
    await tx`DELETE FROM email_verification_tokens WHERE user_id=${userId}`;
    await tx`DELETE FROM password_reset_tokens WHERE user_id=${userId}`;
    await receipt(tx, "account", userId, "close");
  });
}

async function restoreInTransaction(tx: Tx, userId: number, replay = false) {
  const [user] = await tx`SELECT *,closed_at::text AS closure_timestamp FROM users WHERE id=${userId} FOR UPDATE`;
  if (!user || user.is_banned || user.anonymized_at || !user.closed_at || (!replay && new Date(user.closed_at).getTime() + 30 * 86400_000 <= Date.now())) {
    throw new RetentionError("The account recovery period has ended or this account cannot be restored.");
  }
  const snapshot = user.closure_state as { listings?: { id: number; status: string }[]; searches?: { id: number; frequency: string }[] } | null;
  await tx`UPDATE users SET closed_at=NULL,closure_state=NULL,updated_at=NOW() WHERE id=${userId}`;
  for (const listing of snapshot?.listings ?? []) {
    // Moderator changes during closure must never be undone by restoration.
    await tx`UPDATE listings SET status=CASE WHEN ${listing.status}='active' AND expires_at<NOW() THEN 'expired'::listing_status ELSE ${listing.status}::listing_status END,updated_at=NOW()
      WHERE id=${listing.id} AND seller_id=${userId} AND status='removed' AND updated_at=${user.closure_timestamp}::text::timestamptz AND redacted_at IS NULL`;
  }
  for (const search of snapshot?.searches ?? []) await tx`UPDATE saved_searches SET alert_frequency=${search.frequency} WHERE id=${search.id} AND user_id=${userId}`;
  await tx`DELETE FROM sessions WHERE user_id=${userId}`;
}

export async function restoreAccount(sql: Sql, userId: number) {
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    await restoreInTransaction(tx, userId);
    await receipt(tx, "account", userId, "restore");
  });
}

export async function createHold(sql: Sql, resource: HoldResource, resourceId: number, reason: string, responsible: string, actorUserId: number) {
  if (!HOLD_RESOURCES.includes(resource) || !Number.isSafeInteger(resourceId) || resourceId < 1 || reason.trim().length < 5 || reason.length > 1000 || responsible.trim().length < 2 || responsible.length > 160) {
    throw new RetentionError("Choose a valid record and enter the hold reason and responsible person.");
  }
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const [admin] = await tx`SELECT id FROM users WHERE id=${actorUserId} AND is_admin=true AND is_banned=false AND closed_at IS NULL`;
    if (!admin) throw new RetentionError("Administrator access required.");
    const tables = { account: "users", listing: "listings", report: "listing_reports", inspection: "inspections", assistance: "sell_assistance_requests", moderation: "moderation_log" };
    const [record] = await tx`SELECT id FROM ${tx(tables[resource])} WHERE id=${resourceId}`;
    if (!record) throw new RetentionError("The selected record does not exist.");
    const [hold] = await tx`INSERT INTO retention_holds(resource,resource_id,reason,responsible,actor_user_id)
      VALUES (${resource},${resourceId},${reason.trim()},${responsible.trim()},${actorUserId}) RETURNING id`;
    await tx`INSERT INTO retention_runs(operator,mode,cutoff,summary) VALUES (${`admin:${actorUserId}`},'hold-create',NOW(),${tx.json({ holdId: hold.id, resource, resourceId })})`;
    return hold.id;
  });
}

export async function reviewHold(sql: Sql, holdId: number, actorUserId: number, release: boolean) {
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const [admin] = await tx`SELECT id FROM users WHERE id=${actorUserId} AND is_admin=true AND is_banned=false AND closed_at IS NULL`;
    if (!admin) throw new RetentionError("Administrator access required.");
    const [hold] = await tx`UPDATE retention_holds SET reviewed_at=NOW(),released_at=CASE WHEN ${release} THEN NOW() ELSE released_at END
      WHERE id=${holdId} AND released_at IS NULL RETURNING id`;
    if (!hold) throw new RetentionError("An active hold was not found.");
    await tx`INSERT INTO retention_runs(operator,mode,cutoff,summary) VALUES (${`admin:${actorUserId}`},${release ? "hold-release" : "hold-review"},NOW(),${tx.json({ holdId })})`;
  });
}

async function redactListing(tx: Tx, id: number, record = true) {
  const images = await tx`SELECT storage_key FROM listing_images WHERE listing_id=${id}`;
  await queueMedia(tx, images.map(i => i.storage_key));
  await tx`DELETE FROM listing_images WHERE listing_id=${id}`;
  // Curated facet IDs stay intact; seller-entered display fields are personal data.
  await tx`UPDATE listings SET title='Deleted listing',description=NULL,slug='deleted-'||id,status='removed',
    exact_latitude=NULL,exact_longitude=NULL,approximate_latitude=NULL,approximate_longitude=NULL,
    custom_city_name=NULL,custom_area_name=NULL,custom_make_name=NULL,custom_model_name=NULL,custom_variant_name=NULL,
    redacted_at=COALESCE(redacted_at,NOW()),photo_count=0,updated_at=NOW() WHERE id=${id}`;
  await tx`UPDATE part_details SET brand=NULL,part_number=NULL,oem_number=NULL,custom_category_name=NULL,
    custom_compatible_make_name=NULL,custom_compatible_model_name=NULL WHERE listing_id=${id}`;
  await tx`UPDATE car_details SET color=NULL,auction_grade=NULL WHERE listing_id=${id}`;
  await tx`UPDATE bike_details SET color=NULL WHERE listing_id=${id}`;
  await tx`DELETE FROM listing_custom_features WHERE listing_id=${id}`;
  if (record) await receipt(tx, "listing", id, "redact");
}

async function redactService(tx: Tx, resource: "inspection" | "assistance", id: number, record = true) {
  if (resource === "inspection") {
    await tx`UPDATE inspections SET address=NULL,contact_phone='',status=CASE WHEN status IN ('completed','cancelled') THEN status ELSE 'cancelled' END,
      redacted_at=COALESCE(redacted_at,NOW()) WHERE id=${id}`;
    await tx`UPDATE inspection_events SET internal_note=NULL,customer_message=NULL WHERE inspection_id=${id}`;
  } else {
    await tx`UPDATE sell_assistance_requests SET address='',contact_phone='',registration_city='',best_contact_time=NULL,seller_notes=NULL,
      status=CASE WHEN status IN ('sold','cancelled') THEN status ELSE 'cancelled' END,redacted_at=COALESCE(redacted_at,NOW()) WHERE id=${id}`;
    await tx`UPDATE sell_assistance_events SET internal_note=NULL,customer_message=NULL WHERE request_id=${id}`;
  }
  if (record) await receipt(tx, resource, id, "redact");
}

async function redactAccount(tx: Tx, id: number, record = true) {
  const [user] = await tx`SELECT avatar_url FROM users WHERE id=${id} FOR UPDATE`;
  const dealer = await tx`SELECT logo_url FROM dealers WHERE user_id=${id}`;
  await queueMedia(tx, [user?.avatar_url, ...dealer.map(d => d.logo_url)]);
  await tx`UPDATE users SET phone=NULL,password_hash=NULL,phone_verified_at=NULL,name=NULL,email=NULL,email_verified_at=NULL,avatar_url=NULL,
    is_banned=true,is_admin=false,anonymized_at=COALESCE(anonymized_at,NOW()),closure_state=NULL,last_seen_at=NULL,updated_at=NOW() WHERE id=${id}`;
  await tx`UPDATE dealers SET business_name='Closed dealer',slug='closed-dealer-'||id,address=NULL,about=NULL,landline=NULL,whatsapp=NULL,logo_url=NULL,verified_at=NULL WHERE user_id=${id}`;
  for (const table of ["sessions", "auth_accounts", "email_verification_tokens", "password_reset_tokens", "saved_searches", "saved_listings"]) await tx`DELETE FROM ${tx(table)} WHERE user_id=${id}`;
  await tx`UPDATE lead_events SET user_id=NULL,anon_id=NULL,referrer=NULL WHERE user_id=${id}`;
  const pending = await tx`DELETE FROM pending_uploads WHERE user_id=${id} RETURNING storage_key`;
  await queueMedia(tx,pending.map(p=>p.storage_key));
  if (record) await receipt(tx, "account", id, "redact");
}

export async function runRetention(sql: Sql, options: { apply: boolean; cutoff: Date; operator: string; limit?: number }) {
  if (!Number.isFinite(options.cutoff.getTime()) || options.cutoff.getTime() > Date.now() || !options.operator.trim()) throw new RetentionError("Use a valid cutoff at or before now and identify the operator.");
  const limit = Math.max(1, Math.min(100, options.limit ?? 25));
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const cutoff = options.cutoff;
    const candidates = {
      account: await tx`SELECT u.id FROM users u WHERE closed_at<=${cutoff}::timestamptz-INTERVAL '30 days' AND anonymized_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='account' AND h.resource_id=u.id AND h.released_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM listing_reports r JOIN listings l ON l.id=r.listing_id WHERE (r.status='open' OR EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='report' AND h.resource_id=r.id AND h.released_at IS NULL)) AND (l.seller_id=u.id OR r.reporter_user_id=u.id)) ORDER BY u.id LIMIT ${limit}`,
      listing: await tx`SELECT l.id FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.redacted_at IS NULL AND
        ((l.status IN ('sold','expired','removed') AND l.retention_inactive_at<=${cutoff}::timestamptz-INTERVAL '12 months') OR u.closed_at<=${cutoff}::timestamptz-INTERVAL '30 days')
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='listing' AND h.resource_id=l.id AND h.released_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM listing_reports r WHERE r.listing_id=l.id AND (r.status='open' OR EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='report' AND h.resource_id=r.id AND h.released_at IS NULL)))
        AND NOT EXISTS(SELECT 1 FROM moderation_log m JOIN retention_holds h ON h.resource='moderation' AND h.resource_id=m.id AND h.released_at IS NULL WHERE m.listing_id=l.id) ORDER BY l.id LIMIT ${limit}`,
      inspection: await tx`SELECT s.id FROM inspections s JOIN users u ON u.id=s.requested_by_user_id WHERE s.redacted_at IS NULL AND
        ((s.status IN ('completed','cancelled') AND s.closed_at<=${cutoff}::timestamptz-INTERVAL '12 months') OR u.closed_at<=${cutoff}::timestamptz-INTERVAL '30 days')
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='inspection' AND h.resource_id=s.id AND h.released_at IS NULL) ORDER BY s.id LIMIT ${limit}`,
      assistance: await tx`SELECT s.id FROM sell_assistance_requests s JOIN users u ON u.id=s.requested_by_user_id WHERE s.redacted_at IS NULL AND
        ((s.status IN ('sold','cancelled') AND s.closed_at<=${cutoff}::timestamptz-INTERVAL '12 months') OR u.closed_at<=${cutoff}::timestamptz-INTERVAL '30 days')
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='assistance' AND h.resource_id=s.id AND h.released_at IS NULL) ORDER BY s.id LIMIT ${limit}`,
      report: await tx`SELECT r.id FROM listing_reports r WHERE status<>'open' AND resolved_at<=${cutoff}::timestamptz-INTERVAL '24 months'
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.released_at IS NULL AND ((h.resource='report' AND h.resource_id=r.id) OR (h.resource='listing' AND h.resource_id=r.listing_id))) ORDER BY r.id LIMIT ${limit}`,
      moderation: await tx`SELECT m.id FROM moderation_log m WHERE m.created_at<=${cutoff}::timestamptz-INTERVAL '24 months' AND
        NOT EXISTS(SELECT 1 FROM listing_reports r WHERE r.listing_id=m.listing_id AND (r.status='open' OR r.resolved_at IS NULL OR r.resolved_at>${cutoff}::timestamptz-INTERVAL '24 months' OR EXISTS(SELECT 1 FROM retention_holds h WHERE h.resource='report' AND h.resource_id=r.id AND h.released_at IS NULL)))
        AND NOT EXISTS(SELECT 1 FROM retention_holds h WHERE h.released_at IS NULL AND ((h.resource='moderation' AND h.resource_id=m.id) OR (h.resource='listing' AND h.resource_id=m.listing_id) OR (h.resource='account' AND h.resource_id=m.user_id))) ORDER BY m.id LIMIT ${limit}`,
    };
    const summary: Record<string, number> = { holdsSkipped: 0, overdueHoldReviews: 0, alertsRedacted: 0, leadEventsAggregated: 0 };
    summary.overdueHoldReviews = Number((await tx`SELECT count(*) n FROM retention_holds WHERE released_at IS NULL AND reviewed_at<=${cutoff}::timestamptz-INTERVAL '90 days'`)[0].n);
    if (options.apply) {
      // Expired recovery credentials are unnecessary even when complaint identity is held.
      const credentials = await tx`SELECT id FROM users u WHERE closed_at<=${cutoff}::timestamptz-INTERVAL '30 days'
        AND (password_hash IS NOT NULL OR EXISTS(SELECT 1 FROM auth_accounts a WHERE a.user_id=u.id)) ORDER BY id LIMIT ${limit}`;
      for (const user of credentials) {
        await tx`UPDATE users SET password_hash=NULL WHERE id=${user.id}`;
        for (const table of ["sessions","auth_accounts","email_verification_tokens","password_reset_tokens"]) await tx`DELETE FROM ${tx(table)} WHERE user_id=${user.id}`;
      }
    }
    for (const [kind, rows] of Object.entries(candidates)) {
      const resource = kind as HoldResource;
      let count = 0;
      for (const row of rows) {
        if (await held(tx, resource, row.id)) { summary.holdsSkipped++; continue; }
        if (count >= limit) break;
        count++;
        if (!options.apply) continue;
        if (resource === "account") await redactAccount(tx, row.id);
        else if (resource === "listing") await redactListing(tx, row.id);
        else if (resource === "inspection" || resource === "assistance") await redactService(tx, resource, row.id);
        else {
          await tx`DELETE FROM ${tx(resource === "report" ? "listing_reports" : "moderation_log")} WHERE id=${row.id}`;
          await receipt(tx, resource, row.id, "delete");
        }
      }
      summary[resource] = count;
    }
    const alerts = await tx`SELECT id FROM saved_search_notifications WHERE (delivered_at<=${cutoff}::timestamptz-INTERVAL '90 days' OR suppressed_at<=${cutoff}::timestamptz-INTERVAL '90 days') AND (recipient_email<>'' OR payload IS NOT NULL OR last_error IS NOT NULL) ORDER BY id LIMIT ${limit}`;
    summary.alertsRedacted = alerts.length;
    if (options.apply) for (const alert of alerts) {
      await tx`UPDATE saved_search_notifications SET recipient_email='',payload=NULL,last_error=NULL WHERE id=${alert.id}`;
      await receipt(tx, "alert", Number(alert.id), "redact");
    }
    const leads = await tx`SELECT id,type,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM') AS bucket_month FROM lead_events WHERE created_at<=${cutoff}::timestamptz-INTERVAL '90 days' ORDER BY id LIMIT ${limit}`;
    summary.leadEventsAggregated = leads.length;
    if (options.apply) for (const lead of leads) {
      await tx`INSERT INTO retention_monthly_totals("month",type,events) VALUES (${lead.bucket_month},${lead.type},1)
        ON CONFLICT("month",type) DO UPDATE SET events=retention_monthly_totals.events+1`;
      await tx`DELETE FROM lead_events WHERE id=${lead.id}`;
      await receipt(tx, "lead", Number(lead.id), "delete");
    }
    if (options.apply) await tx`INSERT INTO retention_runs(operator,mode,cutoff,summary) VALUES (${options.operator},'apply',${cutoff},${tx.json(summary)})`;
    return { mode: options.apply ? "apply" : "preview", cutoff: cutoff.toISOString(), limitPerCategory: limit, overdueHoldReviews: summary.overdueHoldReviews, ...summary };
  });
}

export async function drainMediaDeletions(sql: Sql, remove: (key: string) => Promise<boolean>, limit = 25) {
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const rows = await tx`SELECT storage_key,attempts FROM retention_media_deletions WHERE next_attempt_at<=NOW() ORDER BY created_at LIMIT ${Math.min(100, Math.max(1, limit))} FOR UPDATE SKIP LOCKED`;
    let removed = 0;
    let failed = 0;
    for (const row of rows) {
      const [reference] = await tx`SELECT 1 FROM listing_images WHERE storage_key=${row.storage_key}
        UNION ALL SELECT 1 FROM users WHERE avatar_url=${row.storage_key}
        UNION ALL SELECT 1 FROM dealers WHERE logo_url=${row.storage_key}
        UNION ALL SELECT 1 FROM pending_uploads WHERE storage_key=${row.storage_key} AND claimed_at IS NULL LIMIT 1`;
      let ok = false;
      try { if (!reference) ok = await remove(row.storage_key); } catch { /* Retry without exposing provider details. */ }
      if (ok) { await tx`DELETE FROM retention_media_deletions WHERE storage_key=${row.storage_key}`; removed++; }
      else { await tx`UPDATE retention_media_deletions SET attempts=attempts+1,next_attempt_at=NOW()+INTERVAL '1 hour' WHERE storage_key=${row.storage_key}`; failed++; }
    }
    return { removed, failed };
  });
}

export interface RetentionLedger { version: 1; instanceId: string; generatedAt: string; receipts: { resource: string; resource_id: number; action: string; occurred_at: string }[] }

export async function exportLedger(sql: Sql): Promise<RetentionLedger> {
  return sql.begin(async tx => {
  await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
  const rows = await tx`SELECT resource,resource_id,action,occurred_at::text AS occurred_at FROM retention_receipts ORDER BY id`;
  const [identity] = await tx`SELECT instance_id FROM retention_identity WHERE id=1`;
  if (!identity) throw new RetentionError("Retention identity is missing; apply migrations.");
  return { version: 1, instanceId: identity.instance_id, generatedAt: new Date().toISOString(), receipts: rows.map(r => ({ resource: r.resource, resource_id: r.resource_id, action: r.action, occurred_at: r.occurred_at })) };
  });
}

export async function replayLedger(sql: Sql, ledger: RetentionLedger, operator: string) {
  if (ledger.version !== 1 || !Array.isArray(ledger.receipts) || !operator.trim() || !Number.isFinite(Date.parse(ledger.generatedAt)) || Date.parse(ledger.generatedAt)>Date.now()) throw new RetentionError("Invalid restore ledger.");
  for (const row of ledger.receipts) {
    const actions: Record<string,string[]> = {account:["close","restore","redact"],listing:["redact"],inspection:["redact"],assistance:["redact"],report:["delete"],moderation:["delete"],alert:["redact"],lead:["delete"]};
    if (!actions[row.resource]?.includes(row.action) || !Number.isSafeInteger(row.resource_id) || row.resource_id < 1 || !Number.isFinite(Date.parse(row.occurred_at)) || Date.parse(row.occurred_at)>Date.parse(ledger.generatedAt)) throw new RetentionError("Invalid restore ledger entry.");
  }
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK})`;
    const [identity] = await tx`SELECT instance_id FROM retention_identity WHERE id=1`;
    if (!identity || identity.instance_id!==ledger.instanceId) throw new RetentionError("Restore ledger belongs to a different database instance.");
    await tx`LOCK TABLE users,listings,inspections,sell_assistance_requests,listing_reports,moderation_log,saved_search_notifications,lead_events IN SHARE ROW EXCLUSIVE MODE`;
    for (const row of ledger.receipts) {
      const id = row.resource_id;
      if (row.resource === "account" && row.action === "close") {
        const [account] = await tx`SELECT closed_at,anonymized_at FROM users WHERE id=${id} FOR UPDATE`;
        if (account && !account.closed_at && !account.anonymized_at) {
          const listings = await tx`SELECT id,status FROM listings WHERE seller_id=${id}`;
          const searches = await tx`SELECT id,alert_frequency FROM saved_searches WHERE user_id=${id}`;
          await tx`UPDATE users SET closure_state=${tx.json({listings:listings.map(l=>({id:l.id,status:l.status})),searches:searches.map(s=>({id:s.id,frequency:s.alert_frequency}))})} WHERE id=${id}`;
        }
        await tx`UPDATE users SET closed_at=${row.occurred_at}::text::timestamptz WHERE id=${id}`;
        await tx`UPDATE listings SET status='removed',updated_at=${row.occurred_at}::text::timestamptz WHERE seller_id=${id} AND redacted_at IS NULL`;
        await tx`UPDATE saved_searches SET alert_frequency='off' WHERE user_id=${id}`;
        await tx`DELETE FROM sessions WHERE user_id=${id}`;
        await tx`DELETE FROM email_verification_tokens WHERE user_id=${id}`;
        await tx`DELETE FROM password_reset_tokens WHERE user_id=${id}`;
      } else if (row.resource === "account" && row.action === "restore") {
        const [user] = await tx`SELECT id FROM users WHERE id=${id} AND closed_at IS NOT NULL AND anonymized_at IS NULL AND is_banned=false`;
        if (user) await restoreInTransaction(tx, id, true);
      } else if (row.resource === "account" && row.action === "redact") await redactAccount(tx, id, false);
      else if (row.resource === "listing") await redactListing(tx, id, false);
      else if (row.resource === "inspection" || row.resource === "assistance") await redactService(tx, row.resource, id, false);
      else if (row.resource === "alert") await tx`UPDATE saved_search_notifications SET recipient_email='',payload=NULL,last_error=NULL WHERE id=${id}`;
      else if (row.resource === "lead") await tx`DELETE FROM lead_events WHERE id=${id}`;
      else await tx`DELETE FROM ${tx(row.resource === "report" ? "listing_reports" : "moderation_log")} WHERE id=${id}`;
      await tx`INSERT INTO retention_receipts(resource,resource_id,action,occurred_at) VALUES (${row.resource},${id},${row.action},${row.occurred_at}::text::timestamptz) ON CONFLICT DO NOTHING`;
    }
    // Backups may predate IDs in the ledger. Reusing those IDs would apply an
    // old deletion to a new person's record on the next restore.
    const tables = { account: "users", listing: "listings", inspection: "inspections", assistance: "sell_assistance_requests", report: "listing_reports", moderation: "moderation_log", alert: "saved_search_notifications", lead: "lead_events" };
    for (const [resource, table] of Object.entries(tables)) {
      const maximum = ledger.receipts.filter(r=>r.resource===resource).reduce((max,r)=>Math.max(max,r.resource_id),0);
      if (maximum) await tx`SELECT setval(pg_get_serial_sequence(${table},'id'),GREATEST(COALESCE(pg_sequence_last_value(pg_get_serial_sequence(${table},'id')::regclass),0),(SELECT COALESCE(MAX(id),0) FROM ${tx(table)}),${maximum}),true)`;
    }
    await tx`INSERT INTO retention_runs(operator,mode,cutoff,summary) VALUES (${operator},'restore-replay',NOW(),${tx.json({ entries: ledger.receipts.length })})`;
    return { replayed: ledger.receipts.length };
  });
}
