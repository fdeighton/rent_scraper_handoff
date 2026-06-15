# Vercel setup

**Path:** `06-operations/vercel-setup.md`

**Last updated:** May 18, 2026
**Owner:** Karim Mourad

---

## What this document is

A record of how the Fitzrovia Vercel team was configured at programme inception (May 1, 2026), the GitHub connection verified on May 4, 2026, and the reasoning behind each setting. Useful for Kenny's review, useful for future-Karim when something needs to change and the rationale isn't obvious.

This is not a step-by-step tutorial — Vercel's own docs do that job. It's a decisions-and-state document.

---

## Why Vercel, and how it fits the platform

Vercel is the deployment and hosting layer for every internal tool the AI Studio builds. It is:

- **The runtime** — every `apps/*` in `fitzrovia-tools` deploys to Vercel as a Next.js project. Production builds run on merges to `main`; preview builds run on every PR.
- **The first reviewer of the deployed reality** — preview deployments are the primary testing environment per `04-standards/branching-and-prs.md`, "Testing before merge." A non-technical approver clicks the preview URL on a PR and exercises the change in a real browser before approving.
- **The enforcement point for signed commits** — Vercel's "Require Verified Commits" toggle blocks any push that isn't cryptographically signed, which is what made commit signing a real production requirement and why `06-operations/commit-signing-setup.md` exists.

Why Vercel over alternatives: deepest Next.js integration (Vercel maintains Next.js), zero-config preview deployments per branch, native GitHub integration, Canadian data residency available, and SOC 2 Type II compliance baked in on Pro. The alternative — self-hosting Next.js on Azure or AWS — would multiply Kenny's IT workload for marginal control gain.

---

## Plan and billing

- **Plan**: Pro — $20 USD per active member per month
- **Active members today**: 1 (Karim only). Will scale to 2-3 as Kenny and Joseph join the team
- **Billing**: Monthly. Consistent with the broader programme principle of preserving optionality on AI-and-AI-adjacent tooling
- **Payment**: Fitzrovia corporate Visa ending 8456 (same card as the other four platforms)
- **Billing entity**: Fitzrovia Residential Inc.
- **Tax region**: Canada

**Why Pro and not Enterprise**: Enterprise unlocks Audit Logs, IP Blocking, Protected Git Scopes, Directory Sync, and SAML SSO included rather than as a paid add-on. None of those justify the Enterprise price step at Fitzrovia's scale today. The Vercel SAML add-on for SSO can be purchased separately on Pro when Kenny is ready to wire up Microsoft Entra (see "What's NOT enabled" below).

**Why monthly billing instead of annual**: Annual saves about 15% but commits us before Fitzrovia's tooling stack stabilises. Monthly preserves the option to walk away at one month's notice.

---

## Org-level configuration

### Identity and team

- **Team name**: `Fitzrovia`
- **Team slug**: `fitzrovia` (URL: `vercel.com/fitzrovia`)
- **Avatar / Preview Deployment Suffix**: defaults kept (Vercel's default suffix is `vercel.app`; customising would require a dedicated domain, overkill for our scale)
- **Billing email**: `kmourad@fitzrovia.ca` (private)

### Members

| Member | Role | Status |
|---|---|---|
| Karim Mourad (`kmourad-fitzrovia`) | Owner | Active |
| Kenny Marcano | — | Deferred. Each active member adds $20 USD/mo; Kenny doesn't push code today and doesn't need a Vercel seat for the universal admin model. Add when he genuinely needs day-to-day Vercel access (likely alongside SSO rollout). |
| Joseph Agozzino | — | Deferred until he onboards into a working environment after Tool Starter exists |

The deferral on Kenny's seat is a deliberate cost decision, not an access oversight — he can read deployment status from PR comments (CodeRabbit posts them), and the universal admin model in `05-policies/access-control.md` doesn't require him to be a Vercel team member to administer the broader platform. When Kenny needs hands-on Vercel access, the seat is a single click and one month's lag at most.

### Personal account hygiene (Karim)

- **2FA enrolled** via Microsoft Authenticator (TOTP) on May 1, 2026
- **Username changed** from `dee-of-o` (legacy personal handle) to `kmourad-fitzrovia` to match the GitHub identity
- Optional: adding a Passkey as a secondary auth method is a low-cost convenience but not required

### Deployment Protection

Configured under `Settings → Deployment Protection`:

- **Vercel Authentication: ON, Standard Protection.** Preview URLs are gated behind Vercel's auth — only signed-in team members (and once SSO is wired up, anyone with `@fitzrovia.ca`) can access preview deployments. Production domains stay accessible because that's where the actual users will be (gated separately by each tool's own auth, e.g. Microsoft Entra SSO inside the app).
- **"Require Owner role to disable or change Vercel Authentication settings": ON.** Prevents anyone other than Karim and Kenny from accidentally turning off preview-URL protection.

The "Standard Protection" choice over "All Deployments" is deliberate: All Deployments would gate production too, which doesn't fit our model (production tools need to be reachable by Fitzrovia staff who aren't Vercel team members). The preview-URL gating is what matters — keeps in-flight work invisible to anyone outside the team.

### Security & Privacy

Configured under `Settings → Security & Privacy`:

| Setting | Value | Why |
|---|---|---|
| **Require Verified Commits** | ON | Every Git commit must be cryptographically signed or the build is blocked. Belt-and-suspenders with GitHub's `Require signed commits` rule on the `main protection` ruleset. Triggered the creation of `06-operations/commit-signing-setup.md` |
| **Enforce Sensitive Environment Variables** | ON | Environment variables are write-only once stored — no team member can read the plaintext value via dashboard or API. Forces builders to treat env vars as secrets, not as configuration to peek at |
| **Two-Factor Authentication Enforcement** (team-level) | ON | Kenny and Joseph cannot access the team without 2FA on their personal Vercel accounts. Same secure-2FA-only posture as GitHub |
| **IP Address Visibility** (Show in Dashboard + Show in Log Drains) | Both ON | Deliberate decision: visible IPs are needed for incident response per `05-policies/incident-response.md`. The privacy framing of these toggles applies to external sharing, not internal observability |
| **Protected Git Scopes** | Skipped | Enterprise-only |
| **Audit Log** | Skipped | Enterprise-only — at Pro-tier scale, the audit need is met by Vercel's deployment history + GitHub commit history |
| **IP Blocking** | Skipped | Enterprise-only — and not justified at our scale (we don't expect IP-targeted attacks against internal-only tools) |

### Build and deployment defaults

Configured under `Settings → Build & Deployment` and `Settings → Functions`:

- **Build Machines**: Standard (4 vCPUs, 8 GB Memory) — sufficient for foundation-phase apps. Faster tiers cost more per build minute and provide diminishing returns until builds are CPU-bound (which Next.js apps generally aren't)
- **Remote Caching**: enabled (default). Build artifacts cache across team — speeds up builds when multiple builders touch the same project
- **On-Demand Concurrent Builds**: default kept. Pro plan allows up to 12 concurrent builds, which is plenty
- **Deployment Retention**: defaults kept
  - Canceled: 30 days (you'd never roll back to a canceled build)
  - Errored: 90 days (long enough to debug the "why did it fail two months ago" case)
  - Pre-Production: 180 days (preview URLs — generous, but storage is cheap)
  - Production: 1 year (rollback window for production changes)

### Region

**Region selection happens per-project, not at the team level.** Each `apps/*` ships with a `vercel.json` containing `{"regions": ["yul1"]}` (Toronto) to enforce Canadian data residency for Law 25 / PIPEDA. The Code Review Skill in Claude Teams is configured to flag any new app PR that's missing this file or has a non-`yul1` region.

The `cle1` region code from earlier runbook drafts is the older Cleveland region; the correct Toronto region code is **`yul1`** (Toronto Pearson airport IATA code, Vercel's convention for region naming). Worth flagging because earlier docs in this handbook may still reference `cle1` — they're being patched as encountered.

Kenny's written sign-off on Canadian region verification is a pending 🟠 task in `! handbook configuration list/handbook-configuration-list.md`. Will be furnished once the first app is deployed and a screenshot of the Functions region configuration can be captured.

---

## GitHub connection

The Vercel ↔ GitHub org connection was verified on May 4, 2026. Signing in to `vercel.com/new` from the Fitzrovia team shows `fitzrovia-residential` in the Git provider dropdown and `fitzrovia-tools` as importable. The connection was established by inheritance during the original Vercel team setup on May 1.

**`fitzrovia-tools` itself is NOT imported as a Vercel project.** This is deliberate. Vercel's standard monorepo deployment pattern is one project per app — each `apps/<tool-name>/` becomes its own Vercel project with its own production URL, its own preview deployments, and its own environment variable scope. Importing `fitzrovia-tools` at the repo root would create a project Vercel can't build (no `package.json` build script at the root, no Next.js config), and we'd just have to delete it later.

**Pre-decided import spec for `apps/hub/` (the first import):**

- **Vercel project name**: `hub` (matches the app folder name)
- **Root Directory**: `apps/hub`
- **Production URL**: `hub.fitzrovia.ca` (custom domain, added once Kenny provisions DNS)
- **`vercel.json`** at `apps/hub/` with `{"regions": ["yul1"]}`
- **Connected Git branch**: `main` for production; preview deployments triggered automatically on every PR

Subsequent app imports follow the same pattern — project name = folder name, root directory = `apps/<tool-name>`, region = `yul1`, custom domain decided per tool.

The first import happens when `apps/hub/` exists, which is part of Phase 4 work in the roadmap.

---

## What's NOT enabled (deliberately)

- **SAML SSO via Microsoft Entra**: pending. Vercel's SAML add-on is a paid extra on top of Pro. Deferred until Kenny's broader Entra rollout is ready and the SAML add-on cost can be approved alongside it. Today, identity is managed via individual Vercel accounts with mandatory 2FA.
- **Custom domain `hub.fitzrovia.ca`**: pending DNS provisioning by Kenny.
- **Vercel Marketplace integrations** (logging, observability, third-party services): none added today. The default Vercel observability is sufficient at foundation-phase scale.
- **Edge Config / KV / Postgres / Blob storage**: none provisioned. Supabase is the database; we don't need Vercel's first-party storage products.
- **Speed Insights / Web Analytics**: not enabled. Defer until first production tool ships and there's a real performance question to answer with data.

---

## Operational gotchas

Two facts about Vercel's Pro tier that aren't obvious until they bite. Both surfaced during AIS-11 (May 18, 2026).

**Build cache and env var changes.** `NEXT_PUBLIC_*` environment variables are inlined into the JavaScript bundle at build time, not read at runtime. When an env var changes in Vercel, Production redeploys automatically and picks up the new value; preview branches **do not** redeploy automatically and stay frozen on whatever was baked in at their original build. To force a preview branch to pick up an env var change, push a trivial commit OR redeploy manually via the Deployments three-dot menu — and **uncheck "Use existing Build Cache"** before clicking Redeploy. Leaving the cache checked silently reuses the stale bundle, which is the most confusing failure mode because the deploy appears to succeed but nothing actually changes. After the fresh build, hard-refresh the browser (`Ctrl+Shift+R`) to clear the client-side cached bundle too.

**Function payload limit (4.5 MB).** Server Actions and API routes on the Pro tier have a hard 4.5 MB limit on the request payload. For file uploads of any meaningful size, route bytes directly from the browser to the storage backend (e.g., Supabase Storage via signed upload URLs) rather than through a Server Action. The pattern AIS-11 settled on: (1) Server Action mints signed upload URLs and returns them, (2) browser uploads bytes directly to Supabase using those URLs, (3) Server Action runs server-side validation + finalization against the uploaded objects. The 4.5 MB ceiling never gets hit because file bytes never traverse Vercel.

---

## Watchlist (consolidated)

Things deliberately left at default or deferred today that may want adjustment as the studio matures:

1. **Kenny's Vercel team membership**: add when he needs day-to-day access. Costs $20 USD/mo extra; not worth it today.
2. **SAML SSO add-on**: revisit when Kenny's Entra rollout is on the table. Replaces team-level 2FA enforcement with org-level identity management.
3. **Speed Insights / Web Analytics**: enable when first production tool ships and we want real performance/usage data. Both are paid add-ons on Pro.
4. **Build Machines tier**: revisit if any single app's build time exceeds 5 minutes consistently. Move that app to a faster tier rather than the whole team.
5. **Deployment Retention defaults**: revisit if storage costs ever surface as material on the invoice. At foundation-phase scale they won't.

---

## What's not configured today (intentionally)

- **No Vercel projects exist yet**. The team is provisioned and ready; first project import (`apps/hub/`) happens when that app exists. Until then, the team is empty by design.
- **Environment variables**: none stored. Will be populated per-app at import time, scoped to that project. Real values never in code; placeholders only in `env.example`.
- **Deployment hooks / webhooks**: none configured. CodeRabbit and Linear manage their own webhook subscriptions through the GitHub integration, not Vercel.
- **Custom build commands / install commands**: none configured at the team level. Per-app overrides happen in each project's settings if needed.
