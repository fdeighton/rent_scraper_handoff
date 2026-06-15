# Claude Teams setup

**Path:** `06-operations/claude-teams-setup.md`

**Last updated:** May 5, 2026
**Owner:** Karim Mourad

---

## What this document is

A record of how the Fitzrovia Claude Teams workspace was configured at programme inception (May 1, 2026), seat allocations and the recent issuance to Corey on May 4, 2026, and the reasoning behind each setting. Useful for Kenny's review, useful for Corey's review (he now has a Standard seat as of May 4), and useful for future-Karim when something needs to change and the rationale isn't obvious.

This is not a step-by-step tutorial — Anthropic's own docs do that job. It's a decisions-and-state document.

---

## Why Claude Teams, and how it fits the platform

Claude Teams is the AI assistant layer for everything the AI Studio does. It is:

- **The primary work surface for Karim and the builder team** — research, synthesis, drafting policy, designing tools, reviewing code in plain English, running the document pipeline that produces this handbook itself
- **The skill execution surface** — custom Claude skills (like the "Fitzrovia Code Review Skill") let non-technical reviewers evaluate code changes via plain-English summaries rather than reading code directly. This is core to how the dual-approval mechanism in `04-standards/branching-and-prs.md` actually works
- **The bridge between strategy and execution** — Karim drafts, refines, and pressure-tests decisions in Claude before turning them into handbook documents, prompts for Claude Code, or instructions to builders

Why Claude Teams over alternatives: ChatGPT Enterprise is the existing comparator (Fitzrovia has 200 licences, renewal decision pending June 2026). Claude is the AI of choice for the AI Studio specifically because of stronger code review quality, better long-form reasoning for handbook work, and Claude Code as the primary builder agent. The June 2026 ChatGPT Enterprise renewal is the natural decision point for the broader company; for the AI Studio, Claude is already the working tool.

---

## Plan and billing

- **Plan**: Team — five seats minimum, mixed-tier
- **Seat tiers and pricing**:
  - **Premium**: CA$171.39/seat/month — includes Claude Code, the "build" tier
  - **Standard**: CA$34.27/seat/month — Claude AI assistant only, no Claude Code, the "use" tier
- **Seats allocated**: 5 (matches Finance meeting allocation). Original plan: 3 Premium + 2 Standard. Current actual breakdown after May 4 updates: 3 Premium + 1 Standard, 1 unfilled
- **Billing**: Monthly. Deliberate — no annual commitment while Fitzrovia evaluates Claude Teams vs ChatGPT Enterprise with Anthropic's GTM team for the June 2026 decision
- **First invoice (May 1)**: CA$658.46 paid via Visa ending 8456
- **Ongoing monthly**: CA$582.71 expected (per memory from earlier sessions). Invoice variance to watch — if June 1 invoice doesn't match this figure, investigate
- **Payment**: Fitzrovia corporate Visa ending 8456 (same card as the other four platforms)
- **Billing entity**: Fitzrovia Residential Inc.
- **Tax region**: Canada
- **Allowed email domains**: `fitzrovia.ca` only

**Why Team plan and not Enterprise**: Enterprise unlocks SAML SSO, audit logs, and per-tier features Anthropic ties to enterprise contracts. None of those are required at five seats, and Enterprise pricing is significantly higher. The June 2026 ChatGPT Enterprise renewal is the natural decision point for whether to upgrade Claude Teams to Enterprise scale; until then, Team plan with monthly billing preserves optionality.

**Why monthly billing instead of annual**: Annual would lock us into a tooling stack before the June 2026 ChatGPT Enterprise decision is made. Monthly billing is the deliberate choice that keeps the option open to consolidate on either platform without a stranded prepayment.

---

## Org-level configuration

### Identity

- **Workspace name**: `Fitzrovia Residential Inc.`
- **Allowed email domains**: `fitzrovia.ca` only
- **Domain verification**: pending. Required before SSO can be configured. Captured in the Kenny email — Kenny needs to add the DNS TXT record Anthropic provides to verify domain ownership
- **Standing organisation instructions**: `"Never include customer PII in responses"` — applies to every conversation in the workspace and takes priority over individual user profile instructions. Worth knowing this exists and tracking it so it doesn't drift unnoticed

### Identity and access — locked down

The default posture is "deliberate provisioning" — only Karim (Primary Owner) can add members, and adding requires a manual decision. No back-channels. Configured under `Settings → Identity and access`:

| Setting | Value | Why |
|---|---|---|
| **Domain discoverable** | OFF | `@fitzrovia.ca` users cannot find and request to join the workspace organically |
| **Invite link** | OFF | Prevents the "forwarded link in a Teams message ends up in the wild" failure mode. Joint Karim+Corey approval for Standard seats happens via the Add Member flow, not a back-channel link |
| **Member invites** | OFF | Only the Primary Owner can invite. Future Standard seat holders shouldn't be able to invite others without going through the joint approval flow |
| **User provisioning** | Invite only | Manual provisioning. Each seat assignment is a deliberate decision with a tier choice; JIT would bypass that |
| **Just-in-time (JIT) provisioning** | OFF | Auto-creating accounts on first SSO login is useful at scale; at five seats it's wrong. Revisit only if seat management becomes a bottleneck (unlikely until seat count exceeds ~25) |
| **New member approval** | Require admin approval (no longer visible because upstream paths are off) | Safety net if any other invite path exists or is added later |

**SSO via Microsoft Entra**: pending domain verification + Kenny's broader Entra rollout. Today, identity is managed via individual `@fitzrovia.ca` accounts.

### Data and privacy

Configured under `Settings → Data and privacy`:

| Setting | Value | Why |
|---|---|---|
| **Anthropic does not use Team-plan data for training** | Contractual default | Stated in Anthropic's Commercial Terms; no UI toggle to verify, but it's a contract guarantee |
| **Rate chats** | ON | Response feedback to Anthropic. No PII included; standard practice |
| **Share chats** (org-internal) | ON | Supports collaborative AI Studio work; chats stay within the org |
| **Share chats that use connectors** | ON | Recipients see Claude's responses, not the raw connector data, but responses can summarize sensitive content. Worth being aware of when first connector is added |
| **Location metadata** | **OFF** | Deliberate. Claude doesn't need user city/region for AI Studio work, and it's PII under Law 25/PIPEDA. The default ON would have leaked location to every prompt |
| **Public projects** | **OFF** | Deliberate. Projects default to private rather than org-wide visible. Matches `05-policies/access-control.md` "hidden by default" principle |

### Capabilities — kept open per "speed not bank" stance

Configured under `Settings → Capabilities`. The reasoning here is a deliberate philosophical stance worth flagging because it differs from the "lock everything down" posture of GitHub or Vercel:

> **Things with durable consequences** (privilege escalation, signed commits, MFA enforcement) get tight defaults.
> **Preview-feature toggles** (beta UI, web-based Claude Code, new data source integrations) do NOT get tight defaults.
>
> Why: experimental features have low-cost reversibility. Disabling them later is a single toggle. The cost of disabling them upfront is real friction for the builder team — every time someone wants to try a new Claude capability, they have to ask Karim to flip a toggle. That friction compounds.

| Setting | Value | Notes |
|---|---|---|
| Claude Design (Beta) | ON | Builders should have access to Anthropic's full toolkit including beta features |
| Web search | ON | Useful for builders researching libraries and documentation |
| Interactive content | ON | Maps, images, charts via third-party services |
| **Ask Fitzrovia** | ON, but **no connectors connected** | Effect is zero today. **Watchpoint**: re-evaluate scope at the moment a SharePoint or Drive connector is added — at that point, decide whether org-wide search is still desired or whether per-user scoping via Projects is preferable |
| Inline visualizations | ON | |
| Code execution and file creation | ON | Core to handbook document pipeline (Word/PDF builds run via Claude's code execution) |
| Allow network egress | ON, "Package managers only" | Claude can install npm/pip libraries but not reach arbitrary domains. Tightest sensible setting that doesn't break standard workflows |

### Claude Code — kept open per same stance

Configured under `Settings → Claude Code`:

| Setting | Value | Notes |
|---|---|---|
| Code in CLI | ON | Standard usage |
| Code in IDE | ON | VS Code extension is the primary builder surface |
| Code in the web (Preview) | ON | Cheap optionality; no concrete use case today, easy to disable later |
| Code in the desktop | ON | Joseph may prefer it over VS Code when he onboards; kept available |
| Allow bypass permissions mode | ON | Builder discretion; not enforced as forbidden |
| Allow auto permissions mode | ON | Builder discretion |
| Fast mode | OFF (default) | Revisit if speed becomes a constraint and budget allows |
| Remote Control (Research preview) | ON | Harmless if unused |
| Claude Code analytics | ON | Track accept rates, code generated |
| GitHub analytics (Beta) | ON, **GitHub not connected yet** | Connect when builders are doing real work in `fitzrovia-tools` and the analytics will have meaningful data |
| Allow channel notifications (Channels Preview) | ON | Harmless if no MCP servers configured |
| Code Review (Anthropic's PR review feature) | NOT configured | Deliberate — CodeRabbit is the chosen review tool per `06-operations/coderabbit-setup.md`. Don't run two AI reviewers in parallel without a clear reason |

---

## Members and seats

Current state as of May 4, 2026 evening:

| Member | Role | Seat | Status | Notes |
|---|---|---|---|---|
| Karim Mourad (`kmourad@fitzrovia.ca`) | Primary Owner | Premium | Active | Workspace creator, primary admin |
| Joseph Agozzino (`jagozzino@fitzrovia.ca`) | User | Premium | Pending acceptance | Invited but not yet accepted; will activate when he onboards |
| Kenny Marcano (`kmarcano@fitzrovia.ca`) | User | Premium | Pending acceptance | Premium because the original plan put him on Premium; revisit when Kenny's actual usage pattern is known. He may not need Premium if he doesn't push code |
| Corey Pacht (`cpacht@fitzrovia.ca`) | User | **Standard** | Pending acceptance | Issued May 4. Tier corrected from earlier plan (which had him at Premium). Standard is correct per the tier model — Corey is a non-builder using Claude as an AI assistant, not pushing code. Premium for Corey would have been a courtesy seat that didn't match the criteria and would have set a precedent ("Corey has Premium, why don't I?") |

**5 seats allocated, 4 used, 1 available.** The unfilled slot may be returned (cost saving) or held for the next non-builder approved by Karim+Corey.

### Seat allocation policy

Anchored in `00-foundations/roadmap-v20.md`:

- **Premium seats** are for code-pushers — builders who use Claude Code via CLI/IDE
- **Standard seats** are for non-builder staff using Claude as an AI assistant
- **Joint approval requirement**: Standard seat issuance requires Karim AND Corey approval. The flow: a request comes in (e.g., from Parker Hertz in Finance), Karim and Corey discuss, both approve, Karim adds the member
- **Tracking threshold**: when total Standard seats exceeds 10, Karim brings a broader proposal to Corey for company-wide expansion. **Current count: 1** (Corey himself). Below threshold

### Seat issuance log

| Date | Seat | Recipient | Approved by | Notes |
|---|---|---|---|---|
| May 1, 2026 | Premium | Karim Mourad | Self (Primary Owner) | Workspace setup |
| May 1, 2026 | Premium (invite) | Joseph Agozzino | Karim | Pending acceptance |
| May 1, 2026 | Premium (invite) | Kenny Marcano | Karim | Pending acceptance |
| May 4, 2026 | Standard (invite) | Corey Pacht | Karim + Corey (joint, with Corey being the recipient) | First Standard seat. See `! handbook configuration list/handbook-configuration-list.md` for the tier-correction rationale |

---

## What's NOT enabled (deliberately)

- **SAML SSO via Microsoft Entra**: pending domain verification (Kenny's task) + Kenny's broader Entra rollout. Today, identity is `@fitzrovia.ca` accounts with personal Claude.ai 2FA
- **Anthropic Code Review**: CodeRabbit is the chosen review tool. Don't run two AI reviewers in parallel
- **Managed `settings.json`**: premature without builder usage data. Once Joseph onboards and we see actual Claude Code usage patterns, revisit whether org-wide settings management is needed
- **Custom skills beyond "Fitzrovia Code Review Skill"**: post-foundation. The Code Review Skill is the only one that earns its keep today; new skills get drafted when there's a real workflow they enable
- **GitHub analytics integration in Claude Code**: toggle is ON but GitHub not connected yet. Connect when builders are doing real work in `fitzrovia-tools` and the analytics will produce meaningful signal
- **Connectors (SharePoint, Drive, Notion, etc.)**: none connected today. Specific watchpoint flagged in Capabilities table — when a connector is added, "Ask Fitzrovia" goes from no-op to potentially material, and the org-wide search scope decision becomes real

---

## Watchlist (consolidated)

Things deliberately left at default or deferred today that may want adjustment as the studio matures:

1. **June 2026 ChatGPT Enterprise renewal decision**: this is the major upcoming decision point. Outcome determines whether Fitzrovia consolidates on Claude Teams (and likely upgrades to Enterprise) or stays multi-platform. Engagement with Anthropic's GTM team is ongoing
2. **Kenny's Premium seat**: revisit tier when his actual usage pattern is known. Currently Premium pending acceptance; may downgrade to Standard if he doesn't push code (he's IT, not a builder)
3. **Seat counter (Standard)**: when count exceeds 10, broader proposal to Corey. Currently 1
4. **Ask Fitzrovia connector watchpoint**: re-evaluate scope at the moment a SharePoint or Drive connector is added
5. **Domain verification + SSO**: pending Kenny's DNS work. Until verified, identity story is individual accounts with 2FA
6. **Annual billing**: only revisit after the June 2026 decision settles. If Claude Teams wins the renewal comparison, annual billing might make sense to lock in pricing
7. **GitHub analytics in Claude Code**: connect when there's real builder work in `fitzrovia-tools` to analyze
8. **Standing organisation instruction (`"Never include customer PII in responses"`)**: review periodically; add new instructions deliberately, not casually
