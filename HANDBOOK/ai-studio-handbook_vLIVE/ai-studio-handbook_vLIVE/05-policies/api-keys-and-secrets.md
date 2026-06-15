# API keys and secrets

**Path:** `05-policies/api-keys-and-secrets.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

## TL;DR

- **One key per tool.** Each AI Studio tool that calls a paid API gets its own dedicated API key. No shared keys across tools.
- **Karim and Kenny provision keys.** Builders never create keys themselves.
- **Approval scales with spend:** Karim approves up to $500/month projected spend. Above $500/month, Karim and Corey jointly approve before the key is issued.
- **Storage:** production keys live in Vercel environment variables (per project), local dev keys live in `.env.local` (gitignored), canonical secrets live in Fitzrovia's password vault.
- **Every key has a soft monthly spend limit set in the provider's console** — runaway costs cut off automatically.
- **Karim reviews per-key spend monthly.**

---

## Purpose

This policy defines how the AI Studio handles API keys and secrets that incur cost or grant access to external services — primarily Anthropic API keys (paid Claude API usage), but also Yardi, OpenAI, Google Maps, and any future paid integrations.

Two real risks the policy addresses:

1. **Cost runaway.** A tool with a bug or a prompt loop can burn through API budget overnight. Without per-tool keys and per-key limits, one tool's incident becomes the studio's.
2. **Secret leakage.** API keys committed to repos, posted in chat, or shared via screenshots end up in the wrong hands. Cost: an attacker rents Claude (or whatever) on Fitzrovia's tab until the key is rotated.

The policy keeps cost attributable, leakage contained, and rotation simple.

---

## Why one key per tool

Anthropic (and most providers) supports multiple API keys per organization. We use that capability deliberately.

**The benefits:**

- **Cost attribution.** Anthropic's console shows spend by API key. When Corey asks "why did our AI spend triple last month?" Karim points to the specific tool. Without per-tool keys, the answer is "we don't know."
- **Containable revocation.** A compromised or runaway key can be revoked without affecting other tools. With a shared key, revoking it kills every tool simultaneously.
- **Easier rotation.** Rotating one key means updating one Vercel project's environment variable. With a shared key, rotation requires updating every project at once and risks downtime if any miss the rotation.
- **Spend limits per tool.** Anthropic's console lets you set a monthly spend cap per key. With per-tool keys, each tool has its own ceiling. With a shared key, one tool's overage starves the others.

The marginal management cost (one more env var per Vercel project) is small. The benefits are substantial.

**This applies to all paid API keys, not just Anthropic** — same reasoning for Yardi, OpenAI, Google Maps, or anything else with metered cost.

---

## Who provisions API keys

**Karim and Kenny only.**

Karim and Kenny are the universal admins (per `05-policies/access-control.md`) on the Anthropic Console and any other API provider's account. Neither Joseph nor future builders ever touch a provider console directly to mint keys.

When a builder needs a key for a new tool, they ask Karim (or Kenny when Karim is unavailable). The provisioner:

1. Confirms the tool's projected monthly spend (see "Approval and cost tiers" below)
2. Gets joint approval from Corey if the projection is above $500/month
3. Mints the key in the provider's console with a name that identifies the tool (e.g., `fitzrovia-leasing-pipeline-prod`)
4. Sets a soft monthly spend limit on the key
5. Adds the key to Vercel environment variables for the tool's project
6. Stores a backup copy in the password vault
7. Logs the key issuance in the configuration list

**The builder never sees the key value directly** in production. They reference it via `process.env.ANTHROPIC_API_KEY` (or whatever name the tool uses) and Vercel injects it at runtime. For local development, see "Local development keys" below.

---

## Approval and cost tiers

Friction scales with projected spend. The tiers:

| Projected monthly spend | Approval needed |
|---|---|
| Up to $500 | Karim approves directly |
| Above $500 | Karim and Corey jointly approve before the key is issued |

**Projected** spend is the builder's honest estimate at the time the tool is being built — based on expected user volume, model choice (Sonnet vs Opus vs Haiku), and tokens-per-call. Karim sense-checks the estimate against what similar tools actually spend.

**Why these specific thresholds:**

- **$500/month** is a real number for Fitzrovia's scale — enough to cover a small operational tool with moderate usage, low enough to require a check on anything that might be larger.
- **Karim alone** below $500 is the right gate because most tools will fall below this threshold. Adding a second approver for routine keys is the kind of process that makes the AI Studio feel slow and bureaucratic.
- **Karim + Corey** above $500 is the right gate because spend at that level is a real budget decision. Corey is the EVP and the budget-accountable person; Kenny is IT and not the right approver for spend questions.

**What "joint approval" means:** Karim and Corey both confirm in writing (Microsoft Teams message or email) that they understand the projected spend and accept the risk. The key is then issued by Karim. Corey doesn't need to touch the Anthropic Console.

---

## Real spend exceeds projection

Estimates are wrong sometimes. When real spend exceeds projection materially:

- **Below $500/month actual:** Karim notes it in the next monthly review (see below). No escalation unless the trajectory continues to climb.
- **Above $500/month actual when the tool was projected below $500:** Karim flags to Corey within a week. Together they decide: raise the projection (and the soft limit), throttle the tool, fix the underlying inefficiency, or shut it down.
- **Sustained spend above the original projection without explanation:** the same flag-to-Corey path. Material spend changes need acknowledgement.

**This is not a punitive process.** Tools sometimes scale faster than expected; that's a good problem. The point is to keep Corey informed, not to make Karim defensive about estimates.

---

## Where keys live (storage model)

Three layers, consistent with how Fitzrovia handles other secrets per `06-operations/development-setup.md`:

### Production

API keys for production tools live in **Vercel environment variables**, scoped to the specific project that uses them. Vercel encrypts environment variables at rest. The values are injected at build/runtime; they never appear in build logs (Vercel masks them automatically).

Naming convention: `ANTHROPIC_API_KEY`, `YARDI_API_KEY`, `OPENAI_API_KEY`, etc. — the tool's code reads from `process.env.<NAME>`.

### Local development

When a builder runs the tool locally, they need the key on their laptop. The pattern:

1. Each app folder has an `env.example` template listing what environment variables the tool needs, with placeholder values (no real secrets).
2. Builders copy `env.example` to `.env.local` (which is gitignored) and fill in real values.
3. **Real values come from the password vault** — Karim or Kenny gives the builder access.

`.env.local` is gitignored so it never reaches GitHub. Builders verify by running `git status` after creating it — the file should not appear.

### Canonical password vault

The single source of truth for what API keys exist, what they're for, and what their current values are. Used when:

- A new builder needs a key for local dev
- A key is rotated and Vercel/laptop copies need updating
- An audit asks "what API keys does the AI Studio have?"

The vault is Fitzrovia's existing shared secret store (Microsoft 365 secure store, 1Password Business, or whichever tool the company already uses for this — see `06-operations/development-setup.md`). Keys live there with these fields: name, provider, tool it belongs to, who issued it, when issued, current monthly cap, current monthly spend.

---

## What the builder ever sees

Building a tool that needs an API key:

1. The tool's `env.example` lists `ANTHROPIC_API_KEY=` with no value.
2. The builder asks Karim/Kenny for the key value (when ready to test locally with real API calls).
3. The builder copies `env.example` to `.env.local`, pastes in the key value, and runs the tool. **The value is on their laptop, in `.env.local`, gitignored.**
4. When the tool deploys to Vercel, Vercel injects its own copy of the key from environment variables — the builder doesn't manage production keys.

The builder never:
- Logs into the Anthropic Console
- Mints a new key
- Sees the production key value (it's in Vercel's dashboard, accessible only to Vercel team members with admin scope — Karim and Kenny)
- Commits a key to git, even by accident (gitignore + CodeRabbit pattern matching catches this)

---

## Soft monthly spend limits

Every key has a soft monthly spend limit set in the provider's console at issuance time.

- **Anthropic:** the per-key spend limit setting in the Anthropic Console. Hits limit → key returns errors until limit resets at month-end (or is manually raised).
- **Other providers:** equivalent setting where supported. Where not supported (some providers don't offer per-key limits), the limit is enforced via the org-level spend cap and noted in the configuration list as "soft limit at org level only."

The limit is set at **roughly 2x the projected monthly spend** at issuance. Reasoning: legitimate scaling can push spend above projection without being a runaway, but a true runaway will blow past 2x quickly.

When a tool legitimately scales past its limit, Karim raises the limit on conscious decision (per "Real spend exceeds projection" above). The limit is a circuit breaker, not a strict budget — but raising it is always deliberate, never automatic.

---

## Monthly review

Once a month, Karim opens the Anthropic Console (and other paid-API consoles) and reviews:

- **Spend per key.** Anomalies — keys spending much more than projected, or much less.
- **Approaching-limit keys.** Keys at >75% of monthly cap by mid-month.
- **Unused keys.** Keys with zero or near-zero usage for two consecutive months — candidates for revocation.

Five minutes of work. Findings get logged in the configuration list under the relevant tool's section.

If something looks anomalous (sudden spike, unusual pattern), Karim investigates that day, not at next monthly review.

---

## Rotation

API keys are rotated when:

- A builder leaves Fitzrovia (defensive rotation in case the key was on their laptop)
- A key is suspected compromised (any reason — leaked, screenshot, accidental commit)
- Anthropic or any other provider notifies of a security event affecting the key
- Annually as a baseline hygiene step (December rotation, set a calendar reminder)

The rotation process for one key:

1. Karim/Kenny mints a new key in the provider's console with the same name + a version suffix (e.g., `fitzrovia-leasing-pipeline-prod-v2`)
2. Update Vercel environment variable for that project to the new key value
3. Update password vault with the new value, mark the old value as "rotated [date]"
4. Notify the tool's builder so they update their local `.env.local`
5. Wait 24-48 hours to confirm the new key is in active use (check Anthropic Console for the new key's usage)
6. **Revoke the old key** in the provider's console
7. Log the rotation in the configuration list

The order matters: new key live → wait → old key revoked. Reversing this order causes downtime.

---

## What to do when a key leaks

If an API key is exposed (committed to a public repo, screenshotted in a chat, sent in plain email, found in a log shared externally) — treat it as an incident.

1. **Revoke the key immediately** in the provider's console. Karim or Kenny — whoever sees it first — does this directly. Do not wait for review.
2. **Mint a replacement** following the rotation process above.
3. **Trigger the incident response playbook** per `05-policies/incident-response.md`. Severity depends on the key (an Anthropic key with $500/mo limit is bounded; an unbounded financial-system key is a much bigger event).
4. **Investigate how it leaked** — log review, git history audit, Microsoft Teams search if it was shared internally. Document in the post-incident review.

The key is dead the moment it's revoked. The rest of the response is about understanding what happened and preventing recurrence.

---

## What this policy does NOT cover

- **Authentication tokens (SSO, Microsoft Entra)** — those are managed per `05-policies/access-control.md`, not here. This policy is about external paid APIs.
- **GitHub Personal Access Tokens** — covered in `06-operations/github-setup.md`. Same principles apply (tool-specific, vault-stored), but the cost dimension doesn't apply to GitHub.
- **Database credentials** — Supabase URLs and keys are managed per `06-operations/supabase-setup.md`. Cost is structural (Supabase plan), not metered per call.
- **Webhook secrets** — managed per individual tool's setup, not here.

---

## Related documents

- `06-operations/development-setup.md` — how `.env.local` works on builder laptops
- `06-operations/vercel-setup.md` — how Vercel handles environment variables
- `05-policies/incident-response.md` — what to do when a key leaks
- `05-policies/access-control.md` — broader access-management model
- `! handbook configuration list/handbook-configuration-list.md` — running list of which keys exist for which tools
