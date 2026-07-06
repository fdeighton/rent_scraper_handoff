# Fitzrovia Agent — note for IT / Security

**Publisher:** Fitzrovia   ·   **Product:** Fitzrovia Agent   ·   **Executable:** `FitzroviaAgent.exe`
**Install path (per-user, no admin):** `%LOCALAPPDATA%\FitzroviaAgent\`
**Autostart:** per-user Startup shortcut (`shell:startup`) — runs as the logged-in user, never elevated.

This is an **internal, first-party Fitzrovia application**. It is not third-party software.

---

## What the agent does
The Fitzrovia Agent is a small background worker that collects **public rental-listing prices**
for Fitzrovia's internal competitor-rent tracker. It is **pull-based and outbound-only**: it polls
Fitzrovia's control plane for jobs, runs a scrape on the local machine, and posts the results back.
It opens **no inbound ports** and accepts no inbound connections.

## Why it uses Playwright / browser automation
Target apartment websites render prices **client-side** (JavaScript) and often behind interactive
availability widgets. A plain HTTP fetch returns empty pages. The agent therefore drives a real
**Chromium** browser (via Playwright) to load each page as a normal visitor would, from the
employee's normal network — which is also why it runs on a workstation rather than a datacenter IP.
Chromium is downloaded once on first run into the per-user Playwright cache
(`%LOCALAPPDATA%\ms-playwright\`); it is not bundled in the installer.

## Endpoints it contacts (all HTTPS, outbound)
| Host | Purpose |
|---|---|
| `https://<project>.supabase.co` | Job queue + results (scoped RPC calls: claim/heartbeat/complete) |
| `https://<fitzrovia-hub>.vercel.app` | `/api/comp-scrape/extract` — turns scraped text into structured data |
| `api.github.com` + `github.com` (release assets) | Self-update check + installer download (Fitzrovia's private repo) |
| Playwright CDN (first run only) | One-time Chromium download |
| Public apartment-listing sites | The scrape targets themselves |

## Credentials & data handling
- **No Anthropic / LLM API key is stored on the machine.** The AI extraction runs **server-side on
  the Fitzrovia hub**; the agent only sends page text and receives structured results. The key never
  reaches the endpoint.
- The agent authenticates with a **scoped, revocable worker token** (a `scrape_worker` JWT limited to
  the worker RPCs — it cannot read or write anything else). It is obtained via a one-click browser
  pairing and stored in the **Windows Credential Manager**, not in a file. It can be revoked centrally
  at any time, which immediately disables the agent.
- No customer or personal data is collected — only public listing prices/floorplans.

## Updates
The agent checks GitHub Releases for a newer signed build and, if found, downloads the installer and
runs it silently, then relaunches. Update activity is logged to
`%LOCALAPPDATA%\FitzroviaAgent\update.log` and `install.log`.

---

## Recommended allowlisting (stops the repeated "unsigned/changing binary" flags)
The root cause of the Sentinel flags is that each local build is a **new file hash** and (until signed)
**unsigned**. Per-file-hash allowlisting is therefore whack-a-mole. Instead:

1. **Allowlist by publisher certificate**, not by hash. Once builds are Authenticode-signed with the
   Fitzrovia code-signing certificate, add a **signer/publisher rule**:
   - **WDAC / AppLocker:** a *Publisher* rule for the Fitzrovia signer covers every current and future
     build automatically.
   - **Microsoft Defender for Endpoint / Sentinel:** create an **indicator/allow rule by certificate
     (signer)**, or a path+signer exception for `%LOCALAPPDATA%\FitzroviaAgent\FitzroviaAgent.exe`.
2. The binaries now carry **stable version metadata** (ProductName *Fitzrovia Agent*, Company
   *Fitzrovia*, Copyright, semver version) and a **stable product/install identity**, so signer rules
   match cleanly across versions.

## Code-signing status
Builds are **signing-ready** but require Fitzrovia's certificate. To produce signed builds:

```
pwsh build/build_windows.ps1 -Version <x.y.z> `
    -SupabaseUrl <...> -AuthorizeUrl <...> `
    -SignThumbprint <cert-SHA1-thumbprint-in-cert-store>
# or:  -SignPfx C:\path\Fitzrovia.pfx -SignPfxPassword <pw>
```

This signs both `FitzroviaAgent.exe` and the installer with SHA-256 + RFC-3161 timestamping. We do
**not** self-sign or fake-sign. Options for the certificate: an **OV/EV Authenticode** cert from a CA
(DigiCert, Sectigo, etc.) or **Azure Trusted Signing** (Microsoft-managed, cheaper, integrates with
`signtool`). EV/Trusted Signing additionally gives immediate SmartScreen reputation.
