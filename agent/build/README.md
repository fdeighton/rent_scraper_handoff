# Packaging the Fitzrovia Agent

Turns this folder into a **downloadable desktop app** (system-tray on Windows,
menu-bar on macOS) that auto-starts on login and pairs to a user's account in one
click. Packaging is **PyInstaller** (bundles the Python runtime + engine) wrapped
in an OS installer — *not* Tauri/Electron, which don't fit a Python+Playwright app.

## Pieces

| File | What it does |
|---|---|
| `agent.spec` | PyInstaller spec — bundles `tray.py` + `code/` engine + `sites/*.json` + assets, preserving repo layout under the bundle root (so `handlers/comps.py` finds the engine via `sys._MEIPASS`). |
| `installer.iss` | Inno Setup — per-user Windows installer, start-on-login, launches after install. |
| `build_windows.ps1` | One-shot: bake config → icon → PyInstaller → Inno Setup. |
| `build_macos.sh` | One-shot: bake config → PyInstaller → `.dmg`. |

## Build (Windows)

```powershell
cd agent
pip install -r requirements.txt pyinstaller
# Inno Setup must be installed (iscc on PATH)
pwsh build/build_windows.ps1 -Version 0.1.0 `
  -SupabaseUrl "https://<ref>.supabase.co" `
  -AuthorizeUrl "https://your-site/authorize.html"
# -> build/Output/FitzroviaAgent-0.1.0-setup.exe
```

## Build (macOS)

```bash
cd agent
pip install -r requirements.txt pyinstaller
brew install create-dmg
./build/build_macos.sh 0.1.0 "https://<ref>.supabase.co" "https://your-site/authorize.html"
# -> build/FitzroviaAgent-0.1.0.dmg
```

## Playwright Chromium

Not bundled (keeps the installer small). On first scrape the agent runs
`playwright install chromium` if the browser is missing. To ship fully offline,
add the browser to the spec `binaries` and set `PLAYWRIGHT_BROWSERS_PATH`.

## What gets baked vs. delivered at runtime  ⚠️

**Baked into the installer (safe — non-secret):** `SUPABASE_URL`, `AGENT_AUTHORIZE_URL`.

**Delivered at runtime via pairing (never baked) — both secrets:**
- **Worker token** — the scoped `scrape_worker` JWT.
- **Anthropic key** — the comps extraction key.

Both are returned together by the `issue_worker_token` Edge Function when the user
clicks Authorize, and stored in the OS keychain (`pairing.get_credentials`). This is
"option 2" — neither secret is ever in the installer, both are centrally rotatable
(change the Edge Function secrets), and each lands only on machines a signed-in user
explicitly authorized. Set both function secrets:
```
supabase secrets set WORKER_JWT_SECRET="<project JWT secret>"
supabase secrets set RENT_COMPS_ANTHROPIC_KEY="<sk-ant-...>"
```
Caveat: the Anthropic key does land on each paired machine (extractable by that user).
If you later want it off the client entirely, move the Claude extraction server-side
(agent fetches on the residential IP → Edge Function runs the extract) — a follow-up,
not required for distribution.

## Signing (your side)

- **Windows:** `signtool sign /fd SHA256 /tr <timestamp> /td SHA256 FitzroviaAgent-*-setup.exe`
- **macOS:** `codesign --deep --options runtime` + `notarytool` + staple the `.dmg`.

## Publishing → GitHub Releases

Installers carry **no secrets** (token + key come via pairing), so they're safe to host
publicly. We use GitHub Releases — free, unlimited bandwidth on public repos.

```powershell
# Windows  (after build_windows.ps1)
pwsh build/publish.ps1 -Version 0.1.0
```
```bash
# macOS    (after build_macos.sh)
./build/publish.sh 0.1.0
```

Each creates/reuses the release tagged `agent-v<version>`, uploads the installer, and
prints the public download URL — paste it into `app/config.js → agentDownload.{windows,mac}`.
The building card's Download button picks the right one by OS automatically.
Prereq: `gh auth login` once. Asset URL is deterministic:
`https://github.com/fdeighton/rent_scraper_handoff/releases/download/agent-v<version>/<file>`
