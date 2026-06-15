# Supabase setup

**Path:** `06-operations/supabase-setup.md`

**Last updated:** May 18, 2026
**Owner:** Karim Mourad

---

## What this document is

A record of how the Fitzrovia Supabase organisation was configured at programme inception (May 1, 2026), how the `fitzrovia-prod` project was provisioned on May 4, 2026, and the reasoning behind each setting. Useful for Kenny's review, useful for future-Karim when something needs to change and the rationale isn't obvious.

This is not a step-by-step tutorial — Supabase's own docs do that job. It's a decisions-and-state document.

---

## Why Supabase, and how it fits the platform

Supabase is the database and backend-as-a-service layer for every internal tool the AI Studio builds. It is:

- **The primary data store** — Postgres database, file storage, auth, and realtime subscriptions, all in one product
- **The backend that non-technical builders don't have to build** — `supabase-js` plus auto-generated REST and GraphQL APIs mean the entire backend layer of most foundation tools is "configure tables, write Row-Level Security policies, ship UI." No separate Node/Express/Django backend required
- **The enforcement point for data-classification policy** — Postgres Row-Level Security is what makes the Green/Amber/Red model from `05-policies/data-classification.md` mechanically real, not aspirational

Why Supabase over alternatives: managed Postgres on Canadian infrastructure (`ca-central-1` is in Toronto), built-in auth that integrates with both row-level access control and Microsoft Entra (when SSO comes online), generous free tier for prototyping, and SOC 2 Type II compliance on Pro. The alternative — self-hosting Postgres on Azure or AWS plus separately solving auth, file storage, and realtime — would multiply Kenny's IT workload for marginal control gain.

---

## Plan and billing

- **Plan**: Pro — $25 USD per organisation per month (NOT per-project — common misconception worth flagging; the Chat #1 runbook had this wrong as $25/project)
- **Billing**: Monthly. Consistent with the broader programme principle of preserving optionality on AI-and-AI-adjacent tooling
- **Payment**: Fitzrovia corporate Visa ending 8456 (same card as the other four platforms)
- **Billing entity**: Fitzrovia Residential Inc. (with GST/HST registered for tax-recovery purposes)
- **Tax region**: Canada
- **Spend cap**: ON. If usage exceeds Pro's included quotas, projects go read-only mid-month rather than billing overages. Deliberate: an internal tool exceeding Pro quotas would be a bug, not a business event

**Why Pro and not Team or Enterprise**: Team is $599 USD/month (over 23× Pro). It unlocks SAML SSO, Audit Logs (62-day retention), HIPAA/BAA, and SOC 2 attestations beyond what Pro provides. None of that is justified at Fitzrovia's scale today. The cost difference ($574 USD/month) buys SSO that affects two people manually offboarding twice ever. Skip.

**Why monthly billing instead of annual**: Annual saves about 17% but commits us before Fitzrovia's tooling stack stabilises. Monthly preserves the option to walk away or migrate at one month's notice.

**Pro quota baseline** (the included usage before overages would kick in if spend cap were off):
- 100,000 monthly active users (Fitzrovia has ~200 staff at most — way under)
- 8 GB database disk per project
- 250 GB egress
- 100 GB file storage
- Daily backups stored 7 days
- 7-day log retention

For foundation-phase scale and beyond, none of these limits will be approached.

---

## Org-level configuration

### Identity

- **Organisation name**: `Fitzrovia`
- **Organisation slug**: `credaozaqnbkqcxpnjug` — auto-generated, **read-only on Pro plan**. Don't waste time trying to change it. Cosmetic only; navigation happens via the dashboard sidebar, not URL typing. Slug-changing is a Team-plan feature. Worth flagging because it's a Supabase quirk that wastes time if you don't know about it.
- **Billing entity**: Fitzrovia Residential Inc.

### Data privacy

Configured under `Settings → Data Privacy`:

- **Supabase Assistant Opt-in Level**: **Disabled**. No data is shared with third-party AI providers (Supabase Assistant uses OpenAI under the hood). Deliberate decision because:
  - We handle Red-classified data per `05-policies/data-classification.md`
  - Fitzrovia has no data processing agreement with Supabase's AI provider partners
  - Even the "Schema Only" middle option leaks operational signals via table and column names that, in aggregate, describe Fitzrovia's business

The trade-off: we lose access to the in-dashboard AI helper that suggests SQL queries and explains schema. That's an acceptable trade — Karim and the builders use Claude Code (with explicit Fitzrovia-controlled context) for the same purpose.

### Security

Configured under `Settings → Security`:

- **Require MFA to access organization**: ON. Every member must have MFA on their personal Supabase account before accessing org resources. Same posture as GitHub and Vercel
- **Karim's personal Supabase account MFA**: enrolled via Microsoft Authenticator (TOTP), labeled clearly so the recovery codes are findable

### Members

| Member | Role | Status |
|---|---|---|
| Karim Mourad | Owner | Active |
| Kenny Marcano | — | Deferred. Kenny doesn't need day-to-day Supabase dashboard access today. The universal admin model from `05-policies/access-control.md` doesn't require him to be a Supabase org member; he can read deployment health from Vercel and database logs via Karim if needed. Add when he genuinely needs hands-on database access |
| Joseph Agozzino | — | Deferred until he onboards into a working environment after Tool Starter exists |

---

## Plan-gated features deliberately NOT pursued

Two features are gated behind the Team plan ($599 USD/month, $574 more than Pro). Both skipped:

### SAML SSO via Microsoft Entra

Skipped. The cost-benefit calculation: $574/month extra to enable SSO for an organisation with three eventual members would mean spending $6,888/year so that Karim doesn't have to manually remove Kenny's Supabase access on the day Kenny offboards (and vice versa). That's a manual step affecting two people, twice in their entire tenure.

This creates a documented exception to the otherwise-universal SSO model: `05-policies/access-control.md` explicitly notes that Supabase access is managed via individual `@fitzrovia.ca` accounts with MFA, not via Microsoft Entra, and that the universal admin (Karim) must manually remove a departing person's Supabase membership within a day. Worth knowing this exception exists before quoting "all platforms are SSO'd" to anyone.

Revisit if: team grows beyond five people, or compliance pressure (Law 25 audit, customer security questionnaires) creates a real requirement.

### Audit Logs

Skipped for the same reason. Pro plan has 7-day log retention for database queries and edge function invocations; Team adds proper audit logging with 62-day retention. At Fitzrovia's scale, the audit need is met by Postgres's own `pg_stat_*` views, application-layer logging via the `tool_activity_log` schema (deferred design — see configuration list), and Vercel's deployment audit trail.

Revisit alongside SAML SSO — both are unlocked by the same plan upgrade.

---

## The `fitzrovia-prod` project

### Creation

Created May 4, 2026 inside the Fitzrovia organisation.

- **Project name**: `fitzrovia-prod`
- **Region**: `ca-central-1` (Canada Central, Toronto). Required for Law 25 / PIPEDA data residency. **Cannot be changed after creation** — picking the wrong region means delete-and-recreate
- **Compute size**: `t4g.micro` (1 GB RAM, 2-core ARM CPU) — Pro plan default. Scales up later if needed; downsizing is also possible
- **Branch**: `main` (Production)
- **API URL**: `https://vshalfxsydyjlouwbfmx.supabase.co`
- **Database password**: generated at creation time, copied to password vault. Supabase shows it once — losing it means a password reset

### Security toggles set at creation (deliberate, not defaults)

Three security choices made at project creation, each with downstream consequences worth understanding:

| Toggle | Setting | Why |
|---|---|---|
| **Enable Data API** | ON | Auto-generates REST API for `public` schema; required for `supabase-js` to work from Next.js apps. Without this, every database call would need a custom backend route |
| **Automatically expose new tables** | **OFF** | Supabase's UI itself flags this as the recommended default. Tables now require explicit role grants (`GRANT SELECT ON table TO authenticated`) before they're queryable via the Data API. Aligns with the handbook principle: new tables default to closed, exposure is deliberate. **Trade-off**: one extra `GRANT` line in each migration that creates a public-facing table. Worth it |
| **Enable automatic RLS** | **ON** | Postgres event trigger automatically enables Row-Level Security on every new table in `public`. Belt-and-suspenders with the planned CI check on Red tables (`04-standards/codebase-organization.md`). Catches tables created outside the migration flow (e.g., directly in the SQL editor). **Trade-off**: Green tables also get RLS enabled and need a one-line permissive policy. Cheap; safety is real |

The combined effect: a builder cannot accidentally create an exposed, RLS-disabled table. Both safety nets must be deliberately overridden in SQL for that to happen, and overriding them requires explicit grants and policies that show up in the migration diff and CodeRabbit review.

### Deferred at project creation

- **`tool_activity_log` schema**: deferred — design alongside the support widget package or first foundation tool when we have concrete usage to design against. Tracked as a 🟠 task in the configuration list. Schema design depends on what tools actually do; drafting it in the abstract risks getting columns wrong and needing to migrate later
- **Network restrictions / IP whitelisting**: deferred until non-Karim users access production. Office IPs captured (Toronto: `173.243.205.62`; Montreal: `75.98.201.98`) but not yet applied. Two distinct decisions to make when revisiting:
  - Database connection allowlisting (would affect Vercel's ability to connect from build infrastructure — needs Vercel egress IPs included)
  - Dashboard allowlisting only (simpler, just restricts who can sign into the Supabase dashboard from where)
- **Custom JWT secret rotation cadence**: defaults kept; revisit if compliance requires it
- **Connection pooling configuration**: defaults kept (Transaction mode); revisit per-app if a tool has unusual connection patterns

---

## What's NOT enabled (deliberately)

- **Supabase Auth (the auth product)**: not configured today. Each app's own auth model gets decided per-tool. Most foundation tools will use Microsoft Entra SSO via the app's Vercel-side configuration, not Supabase Auth. Supabase Auth might be used for service-account-style flows or for external user invites if a tool ever exposes itself outside Fitzrovia
- **Storage buckets**: none provisioned. Will be created per-tool when a tool needs file storage (e.g., the intake form needs to accept file uploads)
- **Edge Functions**: none deployed. Most logic lives in Next.js on Vercel; Edge Functions are only used for things that genuinely need to run close to the database (large data transformations, scheduled jobs)
- **Realtime subscriptions**: not configured today. Will be enabled per-table when a tool needs live updates
- **Read replicas**: not provisioned. Pro plan supports one; not justified at foundation-phase scale
- **Branching for Supabase projects**: Pro supports it, but we're not using it. Migrations are version-controlled in Git and applied to `fitzrovia-prod` directly. Revisit if a destructive migration ever needs a sandbox

---

## Connected integrations

| Integration | Status | Notes |
|---|---|---|
| Vercel ↔ Supabase | Pending | Vercel-side environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) will be added per-app at import time. Service role key is a Sensitive Environment Variable per Vercel's enforcement policy |
| GitHub ↔ Supabase | Not used | Supabase has a GitHub integration for migration deployment. Not used today; migrations run via the Supabase CLI from local environments |
| CodeRabbit ↔ Supabase | Not applicable | CodeRabbit reviews code in `fitzrovia-tools`, which includes SQL migrations. Direct Supabase integration not needed |

---

## API key formats — legacy JWT vs new format

Supabase rolled out a new API key format (`sb_publishable_…` and `sb_secret_…`) alongside the legacy JWT format (`eyJ…`). Both formats coexist in every project and are accessible from separate tabs in **Dashboard → Settings → API Keys**. They are **not interchangeable for every operation.**

The rule for Fitzrovia:

| Env var | Format | Why |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New `sb_publishable_…` | Standard reads/writes through the SDK; new format is the recommended default for client-side keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **Legacy JWT (`eyJ…`)** | Required for cryptographic operations like `createSignedUploadUrl()` and `createSignedUrl()`. The new `sb_secret_…` format fails JWT parsing on these operations and surfaces as `"Invalid Compact JWS"` errors in Vercel function logs |

To grab the legacy service role key: Supabase Dashboard → Settings → API Keys → **"Legacy anon, service_role API keys"** tab → click Reveal on the `service_role` row → copy the entire three-segment string. Set this as `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Sensitive, Production + Preview) and in local `.env.local`.

When Supabase eventually deprecates the legacy format, the workaround is to mint a JWT ourselves using the project's JWT secret (also in the dashboard). Out of scope until the deprecation timeline is concrete. Discovered during AIS-11 (May 18, 2026) after burning the better part of an evening on misdiagnosed env var issues.

---

## Watchlist (consolidated)

Things deliberately left at default or deferred today that may want adjustment as the studio matures:

1. **`tool_activity_log` schema**: design and apply alongside the support widget package or first foundation tool. Tracked in the configuration list
2. **Network restrictions**: revisit before non-Karim user accesses production. Decide A vs B (database connection vs dashboard-only allowlisting). Office IPs already captured
3. **Compute size**: `t4g.micro` is sufficient for foundation-phase. Watch CPU/RAM utilisation in the dashboard once tools are live; scale up if a single tool consistently saturates the instance
4. **Read replica**: revisit if read-heavy reporting tools surface
5. **Team plan upgrade**: revisit if SSO becomes a hard requirement (compliance, audit, scale). Both SAML SSO and Audit Logs unlock together at $574/mo extra. The trigger is "real requirement," not "wouldn't it be nice"
6. **Spend cap**: keep ON unless a tool's legitimate usage outgrows the Pro quota and overages are a known, accepted business cost

---

## What's not configured today (intentionally)

- **No tables exist in `fitzrovia-prod`**. The project is provisioned and ready; first table creation happens when there's actual code to run against it. The `automatic RLS` and `automatically-expose-new-tables-OFF` toggles are waiting silently
- **No environment variables stored in any app's Vercel project** because no Vercel project exists yet. When `apps/hub/` is imported, that's when `SUPABASE_URL` etc. get set
- **No service role keys distributed**. The service role key for `fitzrovia-prod` is in the Supabase dashboard only; will be copied to Vercel's Sensitive Environment Variables at import time, never to a `.env.local` file or chat or commit
