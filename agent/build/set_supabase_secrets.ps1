# Set the issue_worker_token Edge Function secrets WITHOUT exposing them.
#
#   pwsh agent/build/set_supabase_secrets.ps1
#   pwsh agent/build/set_supabase_secrets.ps1 -JwtSecret "<override>"   # optional
#
# Both values are read automatically from code/.env (git-ignored; never printed):
#   - WORKER_JWT_SECRET        <- code/.env WORKER_JWT_SECRET (Supabase legacy JWT secret)
#   - RENT_COMPS_ANTHROPIC_KEY <- code/.env ANTHROPIC_API_KEY_RENT_COMPS
# Pass -JwtSecret only to override what's in code/.env.
# Run after `supabase link --project-ref vshalfxsydyjlouwbfmx`.
param([string]$JwtSecret = "", [string]$ProjectRef = "vshalfxsydyjlouwbfmx")
$ErrorActionPreference = "Stop"

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$envFile = Join-Path $repo "code\.env"
if (-not (Test-Path $envFile)) { throw "code/.env not found at $envFile" }

function Get-EnvValue($name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^\s*$name=", '').Trim().Trim('"').Trim("'")
}

$akey = Get-EnvValue 'ANTHROPIC_API_KEY_RENT_COMPS'
if (-not $akey) { throw "ANTHROPIC_API_KEY_RENT_COMPS not found in code/.env" }

if (-not $JwtSecret) { $JwtSecret = Get-EnvValue 'WORKER_JWT_SECRET' }
if (-not $JwtSecret) { throw "WORKER_JWT_SECRET not found in code/.env (or pass -JwtSecret)" }

supabase secrets set WORKER_JWT_SECRET="$JwtSecret" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "failed to set WORKER_JWT_SECRET (check your Supabase org permissions)" }
supabase secrets set RENT_COMPS_ANTHROPIC_KEY="$akey" --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "failed to set RENT_COMPS_ANTHROPIC_KEY (check your Supabase org permissions)" }

Write-Host "Set WORKER_JWT_SECRET and RENT_COMPS_ANTHROPIC_KEY (values not displayed)."
