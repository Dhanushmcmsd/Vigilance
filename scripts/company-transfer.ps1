#Requires -Version 5.1
<#
.SYNOPSIS
  Vigilance VMS — Company account transfer script (run AFTER logging into company accounts).

.DESCRIPTION
  Run each phase separately. All CLIs must be logged into the COMPANY account, not personal.

  Before running:
    1. Change the password for vigilancecfcici@gmail.com (never share passwords in chat).
    2. supabase login          → company Supabase account
    3. vercel login            → company Vercel team
    4. eas login               → company Expo account
    5. git remote set-url      → company GitHub repo URL
    6. Set $env:COMPANY_* variables below (or pass as parameters)

.PARAMETER Phase
  all | github | supabase | vercel | expo | verify

.EXAMPLE
  .\scripts\company-transfer.ps1 -Phase github -GitHubRepoUrl "https://github.com/VigilanceCFCICI/Vigilance.git"

.EXAMPLE
  .\scripts\company-transfer.ps1 -Phase supabase -SupabaseProjectRef "abcdefghijklmnop"
#>
param(
    [ValidateSet('all', 'github', 'supabase', 'vercel', 'expo', 'verify')]
    [string]$Phase = 'all',

    [string]$GitHubRepoUrl = '',
    [string]$SupabaseProjectRef = '',
    [string]$VercelProductionUrl = '',
    [string]$ExpoOwner = '',
    [string]$CompanyName = 'Vigilance CFCICI'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing command: $name. Install it first (npm install -g $name)."
    }
}

function Phase-GitHub {
    Write-Step 'Phase 1: Push code to company GitHub'
    if (-not $GitHubRepoUrl) {
        $GitHubRepoUrl = Read-Host 'Company GitHub repo URL (https://github.com/ORG/Vigilance.git)'
    }
    git remote remove company 2>$null
    git remote add company $GitHubRepoUrl
    git push company main --force
    Write-Host 'Code pushed to company GitHub.' -ForegroundColor Green
}

function Phase-Supabase {
    Write-Step 'Phase 2: Supabase — schema, functions, secrets'
    Require-Command supabase
    if (-not $SupabaseProjectRef) {
        $SupabaseProjectRef = Read-Host 'NEW Supabase project ref (from dashboard URL)'
    }

    Write-Host 'Linking to company project...'
    supabase link --project-ref $SupabaseProjectRef

    Write-Host 'Applying migrations...'
    supabase db push

    Write-Host 'Deploying edge functions...'
    supabase functions deploy

    Write-Host @'

Set edge secrets (replace values, run once):
  supabase secrets set `
    SUPABASE_URL=https://PROJECT_REF.supabase.co `
    SUPABASE_ANON_KEY=eyJ... `
    SUPABASE_SERVICE_ROLE_KEY=eyJ... `
    RESEND_API_KEY=re_... `
    RESEND_FROM="VMS Alerts <alerts@your-domain.com>" `
    DASHBOARD_URL=https://your-vercel-url.vercel.app `
    CRON_SECRET=(random-32-chars) `
    WEBHOOK_SECRET=(random-32-chars)

Import data from OLD project (run separately with pg_dump/psql — see docs handoff guide).
Storage files: python scripts/migrate-storage.py
'@ -ForegroundColor Yellow
}

function Phase-Vercel {
    Write-Step 'Phase 3: Vercel web deployment'
    Require-Command vercel
    Set-Location "$Root\web"

  if (-not $SupabaseProjectRef) {
        throw 'Set -SupabaseProjectRef or run supabase phase first.'
    }

    $supabaseUrl = "https://$SupabaseProjectRef.supabase.co"
    $anonKey = Read-Host 'Paste NEW Supabase anon key (eyJ...)'

    if (-not (Test-Path '.vercel')) { vercel link }
    echo $supabaseUrl | vercel env add VITE_SUPABASE_URL production
    echo $anonKey | vercel env add VITE_SUPABASE_ANON_KEY production

    vercel --prod
    Set-Location $Root
    Write-Host 'Web deployed. Update DASHBOARD_URL in Supabase secrets to match.' -ForegroundColor Green
}

function Phase-Expo {
    Write-Step 'Phase 4: Expo EAS — new project + build'
    Require-Command eas
    Set-Location "$Root\mobile"

    if (-not $ExpoOwner) {
        $ExpoOwner = Read-Host 'Company Expo username (owner)'
    }
    $env:EXPO_OWNER = $ExpoOwner

    eas init --id
    Write-Host @'

Set mobile env (mobile/.env):
  EXPO_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

Build production APK:
  eas build --platform android --profile production
'@ -ForegroundColor Yellow
    Set-Location $Root
}

function Phase-Verify {
    Write-Step 'Phase 5: Verification checklist'
    @(
        '[ ] Company GitHub repo has latest main branch',
        '[ ] Supabase: tables visible in Table Editor',
        '[ ] Supabase: edge functions deployed (Dashboard → Edge Functions)',
        '[ ] Supabase: auth redirect URLs point to company Vercel URL',
        '[ ] Vercel: production URL loads login page',
        '[ ] Web: admin can log in',
        '[ ] Mobile: new APK connects to new Supabase',
        '[ ] Email alerts work (Resend configured)',
        '[ ] Storage: inspection-files bucket has migrated files'
    ) | ForEach-Object { Write-Host $_ }
}

switch ($Phase) {
    'github'   { Phase-GitHub }
    'supabase' { Phase-Supabase }
    'vercel'   { Phase-Vercel }
    'expo'     { Phase-Expo }
    'verify'   { Phase-Verify }
    'all'      {
        Phase-GitHub
        Phase-Supabase
        Phase-Vercel
        Phase-Expo
        Phase-Verify
    }
}
