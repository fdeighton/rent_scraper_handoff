# AI Infrastructure Architecture Plan

**Path in handbook:** `00-foundations/roadmap-v20.md`

**Last updated:** April 28, 2026
**Owner:** Karim Mourad — Director, Operations & AI Strategy
**Document classification:** Internal · Confidential

> **Note on this version.** v20 reconciles the roadmap with two decisions made during handbook construction: (1) the consolidation onto `hub.fitzrovia.ca` (Operating Principle 9), removing the separate `build.fitzrovia.ca` subdomain, and (2) the layered review model captured in the glossary v1.1.0, which replaces the single "Fitzrovia Code Review Skill" with `/review` and `/security-review` (Anthropic built-ins) plus the pre-PR checklist plus the `approver-review` skill. No strategic content changes; terminology and references aligned across sections.

---

## Executive Summary

### The situation in plain English

Fitzrovia team members have begun building internal software tools using AI — creating real operational value. Today, all of that work lives on personal accounts and personal credit cards. This document proposes moving to a proper company-owned setup that is secure, auditable, and built to grow.

| Metric | Value |
|---|---|
| Active builders | 5 |
| Estimated monthly cost for the full platform | CA$1,130 |
| Time to fully migrate to company-owned infrastructure | 4 weeks |

---

## 01 — The Current Situation

Over the past several months, employees across Fitzrovia, with varying levels of AI and coding experience, have begun building internal tools using AI. From staff portals to workflow dashboards, what started as personal experiments has grown into something more significant: real tools that real Fitzrovia employees are beginning to use.

The problem is that the infrastructure underneath these tools was never designed for a company.

### What is wrong today

- Tools built on personal accounts and personal credit cards
- Company code and data lives on personal platforms
- If someone leaves, Fitzrovia loses access to their tools
- No central control over who can see or change what
- No audit trail of what changed, when, or why
- Real company data uploaded to free, uncontrolled platforms
- Sensitive company data potentially used to train third-party AI models
- No visibility into where company data goes once it enters a personal AI account
- Costs scattered with no central invoice

### What this plan fixes

- All tools and code owned by Fitzrovia — not individuals
- Company data on Canadian servers with enterprise privacy
- Central admin — Karim and Kenny control all access
- No tool goes live without Karim or Kenny's approval
- Full audit trail of every change to every tool
- One monthly invoice to Fitzrovia's corporate card
- Scales cleanly from 5 to 150+ people
- Claude Teams Premium guarantees Fitzrovia's data is never used to train AI — contractually enforced

> **The core risk today.** If any employee building tools on personal accounts left Fitzrovia tomorrow, the tools they built — and the company data inside them — would remain on their personal accounts. Fitzrovia would have no legal or technical right to those assets. This plan eliminates that risk entirely by ensuring all tools and data live on company-owned infrastructure from day one.

---

## 02 — What Are We Actually Building?

Fitzrovia is proposing to establish a small, dedicated team of AI builders — referred to internally as the **Builder Team** or **Fitzrovia AI Studio** — to design and build bespoke internal software tools using AI as a coding assistant. Rather than letting everyone in the company build independently, this team acts as an internal product studio: any employee with a problem or idea brings it to the studio, and the builders work hand-in-hand with them to turn it into a real tool.

> **Think of it this way.** In the past, building a custom internal tool required hiring a development agency for $50,000–$200,000 and waiting 6–12 months. The Fitzrovia AI Studio does the same thing — but faster, cheaper, and with builders who already know the business. Any employee can still experiment freely in ChatGPT Codex on their own. But when an idea is ready to become a real tool, it comes to the studio.

> **Why centralised building over distributed building.** Letting everyone vibe code creates fragmentation — tools that look different, store data inconsistently, have no documentation, and break when the person who built them is away. The Builder Team ensures every tool that ships meets Fitzrovia's quality bar: consistent UI/UX, proper data handling, and someone accountable for it after launch. **Quality and consistency over volume.**

### How it works

- Any Fitzrovia employee can submit a problem or tool idea through the intake system — in any format, no technical knowledge required
- The Builder Team reviews submissions and scores them by urgency and business impact. Karim sets the initial priority and reviews the queue periodically with Corey — Corey has final override authority on prioritisation
- Accepted requests are queued in Linear and built collaboratively — the submitter stays involved throughout with weekly check-ins and feedback loops
- Anyone can still experiment freely in ChatGPT Codex — no restrictions, no sign-off needed. The intake process applies only when a tool needs to become real, persistent, and company-accessible
- Requests that aren't feasible are declined with an explanation. Requests that are good ideas but lower priority are parked and revisited when capacity allows

---

## 03 — Four Platforms, One Coherent System

The proposed infrastructure uses four platforms that work together. Each plays a specific role.

### 1. GitHub — Where code is stored and controlled

GitHub is a secure storage system for code. Every tool Fitzrovia builds lives here, with a complete history of every change — who made it, when, and what changed. Nothing can be modified without being tracked.

> Think of it as a version-controlled Google Drive for code — every edit is logged and requires approval before going live.

### 2. Vercel — Where tools are published and hosted

Vercel takes code from GitHub and makes it into a live tool staff can access via a web browser. When approved and published, it is hosted on the internal tools portal — for example, `hub.fitzrovia.ca/staff-portal`.

> Think of it as the publishing platform — like pressing Publish on a blog post, but for custom internal tools.

### 3. Supabase — Where company data is stored securely

Supabase is the secure database where all data lives — maintenance records, building stats, leasing data, user accounts. Hosted in Canada (Toronto data centre) with enterprise-grade access controls. All tools share one database with strict separation between data sets.

> Think of it as a secure filing cabinet in a Canadian data centre — only authorised people can open the right drawers.

### 4. Claude & Codex — AI Tools

Fitzrovia operates a **two-tier Claude model**. Claude Teams seats are available to two distinct groups with very different access levels. ChatGPT Codex (via the existing ChatGPT Enterprise licence) continues to run in parallel until a full migration decision is made in June 2026.

**Tier 1 — Builder seats (5).** Claude Teams Premium with Claude Code access. Used by Karim, Joseph, Builder 4, Builder 5, and Kenny to build tools. GitHub write access, Vercel deployment, Supabase admin. CA$171.39/seat/mo.

**Tier 2 — Standard staff seats (incremental).** Claude Teams access for any Fitzrovia employee — drafting, analysis, research, and personal AI experimentation including coding. Staff can experiment and build informally, but any tool intended for company-wide use must go through the Builder Team. No GitHub access, no Vercel seat, no path to production. CA$34.27/seat/mo (monthly billing) — added incrementally as requests are approved by Corey and Karim.

**ChatGPT Enterprise / Codex — expires June 2026.** Running in parallel until June 2026. At that point a decision will be made: renew and maintain a hybrid model, or migrate fully to Claude and consolidate to one platform.

> **Claude Teams vs Enterprise — currently under evaluation.** Fitzrovia is actively evaluating both Claude Teams and Claude Enterprise with Anthropic's GTM team. This document uses Teams pricing for simplicity and predictability — Teams is a fixed per-seat cost. Claude Enterprise is consumption-based, meaning pricing depends on actual usage volume, making direct comparison harder at this stage. The right tier will be confirmed once the Anthropic evaluation is complete. All pricing in this document should be treated as directional until that decision is made.

> **Claude and ChatGPT Enterprise — running in parallel until June 2026.** Fitzrovia currently holds a ChatGPT Enterprise licence (which includes Codex) expiring June 2026. Both platforms will run in parallel until then — builders use Claude for tool development, and existing ChatGPT Enterprise users continue as normal. Before June 2026, Fitzrovia will make a formal decision on whether to renew ChatGPT Enterprise or migrate fully to Claude. The growing appetite for Claude across the organisation — with staff actively requesting access — is a meaningful signal. That decision sits with Corey, informed by usage data from both platforms.

### How a tool goes from idea to live

1. **Employee submits idea** — Via intake portal
2. **Builder writes code** — Claude or Codex on laptop
3. **Saved to GitHub** — Private branch only
4. **Approval gate** — Karim or Kenny reviews
5. **Merged to main** — Into official codebase
6. **Live on hub.fitzrovia.ca** — Auto-published by Vercel

> **What is "main"?** Main is the official, live version of a tool's code — the master copy. Builders work on their own private copy (called a branch) and only when Karim or Kenny approves their changes does it get merged into main, which triggers Vercel to automatically publish the updated tool. No one can bypass this gate — it is technically enforced, not policy-based.

### Technical detail

- **Internal tools portal:** Tools are published to `hub.fitzrovia.ca` — a separate, SSO-protected internal subdomain, strictly for Fitzrovia staff only. No external parties — including vendors, partners, tenants, or investors — can access or use these tools under any circumstances. All tools are for internal operational use only.
- **GitHub Teams:** `fitzrovia-residential` org. Branch protection on `main`: 1 required approving review from Owners, stale review dismissal, no bypass for admins.
- **Vercel Pro:** Fitzrovia team. Karim + Kenny as Owners only. Joseph and builders have no Vercel seat — localhost and PR preview only.
- **Supabase Pro:** Single org, single project (shared by all tools), Canada Central region. **What "1 project" means:** a Supabase project is one PostgreSQL database with everything around it (auth, storage, APIs). All Fitzrovia tools share this one project — they are separated by database schemas (e.g. `rent_comps`, `staff_portal`, `maintenance`) and Row Level Security policies. This is significantly cheaper and easier to manage than running a separate project per tool. Daily backups, point-in-time recovery, no project pausing.
- **Claude Teams Premium:** SSO + domain capture enforces `@fitzrovia.ca` logins. No model training on company data. 200K context window. 5× usage vs standard. CA$171.39/seat/mo (monthly billing). Assigned to select power builders.
- **Claude Teams — standard seats:** Non-builder staff approved for Claude access receive a standard seat (CA$34.27/mo, monthly billing). Same SSO via @fitzrovia.ca. Access to Claude as an AI assistant for drafting, research, analysis, and personal experimentation. No builder permissions — no GitHub, no Vercel, no production access.
- **ChatGPT Enterprise / Codex:** Existing licence. Codex is OpenAI's AI coding agent — equivalent to Claude Code in capability. Available to all ChatGPT Enterprise users. Expires June 2026 — renewal decision pending. In the hybrid model, broader builders use Codex; in a full Claude migration, this licence would not be renewed.

---

## 04 — The Builder Team — Who Is Who

The **Fitzrovia AI Studio** (internally: the Builder Team) is a small, dedicated group responsible for all tool development. Every person in the studio has a defined role with specific technical permissions enforced by the platform. All other Fitzrovia employees interact with the studio as **requesters** — submitting ideas through the intake system, collaborating during the build, and owning the tool after launch.

### Org structure

**Studio Lead & Org Owner:** Karim Mourad — Director, Operations & AI Strategy
**IT Lead & Org Owner:** Kenny — Head of IT

**Senior Builder:** Joseph
**Builders 4 & 5:** TBD

**Requesters (all other Fitzrovia employees):** Construction · Development · Asset Management · Property Management · HR · Accounting & Finance

**Staff with a Claude Teams seat (not builders):** Any staff member — AI assistant access only

### Role legend

- **Studio / IT Lead** — full control, billing, publishing, queue oversight
- **Senior Builder** — builds, reviews code, optional approver
- **Builder** — assigned tools only, no publishing
- **Requester** — submits ideas, collaborates, owns tool post-launch
- **Claude User** — AI assistant access, no builder permissions

> **Expanding Claude access — the seat request process.** Any Fitzrovia staff member can request a Claude Teams seat. Requests go to Karim, who approves individual requests and tracks total seat count. If non-builder seats exceed 10, Karim brings a broader access proposal to Corey — at which point a full migration from ChatGPT Enterprise to Claude may be the cleaner solution. Regular Claude seats give staff access to Claude as an AI assistant for drafting, analysis, and research. They carry no builder permissions — no GitHub access, no Vercel seat, no path to production.

### What each role can and cannot do

| Action | Karim | Kenny | Joseph | Builders 4–5 | Claude Users | Requesters (no Claude seat) |
|---|---|---|---|---|---|---|
| Submit a tool request | ✓ via intake form | ✓ via intake form | ✓ via intake form | ✓ via intake form | ✓ via intake form | — |
| Experiment freely in Codex or Claude | ✓ Yes | ✓ Yes | ✓ Yes | ✓ Yes | ✓ Yes | ✓ Yes — no restrictions |
| Write and edit code | ✓ All tools | ✓ All tools | ✓ Assigned tools | Own tool only | Codex only — not on official system | — |
| Approve a pull request | ✓ Required approver | ✓ Required approver | Optional only | ✗ No | ✗ No | — |
| Publish to hub.fitzrovia.ca | ✓ Auto on approval | ✓ Auto on approval | ✗ Blocked | ✗ Blocked | ✗ Blocked | — |
| Manage intake queue priority | ✓ Final authority | ✓ Yes | Input only | ✗ No | ✗ No | — |
| Manage billing | ✓ Yes | ✓ Yes | ✗ No | ✗ No | ✗ No | — |

> **Regular Claude Teams seats — not the same as being a builder.** Any Fitzrovia employee can request a Claude Teams seat to use Claude as a general AI assistant — drafting documents, summarising reports, answering questions, doing research. This is entirely separate from the Builder Team role. A regular seat holder gets Claude access via their @fitzrovia.ca login. They do not get GitHub write access, a Vercel seat, or any path to publishing tools. They are users of AI, not builders of tools. Requests are approved jointly by Corey and Karim. This process remains in place until the June 2026 ChatGPT Enterprise renewal decision is made, at which point a broader Claude seat rollout strategy will be determined.

> **Universal admin access — Karim and Kenny by design.** Karim and Kenny have admin access to every tool built on Fitzrovia infrastructure — automatically, by design, not tool by tool. This mirrors the rest of the architecture: they are already the Org Owners at the GitHub, Vercel, and Supabase layers, so extending that to tool-level admin rights creates a single, consistent governance layer. When a user needs access added or removed — new hire, department change, someone leaves — the request comes to Karim or Kenny via Microsoft Teams or the intake portal, and they make the change.
>
> **Tool owners vs admins — two different roles.** The person who requested the tool is the "tool owner" for business accountability — they handle UAT, stakeholder communication, and are responsible for whether the tool meets the original need. They are not the technical admin. This separation prevents fragmented admin rights across dozens of tools and makes offboarding clean — admin access is always with Karim and Kenny, always transferable, always visible.

---

## 05 — From Idea to Live Tool — The Full Journey

This is the complete workflow — from an employee identifying a problem, through the intake and build process, to a live tool on hub.fitzrovia.ca. Steps 1–3 are the new intake layer. Steps 4–12 are the technical build and approval pipeline.

### Step 1 — Problem identified
**Actor:** Employee.
Any Fitzrovia employee identifies a workflow problem, a data gap, or an opportunity where a custom tool would help. No technical knowledge required. They can experiment in Codex freely, or in Claude Teams if they have a standard seat, before submitting — no restrictions on personal experimentation.

### Step 2 — Submitted via intake portal
**Actor:** Employee.
Employee submits their idea through the AI Studio intake portal at `hub.fitzrovia.ca/intake` in any format — no template required. They receive an automatic confirmation with a ticket number and can track status at any time. A weekly digest email keeps all active submitters informed of progress.

### Step 3 — Review and prioritisation
**Actor:** Karim.
The Builder Team reviews the submission. Priority is scored by urgency, business impact, and users affected. Karim sets the initial priority and reviews the queue periodically with Corey. Corey has final override authority on prioritisation. Accepted requests enter the Linear build queue. Lower-priority requests are parked. Infeasible requests are declined with an explanation.

### Step 4 — Build begins, collaborative
**Actor:** Builder.
An assigned builder picks up the ticket from the Linear queue. The original submitter stays involved throughout — weekly check-ins and feedback loops. The builder uses Claude or Codex to write code on their laptop.

### Step 5 — Vibe coding with Claude or Codex
**Actor:** Claude / Codex.
Builder uses Claude Teams Premium or ChatGPT Codex to write code, ask questions, and debug. All on their laptop. Conversations stay on Fitzrovia company accounts — not personal.

### Step 6 — Code saved to private branch
**Actor:** GitHub.
Each tool has one shared repository in the Fitzrovia GitHub org. Inside that repo, the builder works on a private branch — their own working draft. Think of it like a shared Google Doc where each person can edit their own draft until ready to merge into the live version. Multiple builders can work on different features in the same tool simultaneously, each on their own branch. They test the code on their laptop (localhost) before submitting it for review.

### Step 7 — Pull Request submitted
**Actor:** GitHub.
Builder submits changes for review — a Pull Request (PR). Think of it as a tracked change request in Word. Shows exactly what was added, removed, or changed.

### Step 8 — Automated AI code review (optional)
**Actor:** CodeRabbit.
CodeRabbit automatically scans the PR and leaves comments — catching bugs, security issues, and quality problems before any human looks at the code.

### Step 9 — Joseph reviews (optional)
**Actor:** Joseph.
Joseph reviews the PR on GitHub — not by reading code directly, but by reading CodeRabbit's plain-English findings and, where useful, running the Fitzrovia `approver-review` skill in Claude.ai (paste PR diff and ticket → Claude returns a plain-English go/no-go report). Joseph clicks the Vercel preview link to test the tool in his browser. He leaves comments if anything looks wrong. His approval is optional and does not block the process.

### Step 10 — Required approval gate — Karim
**Actor:** Karim / Kenny.
Karim is the day-to-day approver for individual tools. He does not read code directly. The builder will already have run `/review` and `/security-review` in Claude Code and walked through the pre-PR checklist before opening the PR — Karim verifies this evidence rather than re-running it. He then reviews: (1) CodeRabbit's plain-English PR summary, (2) the Fitzrovia `approver-review` skill output from Claude.ai (a plain-English go/no-go report), (3) the Vercel preview link — testing the tool in his browser, (4) confirmation from the requester via Microsoft Teams that it works, (5) the Tier 2 checklist in Section 10. Kenny is consulted for tools involving sensitive or complex data. The platform physically prevents merging without an Org Owner approval.

### Step 11 — Merged to main
**Actor:** GitHub.
Karim or Kenny clicks Merge. The approved code joins the official Fitzrovia codebase. Every change is permanently recorded — who approved it and when.

### Step 12 — Live on hub.fitzrovia.ca within ~60 seconds
**Actor:** Vercel.
Vercel detects the merge and automatically publishes the tool. The original submitter is notified via Microsoft Teams. Post-launch, they own the content and data; the Builder Team owns the technical infrastructure.

### The CI/CD pipeline — automated quality checks before every deployment

**What CI/CD is:** Continuous Integration / Continuous Deployment — automated quality checks that run every time a builder submits code, before anything reaches a human reviewer. Think of it as an assembly line for code.

**What happens automatically on every PR:** (1) CodeRabbit scans for bugs, security issues, and hardcoded credentials. (2) Dependabot checks for outdated or vulnerable libraries. (3) Build check — does the code compile without errors? If not, the PR is automatically blocked. (4) Vercel creates a preview URL showing exactly what the tool will look like live.

**Only if all checks pass** does the PR reach Karim for human review. He reads CodeRabbit's summary, runs the Fitzrovia `approver-review` skill in Claude.ai, clicks the preview link to test the tool, and approves.

**Staging and production:** Vercel's preview URL serves as a staging environment — a safe place to test with real data before promoting to production. Once Karim approves and merges, Vercel deploys to production automatically within ~60 seconds. Rollback to any previous version is available at any time with one click.

### When something breaks — the fix workflow

**How issues are reported:** Staff report broken tools via the AI Studio intake portal ("Report a Bug" option) or by messaging the Builder Team directly on Microsoft Teams. Every bug report automatically creates a Linear ticket tagged with the tool name, reporter, date, and description — no manual logging required.

**Immediate response:** If the tool is broken, Karim or the assigned builder rolls back to the last working version instantly via Vercel — one click, live within 60 seconds. The fix happens in the background while users work on the previous version.

**Diagnosing the issue:** The builder checks Vercel logs for the technical error, pastes it into Claude Teams and asks "what does this error mean and how do I fix it?" Claude translates the error into plain English and suggests a fix. Neither Karim nor Joseph needs to read raw logs directly.

**The fix:** Builder implements the fix using Claude Code, runs `/review` and `/security-review`, walks the pre-PR checklist, submits a new PR → standard approval gate → Vercel auto-deploys. The Linear ticket is updated and closed. A complete log of every issue and resolution is maintained automatically in Linear.

---

## 06 — CodeRabbit and Linear

**Linear** is the backbone of the Fitzrovia AI Studio queue. Every intake submission becomes a Linear ticket. Builders manage their workload in Linear, Karim sees the full pipeline with priority scores, and GitHub PRs auto-update tickets when code is merged. The intake form at `hub.fitzrovia.ca/intake` connects directly to Linear via API.

**Free tier limits explained:** Linear's free plan supports unlimited members, up to 2 teams (groupings of users with their own projects — Fitzrovia needs only 1 team called "AI Studio," well within the limit), and up to 250 active issues at a time. Closed and completed tickets do not count toward the cap. Sufficient for the first year. If exceeded, the Standard tier is ~CA$12/user/month.

**CodeRabbit** is a core part of the infrastructure — not optional. Because Karim and Joseph are not technical and cannot read code directly, CodeRabbit is the automated safety net that catches security issues, hardcoded credentials, and bugs before any human review happens. It posts plain-English findings directly in GitHub on every PR. For a non-technical builder team, this is essential from day one. Cost: ~CA$26/builder/mo.

---

## 07 — How Company Data Is Protected

- **Canadian servers only.** All Fitzrovia data is stored in Supabase's Canada Central region — a Toronto data centre. Data does not leave Canada.
- **Encrypted at rest and in transit — automatic, no action required.** Supabase encrypts all stored data using AES-256 (the same standard used by banks) automatically at the database level. All connections between Vercel, Supabase, GitHub, and staff browsers use HTTPS/TLS encryption. Fitzrovia does not manage encryption keys or configure anything — this is handled entirely by the platforms.
- **Not used to train AI models.** On Claude Teams Premium, Fitzrovia's conversations and data are never used to train AI. Guaranteed contractually.
- **Access controlled at the database level.** Each team can only see their own data — enforced by the database, not by asking people to behave.
- **Internal use only.** All tools built on this infrastructure are strictly for Fitzrovia staff. No external parties — vendors, partners, tenants, or investors — have access to any tool under any circumstances. These are operational tools, not products.

> **Vercel data residency — action required before launch.** Supabase is confirmed in Canada Central. Vercel — where tools are deployed and served — operates a global edge network by default. Before any tool handling real Fitzrovia data goes live, Kenny must explicitly configure Vercel to restrict server-side function execution to Canadian regions. This is a one-time technical step and must be verified before the Canada residency commitment is communicated to staff or leadership.

### If someone leaves today (without this plan)
- Their personal account still has the code
- Their personal account still has the data
- Fitzrovia cannot force a password change
- No easy way to revoke access instantly

### With this plan
- Karim or Kenny removes them in one click
- All access revoked immediately across all platforms
- Code stays in Fitzrovia's GitHub — it never moves
- Their @fitzrovia.ca Claude account deactivated via SSO

> **The golden rule.** Real company data — property records, financial data, operational data, anything from Yardi — may only ever be stored in Fitzrovia's paid, org-owned Supabase project. Never on personal accounts. Never on free platforms. This is enforced structurally, not by policy.

### Per-tool access control

Beyond platform-level access (who gets a GitHub or Vercel seat), each tool has its own access controls determining **who can open it** and **what they can do inside it**. Three mechanisms, chosen per tool at design time:

- **Vercel access groups — who can open the tool at all.** When a tool is deployed, the builder specifies which @fitzrovia.ca users or Microsoft 365 groups can access the URL. Users outside that list cannot reach the tool. Used for tools restricted to named individuals (e.g. Parker, CFO, Corey for compensation tools) or specific departments.
- **Microsoft 365 group integration — departmental access at scale.** For tools that serve entire departments (Finance, Leasing, HR), the tool checks group membership on login rather than maintaining individual user lists. Add or remove someone from the Finance M365 group and their access to Finance tools updates automatically.
- **Supabase Row Level Security — per-user data visibility inside the tool.** When a tool has broader access but different users should see different data, RLS enforces this at the database level. Example: a leasing dashboard where each agent sees only their own pipeline, while managers see the whole team.

For each tool, the builder decides at design time: is this (a) open to all Fitzrovia staff, (b) restricted to a department via M365 group, or (c) restricted to named individuals. That decision is documented in the Linear ticket and the tool's README.

### Admin permissions within a tool

Access control answers "can this person open the tool?" Admin permissions answer "once inside, what can they do?" Many tools will have three roles:

- **Admin** — can see everything, edit everything, manage other users' permissions, export data. **Karim and Kenny hold admin access across every tool by design** — this is built into every tool as a standard pattern, not configured per tool. This mirrors the Org Owner role at the platform layer and keeps admin governance consistent and transferable.
- **Editor** — can create, edit, and submit entries but cannot manage permissions or delete. Typical for day-to-day users of the tool.
- **Viewer** — can see the data but cannot make changes. Typical for leadership or auditors who need visibility without involvement.

Permission changes (promoting someone to editor, adding a new viewer) are requested via Microsoft Teams or the intake portal, and actioned by Karim or Kenny. Every permission change is logged in the tool's activity log for audit purposes.

### Tool behaviour audit trail

GitHub captures a full audit trail of every *code change* — who changed what, when, and why. A separate audit trail captures *tool behaviour* — what users actually do inside each tool. This matters for evaluating whether tools and any AI agents within them are behaving as intended.

Every tool handling sensitive data or making decisions writes to a dedicated Supabase table (`tool_activity_log`) on each meaningful action. Each log entry captures: the user (@fitzrovia.ca email), the timestamp, which tool, the action (e.g. "ran rent comp search," "exported report," "updated tenant record"), the input (the search query or record ID), and an output summary (not the full data, just enough to know what happened).

Karim and Kenny can query this log at any time — "what has Parker done in the compensation tool this week?" or "who exported tenant data from the leasing dashboard?" — and it supports regulatory requirements under Law 25 and PIPEDA for data access audit trails.

For non-sensitive tools (a dashboard that just displays data), logging is optional. For anything touching personal data, financial records, or making decisions, it is required and confirmed at the Tier 2 checklist.

### Dependency monitoring

Every tool built on the official infrastructure includes third-party code libraries that may develop security vulnerabilities over time. GitHub Dependabot — free and already included in the GitHub Teams plan — will be enabled on all repositories. It automatically scans for known vulnerabilities and opens a pull request to patch them, which then goes through the standard approval gate. No manual monitoring is required.

### Incident escalation

If a tool fails, behaves unexpectedly, or a data exposure is suspected:

| Step | Owner | Action |
|---|---|---|
| 1 | Builder | Stops the affected tool immediately (Vercel allows instant rollback), documents what happened, notifies Karim |
| 2 | Karim + Kenny | Assess scope and remediate. Determine whether personal data was involved and whether statutory notification obligations are triggered (PIPEDA / Law 25) |
| 3 | Corey | Notified if data exposure is confirmed or operations are affected. Responsible for any external communication and regulatory notification via Legal |

### Quebec Law 25 and PIPEDA — compliance obligations

Fitzrovia operates in Quebec. Quebec's Law 25 (Act to modernize legislative provisions as regards the protection of personal information) is actively enforced and applies to every tool that handles personal information — tenant records, employee data, or any data that can identify an individual. PIPEDA applies federally across all other provinces. The following obligations are not optional.

**Privacy Impact Assessment.** Required before any new system handling personal data goes live — mandatory, not optional. A lightweight one-to-two page PIA template will be completed per tool by the builder and reviewed by Legal before launch.

**Named Privacy Officer.** Law 25 requires a named Privacy Officer to be designated and published. This is a corporate obligation that exists regardless of this plan. Fitzrovia must confirm who holds this role or designate one. **Action: Legal to confirm or designate before sandbox exits to production.**

**Breach notification.** If a breach involves personal data, the CAI must be notified within 72 hours. Affected individuals must be notified without undue delay. See incident escalation above — Legal leads Step 3.

**Right to deletion and portability.** Any tool storing personal data must include a documented process for deleting a specific individual's records and exporting them on request. Supabase makes this technically straightforward. This is a design standard, confirmed per tool by the builder and Kenny before launch.

**Automated decision-making.** Any tool that makes automated decisions affecting individuals must disclose this and provide the right to human review. None of the tools currently planned do this. This is flagged as a design principle: if a future tool introduces automated decision-making affecting individuals, Legal must be consulted before launch.

---

## 08 — Cost Summary

All costs in Canadian dollars. Claude Teams pricing shown at monthly billing rates — no annual commitment while Fitzrovia evaluates Teams vs Enterprise with Anthropic's GTM team. Other platforms billed in USD, converted at CA$1.37 (April 2026, current rate ~1.37).

### Core platform costs

| Platform | What it does | Plan | Per user/unit | Monthly total |
|---|---|---|---|---|
| **Claude Teams Premium** ✓ verified | AI assistant — 5 builders, central billing, privacy guarantee | 5 seats · monthly | CA$171.39/seat | CA$857 |
| **GitHub Teams** | Code storage, version control, approval workflow | 5 users | CA$5.50/user | CA$28 |
| **Vercel Pro** | Tool hosting and publishing | 2 seats — Karim + Kenny only | CA$27/seat | CA$54 |
| **Supabase Pro** | Secure Canadian data storage shared by all tools | 1 project (shared by all tools), Canada Central | CA$34/project | CA$34 |
| **1Password Teams** | Shared credential vault for the team | Flat rate | CA$27 flat | CA$27 |
| **Codex / ChatGPT Enterprise** | AI coding tool — all ChatGPT Enterprise users | Already paid · expires June 2026 | included | CA$0 additional |
| **CodeRabbit Pro** core | Automated AI code review on all pull requests — essential for non-technical builders | 5 builders · from Week 1 | CA$26/builder | +CA$130 |
| **Linear** | Task and project management for builders | Free tier — sufficient today | free | CA$0 |
| **Additional Claude Teams seats** | Claude AI assistant for any staff member — drafting, analysis, research. No builder permissions. | On request · approved by Karim | CA$171.39/seat | demand-driven |
| **Core monthly total** (without CodeRabbit) | Excl. ChatGPT Enterprise (already paid) · excl. tax · GitHub/Vercel/Supabase billed in USD · excl. incremental Claude seats | | CA$226/person avg across 5 builders | **CA$1,130** |

### Incremental — regular Claude Teams seats for broader staff

| Scenario | What it covers | Plan | Per user/unit | Illustrative monthly |
|---|---|---|---|---|
| 10 additional staff seats | Standard Claude access for staff — drafting, research, analysis, personal experimentation | 10 seats · monthly billing | CA$34.27/seat | +CA$343 |
| 20 additional staff seats | Broader departmental rollout | 20 seats · monthly billing | CA$34.27/seat | +CA$685 |
| Full company (est. 200 total) | All staff on standard Claude — Fitzrovia currently has ~200 ChatGPT Enterprise licences. Evaluate Claude Enterprise pricing at this scale. | 200 seats · monthly billing or Enterprise pricing | CA$34.27/seat or negotiated | ~CA$6,854 |

> **June 2026 — the full migration decision.** ChatGPT Enterprise expires June 2026. At that point Fitzrovia will decide between two paths. **Scenario A (Hybrid):** renew ChatGPT Enterprise and maintain two platforms — Codex for broader experimentation, Claude for builders and selected staff. **Scenario B (Full Claude):** do not renew ChatGPT Enterprise and migrate everyone to Claude Teams. One platform, one invoice, one admin layer. If Fitzrovia migrates all ~200 staff to Claude, evaluate Claude Enterprise for volume pricing and enhanced compliance features. The incremental seat additions between now and June will inform which scenario makes more sense.

> **Context on cost.** CA$1,130/month is roughly 8–10 hours of external software developer time. A single bespoke tool built by a development agency typically costs $30,000–$100,000. This infrastructure enables our team to build and maintain multiple tools per year at a fraction of that cost — with full company ownership and enterprise security.

---

## 09 — 4-Week Migration Plan

Migration from personal accounts to Fitzrovia company infrastructure does not require rebuilding any tools — only moving them to new homes. The plan follows a phased approach: infrastructure first, tools and controls second, full operations by Week 4.

### Week 1 — Set up company infrastructure (sandbox only)

- Create `fitzrovia-residential` GitHub org under Karim's @fitzrovia.ca email (kmourad@fitzrovia.ca) — Kenny added as co-owner immediately
- Create Fitzrovia Team on Vercel under Karim's @fitzrovia.ca email — Kenny added as co-owner
- Create Fitzrovia org on Supabase · upgrade to Pro · Canada Central region
- Purchase Claude Teams Premium · 5 seats · monthly billing (no annual commitment while evaluating Teams vs Enterprise with Anthropic)
- Set up 1Password Teams for shared credentials
- Enable GitHub Dependabot across all repos
- Install CodeRabbit on the GitHub org — core requirement, not optional
- Configure Supabase IP whitelisting — office and VPN IPs only
- Kenny verifies Vercel data residency configuration — Canadian regions only
- **This week uses mock data only. The infrastructure is being set up and validated — no real Fitzrovia data enters until Week 2 controls are confirmed.**
- **Owner:** Karim + Kenny

### Week 2 — Migrate existing tools (real data permitted once controls are confirmed)

- Transfer all GitHub repos into the Fitzrovia org
- Export data from personal Supabase · import into Fitzrovia Supabase
- Update each tool's connection strings to point to the Fitzrovia database
- Transfer Vercel deployments from personal accounts to Fitzrovia team
- Revoke and rotate all old API keys from personal accounts
- **Real data is permitted from this point — infrastructure controls (Vercel residency, IP whitelisting, RLS) are in place. Builders work with real data throughout the build phase. This is expected and necessary.**
- **Owner:** Karim + Kenny · ~half day per tool

### Week 3 — Onboard the Builder Team and set permissions

- Invite Joseph, Builder 4, Builder 5 to GitHub org with correct roles
- Invite all 5 builders to Claude Teams Premium using @fitzrovia.ca emails · cancel personal subscriptions
- Configure branch protection rules on all repos
- Install CodeRabbit on the GitHub org (if adopted)
- Set up Linear with GitHub integration (free tier)
- AI Studio intake portal live at `hub.fitzrovia.ca/intake`
- **Owner:** Kenny (technical) · Karim (comms + onboarding)

### Week 4 — Fully operational, tools ready to go live to all staff

- All tools under Fitzrovia company accounts · single monthly invoice
- All 5 builders working inside the new infrastructure
- Governance and approval flows active and tested
- Legal formally sighted on the proposal · privacy obligations confirmed
- Named Privacy Officer confirmed by Legal
- Section 10 development standards acknowledged by all builders
- Production sign-off completed — Karim, Kenny, and Corey

---

## 10 — Development Standards

The goal is to go from idea to live tool in days for simple tools, weeks for complex ones. The standards below are designed around that — they are fast, they are proportionate, and they are split into two tiers so the right things happen at the right time.

| | Tier 1 — Programme setup | Tier 2 — Per tool, before going live to all staff |
|---|---|---|
| **Cadence** | Done once. Never revisited. | Fast. ~15 minutes per tool. |
| **What it is** | These happen during the 4-week migration. Once complete, they never need to happen again — every tool that follows benefits automatically. | Karim runs through this checklist before each tool is made accessible to all intended staff. No Legal involvement per tool. No Kenny signature per tool unless the data is flagged as high-risk. |

### Tier 1 — Programme setup (once)

| What | Why | Owner |
|---|---|---|
| **Vercel data residency confirmed** | Ensures all tool processing happens on Canadian servers, not Vercel's global edge. One command, confirmed in writing. | Kenny · Week 1 |
| **Supabase IP whitelisting** | Database accessible only from office and VPN IPs. Takes minutes to configure, significantly reduces exposure. | Kenny · Week 1 |
| **Legal sighted on the programme** | Legal confirms PIPEDA and Law 25 obligations, designates Privacy Officer, and provides a lightweight PIA template for tools that handle personal data. Happens once — not per tool. | Karim · before Week 4 |
| **Programme sign-off — Corey** | Corey formally accepts the residual risks in this document on behalf of the business. Happens once. Individual tool launches do not require Corey's involvement. | Corey · Week 4 |

### Tier 2 — Per tool, before going live to all staff (~15 min)

> **How Karim actually does this — no technical background required.** None of these steps require reading code. The builder will already have run `/review` and `/security-review` in Claude Code and walked the pre-PR checklist. For each item in this list, Karim either runs the **Fitzrovia `approver-review` skill** in Claude.ai (Claude returns a plain-English report covering the items below in one pass), checks the Vercel preview link in his browser, or confirms a Teams message from the requester. One paste, one report, the boxes verified.

Karim confirms before marking a tool as live:

- [ ] **Credentials are clean.** Paste the code into Claude Teams and ask: "Are there any hardcoded API keys, passwords, or secrets in this code?" Claude responds in plain English — either all clear or flags the specific issue. CodeRabbit will also have caught this automatically in the PR.
- [ ] **Access controls work.** Click the Vercel preview link and try to access data that shouldn't be visible to you. Alternatively, paste the database schema into Claude Teams and ask: "Is Row Level Security properly configured? Can a user access another user's records?" Claude tells you yes or no in plain English.
- [ ] **The requester confirmed it works.** Forward the requester a Teams message: "Does this do what you needed?" Wait for their confirmation. That message gets attached to the Linear ticket. Entirely non-technical.
- [ ] **Data type is noted.** Ask Claude: "Does this tool store any personal data — names, contact details, employee records, financial data?" Claude identifies what data is stored and whether a PIA is required. Note it in the Linear ticket.
- [ ] **Access controls are set.** If the tool is restricted to specific users or departments, confirm the Vercel access group or M365 group is configured correctly. Karim and Kenny are admins by default — confirm no other admins have been accidentally added.
- [ ] **Tool behaviour logging is in place.** For tools handling personal data, financial records, or making decisions — confirm the tool writes to the `tool_activity_log` table on each meaningful action. For pure display tools, this is optional.
- [ ] **Deletion process exists for personal data.** If the tool stores personal data, ask Claude: "How would you delete all records for a specific person from this database?" Claude provides the answer. The builder adds this to the README. Karim confirms it's there.

### Design consideration — agent-style tools and memory

Most tools Fitzrovia will build are stateless — a user asks, gets an answer, done. These do not need memory management. For the small subset of tools where Claude acts as an agent — reasoning across multiple turns or remembering user preferences — three memory layers should be defined upfront by the builder:

- **Session memory** — the current conversation the user is having with the tool. Handled automatically by Claude's API by passing previous messages. Lives in browser state or a temporary Supabase session row. Wipes when the session ends.
- **Persistent memory** — things the tool should remember long-term (e.g. "Karim always wants rent comps in CAD," "this tenant has a history of late payments flagged"). Stored in a Supabase table keyed to the user or entity, retrieved and injected into Claude's context when relevant.
- **Retrieval memory (RAG)** — for tools that need to search and pull from a knowledge base (policies, historical data, documentation). Stored as vector embeddings in Supabase's pgvector extension, retrieved at query time and passed to Claude as context.

For any agent-style tool, the builder documents the memory design in the Linear ticket: what is the session boundary, what persists long-term, and what needs retrieval. This is not required for simple CRUD tools (dashboards, data viewers, intake forms) — only for tools where Claude is the reasoning engine.

### Programme sign-off — required once

This is signed once when the infrastructure is ready and before the first tool goes live to all staff. After this, Karim manages individual tool launches using the Tier 2 checklist above.

**Fitzrovia AI Studio — programme go-ahead**

| Karim Mourad | Kenny | Corey Pacht |
|---|---|---|
| Director, Operations & AI Strategy | Head of IT | EVP |
| Tier 1 standards confirmed complete | Infrastructure controls verified | Accepts residual risks on behalf of the business |
| _Signature · Date_ | _Signature · Date_ | _Signature · Date_ |

---

# Appendix A — Tool Approval Checklist

Before any tool is approved for company-wide use, Karim signs off against the following criteria. This checklist applies at Gate 2 — the moment a tool moves from Staging to Production and becomes accessible to Fitzrovia staff beyond the builder. Kenny is the escalation point for tools involving sensitive or complex data — he does not review every individual tool launch.

> **Who approves.** Karim is the primary approver for individual tool launches. He uses CodeRabbit's automated PR summary and the Fitzrovia `approver-review` skill in Claude.ai — not direct code reading — to complete this checklist. The builder has already run `/review` and `/security-review` in Claude Code before opening the PR. **Exception: Karim cannot approve his own code.** When Karim is the builder, Kenny is the required approver, and vice versa. Kenny is also consulted for tools involving sensitive data. For confidential data tools see Appendix C.

### 1 · Strategic fit — does this tool actually make sense?

- [ ] **Problem validity.** Is there a clearly defined operational problem this tool solves? Can the builder articulate the before/after improvement in plain terms?
- [ ] **Best solution.** Is a custom-built tool genuinely the best way to solve this? Could an existing Fitzrovia platform (Yardi, Knock, Buildots) already do this, or could it be solved with a simple spreadsheet or process change?
- [ ] **Scope appropriateness.** Is the tool scoped correctly — not over-engineered for the problem, and not so minimal it won't hold up under real usage?
- [ ] **Audience clarity.** Is it clear who this tool is for? Is it company-wide, team-specific, or restricted to a few named individuals?

### 2 · Functionality — does it work reliably?

- [ ] **Core function tested.** Has the builder tested the primary use case end-to-end with realistic data — not just a demo? Have edge cases been considered?
- [ ] **Known limitations documented.** Has the builder clearly listed what the tool cannot do, what data it does not handle, and where it may produce incorrect output?
- [ ] **Error handling.** Does the tool fail gracefully? If it encounters bad data or a service outage, does it show a clear message rather than crashing silently?
- [ ] **Dependency risk.** Does the tool rely on a third-party API or data feed that could break, change, or be discontinued? Is there a fallback plan?

### 3 · Data and security — is company data handled safely?

- [ ] **Data classification confirmed.** Has the builder identified what data the tool stores or processes? Is it operational data, financial data, tenant data, or HR data? Each category may require different handling.
- [ ] **Data lives on Fitzrovia infrastructure.** Is all data stored in the Fitzrovia Supabase org (Canada Central)? No data on personal accounts, free-tier services, or third-party storage not approved by Kenny.
- [ ] **Access controls set.** Has Row Level Security been configured so only the intended users can access the data? Has this been tested — not just assumed?
- [ ] **No hardcoded credentials.** Are all API keys, database URLs, and passwords stored as environment variables — not written directly into the code where they could be accidentally exposed?
- [ ] **Sensitive data minimisation.** Does the tool collect only the data it needs? Avoid storing personal information, financial records, or HR data unless it is the core purpose of the tool.

### 4 · Ownership and maintainability — what happens after launch?

- [ ] **Named owner.** Is there a named person responsible for this tool after launch — someone who will respond if it breaks, update it when needs change, and be the point of contact for users?
- [ ] **Code is in the Fitzrovia GitHub org.** Is the repo under fitzrovia-residential? If the builder left tomorrow, could another builder pick up and maintain this tool?
- [ ] **Basic documentation exists.** Is there a README that explains what the tool does, how to use it, and how to update it? It does not need to be extensive — a single page is sufficient.
- [ ] **Retirement plan.** Is there a plan for what happens if this tool is no longer needed? Who decommissions it, where does the data go, and how are users notified?

### 5 · User experience — is it ready for non-builders?

- [ ] **Tested by someone other than the builder.** Has at least one person who did not build the tool tried to use it, without the builder guiding them? Did they succeed without confusion?
- [ ] **Access instructions exist.** Does the intended user know the URL, how to log in, and what they can do? Is there a short onboarding note or walkthrough for first-time users?
- [ ] **Not dependent on the builder's presence.** Can a user operate the tool independently, or does it require the builder to be available to explain it? If the latter, it is not ready for company-wide deployment.

### 6 · Design and user experience — does it look and feel like a Fitzrovia product?

- [ ] **Visual presentation.** Does the tool look polished and intentional? Apply the same standard you would to a presentation deck — layout, typography, spacing, and colour should feel considered, not like a rough prototype.
- [ ] **Brand alignment.** Does the tool feel consistent with Fitzrovia's identity — warm, elevated, and professional? It should not look generic or off-the-shelf. If externally visible or used with partners, brand alignment is mandatory.
- [ ] **Intuitive navigation.** Can a first-time user figure out where to go and what to do without being told? Key actions should be obvious. The user should never feel lost or unsure what happened after clicking something.
- [ ] **Information hierarchy.** Is the most important information easy to find at a glance? Data and actions should be prioritised by importance. Dense screens with no visual hierarchy are not acceptable for a company-wide tool.
- [ ] **Screen compatibility.** Does the tool work on the screens where it will actually be used — desktop, laptop, and where relevant, mobile? Text should not overflow, buttons should be clickable, and layouts should not break at different window sizes.
- [ ] **Feedback and confirmation.** When a user saves data, submits a form, or deletes a record — does the tool confirm it worked? Users should never be left wondering whether their action was registered.

### Approval sign-off

| Karim Mourad | Kenny |
|---|---|
| Director, Operations & AI Strategy | Head of IT |
| _Signature · Date_ | _Signature · Date_ |

Tool name: _________________________ · Date submitted: __________ · Builder: _________________________

---

# Appendix B — AI Reporting Cadence

Karim reports on AI tool development progress through two channels: a live dashboard accessible at any time, and a formal quarterly slot in leadership meetings.

### Always-on — Live Dashboard

A lightweight internal dashboard — built using the same infrastructure described in this plan — gives Corey and Adrian real-time visibility into the AI tool program without requiring a meeting.

- **Tools live:** list of deployed tools, their owners, and current status
- **Tools in progress:** what is currently being built and by whom
- **Tools pending approval:** anything awaiting Gate 2 sign-off
- **Intake queue:** open requests by status — new, triaged, in build, parked, declined
- **Monthly cost:** live tracker of platform spend vs budget
- **Recent activity:** last 30 days of deployments and intake submissions

*Accessible to: Corey, Adrian, Karim, Kenny · Read-only for leadership*

### Quarterly — Leadership Meeting Slot

Karim presents a formal 10–15 minute AI update in each quarterly leadership meeting. The goal is strategic alignment — not a status report, but a forward-looking discussion on what AI is enabling and where to invest next.

- **What shipped:** tools that went live since last quarter and their operational impact
- **What is next:** tools in the pipeline and the problems they solve
- **What we learned:** what worked, what did not, and what to change
- **Spend vs value:** platform costs vs estimated time/cost saved
- **Strategic asks:** decisions or resources needed from leadership

*Attendees: Adrian, Corey, Karim · Kenny as needed · 10–15 minutes*

---

# Appendix C — Confidential Tools — A Simpler Approach

Some data at Fitzrovia is too sensitive to run through any web infrastructure at all — salary figures, compensation structures, board reporting, HR records, corporate financials. For this category, the right answer is not a more locked-down web tool. It is **no web tool at all.**

Instead, confidential tools are built as **self-contained HTML files** — created using Claude Teams, run locally in a browser, and stored in a restricted SharePoint or OneDrive folder. Nothing is deployed to a server. There is no URL to share, no database to breach, no infrastructure to secure. When the file is closed, there is nothing to access.

> **Illustrative example.** Parker Hertz, VP Finance, needs a compensation scenario modeller. He uses Claude Teams to build a self-contained HTML tool — a calculator that lets him model salary bands and bonus structures. It runs in his browser. The file lives in a SharePoint folder accessible only to Parker, the CFO, and Corey. No server, no database, no Karim, no Kenny.

### Benefits

- **Nothing to breach.** No server, no database, no URL. When the file is closed, nothing is exposed.
- **No new infrastructure.** Uses Claude Teams (already in the plan) and SharePoint (already part of Fitzrovia's M365 licence).
- **Complete autonomy.** Finance and HR build and own their own tools. No dependency on the Builder Team, Karim, or Kenny.
- **Instant to deploy.** Build it in Claude Teams, save it to SharePoint, share the link with named individuals. Done.
- **Corey and Legal are the only governance needed.** No IT involvement required.

### Limitations

- **No live data connections.** The tool cannot pull live data from Yardi, Supabase, or other systems. Data must be entered or pasted in manually.
- **Limited persistence.** Data entered into the tool does not automatically save between sessions unless the tool is designed to export to an Excel or CSV file.
- **Single-user by default.** Multiple people cannot edit the same tool simultaneously the way they could with a shared web app.
- **Offboarding requires process.** If the person who built or owns the tool leaves, the SharePoint folder must be managed and access transferred — same as any sensitive spreadsheet today.

### How it works in practice

| Stage | Action |
|---|---|
| **Build** | Parker uses Claude Teams to build the tool — describing what he needs in plain English, Claude generates the HTML. No coding required. Takes hours, not days. |
| **Store** | The file is saved to a restricted SharePoint folder. Access is granted only to named individuals. IT manages the folder permissions via Fitzrovia's existing M365 admin — no new platform required. |
| **Offboard** | When someone with access leaves Fitzrovia, IT revokes their SharePoint access as part of standard offboarding. A named backup owner (e.g. CFO) is designated at the time the tool is created. |

> **This approach can evolve.** The local HTML model is the right starting point — simple, safe, and operational immediately. If a confidential tool grows in complexity and genuinely needs persistent data shared across multiple users simultaneously, it can be migrated to a fully isolated version of the main AI infrastructure: a separate GitHub org, Supabase project, and Vercel team — owned by Finance, with no Karim or Kenny access. That path exists and is well-understood. But it should be the exception, not the default.
