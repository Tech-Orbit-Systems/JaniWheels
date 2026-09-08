# ---------------------------------------------------------------------------
# Start JaniWheels locally.
#
#   Right-click this file -> "Run with PowerShell"
#   or from a terminal:  .\start-dev.ps1
#
# Starts PostgreSQL (if it isn't already) and then the Next.js dev server.
# Both are safe to run when already running — it checks first.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$ProjectDir = $PSScriptRoot
$NodeDir    = 'C:\Program Files\nodejs'
$PgBin      = 'C:\Users\shahe\pg17\pgsql\bin'
$PgData     = 'C:\Users\shahe\pg17\data'
$PgLog      = 'C:\Users\shahe\pg17\pg.log'
$env:Path   = "$NodeDir;$env:Path"

function Test-Port($Port) {
    $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

Write-Host ''
Write-Host '  JaniWheels - starting local environment' -ForegroundColor Cyan
Write-Host '  --------------------------------------'

# --- 1. PostgreSQL ---------------------------------------------------------
if (Test-Port 5432) {
    Write-Host '  [1/3] PostgreSQL   already running' -ForegroundColor DarkGray
} else {
    Write-Host '  [1/3] PostgreSQL   starting...' -NoNewline
    # Note: no -w flag. `pg_ctl -w start` holds the console open on Windows
    # and never returns, which makes this script look like it hung.
    & "$PgBin\pg_ctl.exe" -D $PgData -l $PgLog -o "-p 5432 -h 127.0.0.1" start | Out-Null

    $ready = $false
    foreach ($i in 1..20) {
        Start-Sleep -Milliseconds 500
        if (Test-Port 5432) { $ready = $true; break }
    }

    if ($ready) {
        Write-Host "`r  [1/3] PostgreSQL   started            " -ForegroundColor Green
    } else {
        Write-Host "`r  [1/3] PostgreSQL   FAILED             " -ForegroundColor Red
        Write-Host "        Check the log: $PgLog" -ForegroundColor Yellow
        exit 1
    }
}

# --- 2. Local schema guard --------------------------------------------------
Set-Location $ProjectDir
Write-Host '  [2/3] Database     checking local auth schema...' -ForegroundColor DarkGray
& npm.cmd run db:repair:google-auth
if ($LASTEXITCODE -ne 0) {
    Write-Host '  [DB] Local schema repair failed. Dev server not started.' -ForegroundColor Red
    exit $LASTEXITCODE
}
& npm.cmd run db:repair:map-location
if ($LASTEXITCODE -ne 0) {
    Write-Host '  [DB] Map-location schema repair failed. Dev server not started.' -ForegroundColor Red
    exit $LASTEXITCODE
}

# --- 3. Next.js dev server -------------------------------------------------
if (Test-Port 3000) {
    Write-Host '  [3/3] Dev server   already running on port 3000' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  Open  http://localhost:3000' -ForegroundColor Cyan
    Write-Host ''
    exit 0
}

Write-Host '  [3/3] Dev server   starting...'
Write-Host ''
Write-Host '  Open  http://localhost:3000   (first page takes ~10s to compile)' -ForegroundColor Cyan
Write-Host '  Press Ctrl+C to stop the site. PostgreSQL keeps running.'
Write-Host ''

Set-Location $ProjectDir
& npm.cmd run dev
