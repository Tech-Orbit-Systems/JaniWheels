import type { Sql } from "postgres";

export async function operationsReport(sql: Sql) {
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [accounts] = await tx`SELECT count(*)::int total,
      count(*) FILTER (WHERE email_verified_at IS NOT NULL AND closed_at IS NULL AND NOT is_banned)::int email_verified_open,
      count(*) FILTER (WHERE closed_at IS NOT NULL)::int closed FROM users`;
    const inventory = await tx`SELECT vertical,status,count(*)::int listings FROM listings GROUP BY vertical,status ORDER BY vertical,status`;
    const [activity] = await tx`SELECT COALESCE(sum(view_count),0)::bigint raw_listing_renders,COALESCE(sum(lead_count),0)::bigint lifetime_contact_events FROM listings`;
    const contacts = await tx`SELECT type,count(*)::int events FROM lead_events GROUP BY type ORDER BY type`;
    const anonymousMonthlyContacts = await tx`SELECT month,type,events FROM retention_monthly_totals ORDER BY month DESC,type LIMIT 120`;
    const [reports] = await tx`SELECT count(*) FILTER (WHERE status='open')::int open FROM listing_reports`;
    const inspections = await tx`SELECT status,count(*)::int requests FROM inspections GROUP BY status ORDER BY status`;
    const assistance = await tx`SELECT status,count(*)::int requests FROM sell_assistance_requests GROUP BY status ORDER BY status`;
    const [alerts] = await tx`SELECT count(*) FILTER (WHERE delivered)::int provider_accepted,
      count(*) FILTER (WHERE suppressed_at IS NOT NULL)::int suppressed,
      count(*) FILTER (WHERE NOT delivered AND suppressed_at IS NULL)::int pending,
      count(*) FILTER (WHERE NOT delivered AND suppressed_at IS NULL AND next_attempt_at<=NOW())::int due,
      min(created_at) FILTER (WHERE NOT delivered AND suppressed_at IS NULL) oldest_pending FROM saved_search_notifications`;
    const [retention] = await tx`SELECT
      (SELECT count(*)::int FROM retention_holds WHERE released_at IS NULL) active_holds,
      (SELECT count(*)::int FROM retention_holds WHERE released_at IS NULL AND reviewed_at<=NOW()-INTERVAL '90 days') overdue_hold_reviews,
      (SELECT count(*)::int FROM retention_media_deletions) queued_media,
      (SELECT count(*)::int FROM retention_media_deletions WHERE attempts>0) media_retries,
      (SELECT max(created_at) FROM retention_runs WHERE mode='apply') last_cleanup`;
    return {mode:"read-only",generatedAt:new Date().toISOString(),accounts,inventory,activity,
      contactEventsWithinRetention:contacts,anonymousMonthlyContacts,reports,inspections,assistance,alerts,retention,
      definitions:{views:"Raw listing renders, including repeats/crawlers; not unique human visitors.",contacts:"Contact button events, not completed sales.",email:"Provider acceptance, not mailbox delivery.",identity:"Email verification does not verify seller identity."}};
  });
}
