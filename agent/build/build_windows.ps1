# Build the Fitzrovia Agent Windows installer.
#
#   cd agent
#   pwsh build/build_windows.ps1 -Version 0.1.0 `
#       -SupabaseUrl "https://<ref>.supabase.co" `
#       -AuthorizeUrl "https://your-site/authorize.html"
#
# Produces: agent/build/Output/FitzroviaAgent-<version>-setup.exe
# Prereqs:  pip install -r requirements.txt pyinstaller ; Inno Setup (iscc on PATH).
# NOTE: only NON-secret config is baked in. The DB token + (optionally) the Anthropic
#       key are delivered at runtime via pairing — never compiled into the installer.
param(
  [string]$Version = "0.1.0",
  [Parameter(Mandatory = $true)][string]$SupabaseUrl,
  [Parameter(Mandatory = $true)][string]$AuthorizeUrl
)
$ErrorActionPreference = "Stop"
$AgentDir = Split-Path $PSScriptRoot -Parent
Set-Location $AgentDir

Write-Host "1/4  Baking non-secret config -> build/agent.env"
@"
SUPABASE_URL=$SupabaseUrl
AGENT_AUTHORIZE_URL=$AuthorizeUrl
AGENT_VERSION=$Version
HEADLESS=true
"@ | Out-File -FilePath "build/agent.env" -Encoding ascii

Write-Host "2/4  Generating icon.ico from assets/icon.png"
python -c "from PIL import Image; Image.open('assets/icon.png').save('assets/icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"

Write-Host "3/4  PyInstaller bundle"
pyinstaller build/agent.spec --noconfirm --distpath dist --workpath build/work

Write-Host "4/4  Inno Setup installer"
iscc "/DMyAppVersion=$Version" build/installer.iss

Write-Host "Done -> build/Output/FitzroviaAgent-$Version-setup.exe"
Write-Host "Next: code-sign the .exe (signtool), then host it and paste the URL into app/config.js agentDownload.windows"
