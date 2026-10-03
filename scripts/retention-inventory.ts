import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { max: 1 });
try {
  // Counts and dates only: this report must never export customer records.
  const rows = await sql.begin("read only", async tx => tx`
    SELECT 'accounts' category, count(*)::int records, min(created_at) oldest FROM users
    UNION ALL SELECT 'inactive listings',count(*)::int,min(created_at) FROM listings WHERE status <> 'active'
    UNION ALL SELECT 'resolved reports',count(*)::int,min(created_at) FROM listing_reports WHERE status <> 'open'
    UNION ALL SELECT 'closed inspections',count(*)::int,min(created_at) FROM inspections WHERE status IN ('completed','cancelled')
    UNION ALL SELECT 'closed assistance requests',count(*)::int,min(created_at) FROM sell_assistance_requests WHERE status IN ('sold','cancelled')
    UNION ALL SELECT 'moderation audit',count(*)::int,min(created_at) FROM moderation_log
    UNION ALL SELECT 'delivered alerts',count(*)::int,min(created_at) FROM saved_search_notifications WHERE delivered=true
    UNION ALL SELECT 'suppressed alerts',count(*)::int,min(created_at) FROM saved_search_notifications WHERE suppressed_at IS NOT NULL
  `);
  console.log(JSON.stringify({ mode: "read-only", generatedAt: new Date().toISOString(), categories: rows }, null, 2));
} catch {
  console.error("Retention inventory failed. Check database connectivity and migrations; no data was changed.");
  process.exitCode = 1;
} finally { await sql.end(); }
