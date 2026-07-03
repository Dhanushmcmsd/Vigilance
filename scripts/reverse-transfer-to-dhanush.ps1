#Requires -Version 5.1
<#
.SYNOPSIS
  Reverse transfer: vigilancecfcici account -> Dhanushmcmsd account.

.DESCRIPTION
  Use when the company account (vigilancecfcici) is disabled or unavailable.
  Copies latest code to Dhanush GitHub, migrates Supabase data/storage from
  company project (xgwjcknpkpzsbjvuninm) back to Dhanush project (itxfffjepcdfhuzsrnwf).

  Prerequisites (install once):
    - Git for Windows
    - Node.js 20+
    - Supabase CLI: npm install -g supabase
    - PostgreSQL client tools (pg_dump, psql) for database migration
    - Python 3 + pip install supabase

  Set secrets via environment variables (never commit these):
    $env:GITHUB_TOKEN = 'github_pat_...'          # Dhanush GitHub PAT with repo scope
    $env:OLD_SUPABASE_TOKEN = 'sbp_...'            # vigilancecfcici Supabase PAT (if still valid)
    $env:NEW_SUPABASE_TOKEN = 'sbp_...'           # Dhanush Supabase PAT
    $env:OLD_DB_PASSWORD = '...'                  # DB password for xgwjcknpkpzsbjvuninm
    $env:NEW_DB_PASSWORD = '...'                  # DB password for itxfffjepcdfhuzsrnwf
    $env:OLD_SUPABASE_SERVICE_ROLE_KEY = '...'     # company project service role
    $env:NEW_SUPABASE_SERVICE_ROLE_KEY = '...'    # Dhanush project service role

.PARAMETER Phase
  all | github | supabase-schema | supabase-data | storage | functions | verify

.EXAMPLE
  .\scripts\reverse-transfer-to-dhanush.ps1 -Phase github
#>
param(
    [ValidateSet('all', 'github', 'supabase-schema', 'supabase-data', 'storage', 'functions', 'verify')]
    [string]$Phase = 'all',

    [string]$DhanushRepoUrl = 'https://github.com/Dhanushmcmsd/Vigilance.git',
    [string]$OldProjectRef = 'xgwjcknpkpzsbjvuninm',
    [string]$NewProjectRef = 'itxfffjepcdfhuzsrnwf'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing command: $name"
    }
}

function Phase-GitHub {
    Write-Step 'Phase 1: Push local code to Dhanush GitHub'
    Require-Command git

    if (-not $env:GITHUB_TOKEN) {
        throw 'Set $env:GITHUB_TOKEN to your Dhanush GitHub PAT (repo scope).'
    }

    $remoteUrl = $DhanushRepoUrl -replace 'https://', "https://$($env:GITHUB_TOKEN)@"
    git remote remove dhanush 2>$null
    git remote add dhanush $remoteUrl

    Write-Host 'Pushing main branch to Dhanushmcmsd/Vigilance ...'
    git push dhanush main --force
    Write-Host 'Code pushed.' -ForegroundColor Green
}

function Phase-SupabaseSchema {
    Write-Step 'Phase 2: Apply migrations to Dhanush Supabase'
    Require-Command supabase

    if (-not $env:NEW_SUPABASE_TOKEN) {
        throw 'Set $env:NEW_SUPABASE_TOKEN to Dhanush Supabase access token.'
    }
    $env:SUPABASE_ACCESS_TOKEN = $env:NEW_SUPABASE_TOKEN

    supabase link --project-ref $NewProjectRef
    supabase db push
    Write-Host 'Schema migrations applied.' -ForegroundColor Green
}

function Phase-SupabaseData {
    Write-Step 'Phase 3: Copy database data (company -> Dhanush)'
    Require-Command pg_dump
    Require-Command psql

    if (-not $env:OLD_DB_PASSWORD -or -not $env:NEW_DB_PASSWORD) {
        throw 'Set $env:OLD_DB_PASSWORD and $env:NEW_DB_PASSWORD from Supabase Dashboard -> Settings -> Database.'
    }

    $oldHost = "db.$OldProjectRef.supabase.co"
    $newHost = "db.$NewProjectRef.supabase.co"
    $oldConn = "postgresql://postgres.$OldProjectRef`:$($env:OLD_DB_PASSWORD)@${oldHost}:5432/postgres"
    $newConn = "postgresql://postgres.$NewProjectRef`:$($env:NEW_DB_PASSWORD)@${newHost}:5432/postgres"

    $publicDump = Join-Path $Root "scripts\.transfer-public-data.sql"
    $authDump = Join-Path $Root "scripts\.transfer-auth-data.sql"

    Write-Host 'Exporting public schema data from company project...'
    pg_dump $oldConn --schema=public --data-only --no-owner --disable-triggers -f $publicDump

    Write-Host 'Exporting auth users from company project...'
    pg_dump $oldConn --schema=auth --data-only --no-owner -f $authDump

    Write-Host 'Importing public data into Dhanush project...'
    psql $newConn -f $publicDump

    Write-Host 'Importing auth users into Dhanush project...'
    psql $newConn -f $authDump

    Write-Host 'Database data migrated.' -ForegroundColor Green
    Write-Host "Dump files kept at: $publicDump and $authDump" -ForegroundColor Yellow
}

function Phase-Storage {
    Write-Step 'Phase 4: Migrate storage bucket (inspection-files)'
    Require-Command python

    if (-not $env:OLD_SUPABASE_SERVICE_ROLE_KEY -or -not $env:NEW_SUPABASE_SERVICE_ROLE_KEY) {
        throw 'Set OLD/NEW Supabase service role keys.'
    }

    $env:OLD_SUPABASE_URL = "https://$OldProjectRef.supabase.co"
    $env:NEW_SUPABASE_URL = "https://$NewProjectRef.supabase.co"

    python (Join-Path $Root 'scripts\migrate-storage.py')
    Write-Host 'Storage migration complete.' -ForegroundColor Green
}

function Phase-Functions {
    Write-Step 'Phase 5: Deploy edge functions to Dhanush Supabase'
    Require-Command node

    if (-not $env:NEW_SUPABASE_TOKEN) {
        throw 'Set $env:NEW_SUPABASE_TOKEN'
    }

    $env:SUPABASE_ACCESS_TOKEN = $env:NEW_SUPABASE_TOKEN
    $env:SUPABASE_PROJECT_REF = $NewProjectRef

    npm run functions:deploy:all
    Write-Host @'

Set edge secrets in Supabase Dashboard -> Edge Functions -> Secrets:
  SUPABASE_URL=https://itxfffjepcdfhuzsrnwf.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=(Dhanush service role key)
  RESEND_API_KEY=(if used)
  DASHBOARD_URL=(your Vercel URL)
  CRON_SECRET, WEBHOOK_SECRET (generate new random values)
'@ -ForegroundColor Yellow
}

function Phase-Verify {
    Write-Step 'Phase 6: Verification checklist'
    @(
        "[ ] https://github.com/Dhanushmcmsd/Vigilance has latest main (commit: fix web map/districts)",
        "[ ] Supabase itxfffjepcdfhuzsrnwf: tables populated in Table Editor",
        "[ ] Supabase: edge functions deployed",
        "[ ] Storage bucket inspection-files has files",
        "[ ] Web .env / Vercel: VITE_SUPABASE_URL=https://itxfffjepcdfhuzsrnwf.supabase.co",
        "[ ] Mobile .env: EXPO_PUBLIC_* point to Dhanush Supabase",
        "[ ] Expo owner: dhanushraghav (not vigilancecfcici)",
        "[ ] Admin login works on web + mobile"
    ) | ForEach-Object { Write-Host $_ }
}

switch ($Phase) {
    'github'            { Phase-GitHub }
    'supabase-schema'   { Phase-SupabaseSchema }
    'supabase-data'     { Phase-SupabaseData }
    'storage'           { Phase-Storage }
    'functions'         { Phase-Functions }
    'verify'            { Phase-Verify }
    'all'               {
        Phase-GitHub
        Phase-SupabaseSchema
        Phase-SupabaseData
        Phase-Storage
        Phase-Functions
        Phase-Verify
    }
}
