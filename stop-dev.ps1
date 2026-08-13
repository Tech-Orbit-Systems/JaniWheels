# ---------------------------------------------------------------------------
# Stop AutoBazaar locally: the dev server and PostgreSQL.
#
#   .\stop-dev.ps1
#
# You normally don't need this — Ctrl+C stops the site, and leaving
# PostgreSQL running costs almost nothing. Use it to free the ports or
# before shutting the machine down cleanly.
# ---------------------------------------------------------------------------

$PgBin  = 'C:\Users\shahe\pg17\pgsql\bin'
$PgData = 'C:\Users\shahe\pg17\data'

Write-Host ''

$devConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($devConn) {
    Stop-Process -Id $devConn[0].OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host '  Dev server   stopped' -ForegroundColor Green
} else {
    Write-Host '  Dev server   was not running' -ForegroundColor DarkGray
}

if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) {
    # -m fast: disconnect clients and shut down cleanly without waiting for
    # them to finish on their own.
    & "$PgBin\pg_ctl.exe" -D $PgData -m fast stop | Out-Null
    Write-Host '  PostgreSQL   stopped' -ForegroundColor Green
} else {
    Write-Host '  PostgreSQL   was not running' -ForegroundColor DarkGray
}

Write-Host ''
