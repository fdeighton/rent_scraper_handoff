# Publish a built Fitzrovia Agent installer to GitHub Releases.
#
#   cd agent
#   pwsh build/publish.ps1 -Version 0.1.0
#   pwsh build/publish.ps1 -Version 0.1.0 -File build/Output/FitzroviaAgent-0.1.0-setup.exe
#
# Creates (or reuses) the release tagged `agent-v<version>`, uploads the installer as
# an asset, and prints the public download URL to paste into app/config.js agentDownload.
# Prereqs: `gh auth login` once. The installer carries NO secrets (safe to be public).
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$File = "",
  [string]$Repo = "fdeighton/rent_scraper_handoff"
)
$ErrorActionPreference = "Stop"
$AgentDir = Split-Path $PSScriptRoot -Parent
Set-Location $AgentDir

if (-not $File) { $File = "build/Output/FitzroviaAgent-$Version-setup.exe" }
if (-not (Test-Path $File)) { throw "installer not found: $File  (build it first: build/build_windows.ps1)" }

$Tag = "agent-v$Version"
$Asset = Split-Path $File -Leaf

# Create the release if it doesn't exist yet (idempotent). NOTE: for a NOT-YET-EXISTING
# tag, `gh release view` writes "release not found" to stderr; under ErrorActionPreference
# = Stop that native stderr becomes a TERMINATING error and aborts the whole publish before
# the create. So drop to Continue just for the existence probe and branch on the exit code.
$ErrorActionPreference = "Continue"
gh release view $Tag --repo $Repo 1>$null 2>$null
$releaseExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $releaseExists) {
  Write-Host "Creating release $Tag"
  gh release create $Tag --repo $Repo --title "Fitzrovia Agent $Version" `
     --notes "Fitzrovia Agent $Version. Download, install, click Authorize once."
}

Write-Host "Uploading $Asset"
gh release upload $Tag $File --repo $Repo --clobber

$Url = "https://github.com/$Repo/releases/download/$Tag/$Asset"
Write-Host ""
Write-Host "Published. Paste into app/config.js -> agentDownload.windows:"
Write-Host "  $Url"
