# Incident Response

**Path in handbook:** `05-policies/incident-response.md`

**Last updated:** April 30, 2026
**Owner:** Karim Mourad

---

## Purpose

This is the playbook for what happens when something breaks. It exists because incident response without a playbook is improvised — slow, inconsistent, and likely to miss legally required steps like Law 25 breach notification.

The document is deliberately short. A 20-page incident response policy is the kind of document people skim when things are calm and ignore when things are on fire. This is the version someone can actually follow at 2am.

---

## What counts as an incident

> **Plain English:** Not every bug is an incident. An incident is something where a tool isn't doing what it's supposed to do AND there's a real consequence — data exposed to wrong people, a tool unavailable when needed, a credential leaked. Routine bugs that don't have those consequences are just bugs; fix them in the normal workflow.

The three types of incidents this playbook covers:

**1. Data incident.** Personal data, commercial data, or anything Red-classified is exposed to people who shouldn't see it, leaves the systems it's supposed to stay in, or is accessed by an unauthorised party. Examples: a tool's RLS misconfiguration shows tenant data to the wrong staff member; a credential is leaked publicly; a tool sends an email containing personal data to the wrong recipient.

**2. Availability incident.** A tool that staff depend on stops working, and the unavailability has real operational consequence. Examples: the intake form is down during a busy intake period; the leasing pipeline tool is unreachable on a Monday morning; SSO is broken and nobody can log in.

**3. Security incident.** Credentials are compromised, unauthorised access is detected, or there's evidence of malicious activity. Examples: a Linear API key is found in a public repo; suspicious logins to a builder's account; a tool is making API calls nobody authorized.

Things that are NOT incidents (handle in the normal workflow):
- A bug that doesn't expose data and doesn't break a critical workflow
- A tool being slow when it's usually fast
- A user not finding a feature they expected (training/UX issue)
- A request for a tool to behave differently (feature request)

If you're unsure whether something is an incident, treat it as one. Over-escalating costs nothing; under-escalating can be expensive.

---

## What happens with non-incident bugs

> **Plain English:** Bugs that aren't incidents follow the normal AI Studio workflow — Linear ticket, prioritised, picked up by a builder, fixed via a PR. This section captures that flow at a high level so non-incident bug reports don't get lost.

The flow:

1. **A bug is reported.** Through the in-tool Support widget that every Fitzrovia tool includes (see "Detection" below for the routing).
2. **Karim, Kenny, or Joseph triages.** Is this a bug, a feature request, a misunderstanding, or an incident? If it's an incident, this playbook takes over. If it's a feature request, it goes to the intake portal flow. If it's a bug or misunderstanding, continue.
3. **For real bugs, a Linear ticket is created** in the AI Studio team's queue. Priority is set based on severity (how many users affected, what they can't do, whether there's a workaround).
4. **The ticket flows through the Linear workflow** — New → Triaged → Accepted → Ready to Build → In Progress → In Review → Live. The relevant stages are documented in the roadmap (Section 2) and the intake/build process pages.
5. **A builder picks up the ticket** during normal work. For minor bugs, this might be the same day. For lower-priority bugs, it can be days or weeks. The Linear queue makes the priority and progress visible.
6. **The fix follows the standard PR workflow** per `04-standards/branching-and-prs.md` — feature branch, pre-PR checklist, approval, merge to main, Vercel auto-deploys.

For misunderstandings (the user thought the tool would do something it doesn't, or didn't realise a feature exists), the response is direct help via the support channel rather than a Linear ticket. If the same misunderstanding comes up repeatedly, that's a signal to update the tool's UX or documentation; that update would go through the normal Linear flow as a small ticket.

The fuller bug-response process — when bug response is fast-tracked, when it's batched, how priority is assigned — will be captured in `06-operations/bug-response.md` once we've run the flow enough times to know what works. For now, the high-level flow above is sufficient.

---

## The playbook

> **Plain English:** Six steps. Detect, triage, contain, notify, fix, learn. They're listed in order, but containment can happen in parallel with notification when speed matters.

### 1. Detect

Most incidents are detected one of three ways:

- **A user reports it via the in-tool Support widget.** Every Fitzrovia tool — including the hub landing page, the tool selection page, and the intake form — includes a Support button. The user clicks it, describes the issue in the widget's submission form, and optionally attaches a screenshot. Submissions auto-capture which tool, which page, and which user. The widget itself is part of the Tool Starter and ships with every tool by default.
- **Monitoring catches it.** Vercel surfaces a deployment error; Supabase logs an unexpected query pattern; CodeRabbit flags something post-merge.
- **A builder notices during work.** While working on something else, a builder spots data they shouldn't see, an error they can't explain, or a credential where it shouldn't be.

**For active incidents — when seconds matter — direct Teams DM or phone call to Karim or Kenny is appropriate** and skips the queue. The Support widget is the right path for routine issue reporting (creates a record, routes to the right channel, captures context). Direct contact is the right path when an incident is unfolding in real time and the message needs to reach a human now.

### Support channels

Every Fitzrovia tool includes the Support widget. Submissions are routed to three places:

- **The `ai-studio-support` Teams channel** — primary destination. Karim, Kenny, and Joseph monitor this channel and triage from here. Routine bug reports become Linear tickets; incidents trigger this playbook; misunderstandings get a direct reply.
- **A dedicated email inbox (`aistudio-support@fitzrovia.ca`)** — backup destination, ensuring submissions aren't lost if Teams is down or someone misses a notification.
- **A Supabase log (`support_submissions` table)** — searchable record of every submission, used for triage continuity, metrics, and post-incident review.

The widget is a shared package (`packages/support-widget/`) imported by every tool, including the foundation tools (hub, tool selection page, intake form). Builders don't reinvent the support flow per tool. Tool Starter installs it by default, so every new tool inherits the same support flow.

### 2. Triage

Karim, Kenny, or Joseph (whoever is reachable first) assesses:

- **What kind of incident is this?** Data, availability, or security.
- **What's the scope?** How many users, how much data, how long has it been happening, is it still happening.
- **What's the severity?** High (active data exposure, complete outage of a critical tool, confirmed credential compromise), Medium (partial outage, suspected exposure, contained issue), Low (minor disruption, theoretical risk).

Triage takes minutes, not hours. The goal is to get to "yes this is an incident, here's roughly what we're dealing with" fast enough to start containment.

### 3. Contain

Stop the incident from getting worse. The standard moves:

- **For data incidents:** revoke access to the affected tool or table, rotate any compromised credentials, take the tool offline if active exposure is happening. The Vercel rollback (per `04-standards/branching-and-prs.md`) reverts a tool to its previous working version in under a minute. Use it.
- **For availability incidents:** identify what's broken, roll back the most recent deployment if that's the cause, fall back to a manual workaround for staff if the tool will be down for more than 30 minutes.
- **For security incidents:** revoke compromised credentials immediately (rotate API keys, disable accounts), restrict access to anything the compromised credential touched, preserve logs for investigation.

Containment can happen in parallel with notification — don't wait for one to finish before starting the other.

### 4. Notify

Who gets told depends on the incident type and severity.

**Always notify, for any incident:**
- Karim and Kenny (if not already involved)

**Karim and Kenny decide whether to notify Corey** based on materiality. Default toward not notifying for routine incidents (a 30-minute outage of a non-critical tool doesn't need executive awareness). Notify Corey for:
- Any incident involving Red data exposure (personal or commercial)
- Any prolonged outage (more than a few hours) of a tool used broadly
- Anything affecting Fitzrovia's external-facing posture (deals, regulators, investors, tenants)
- Anything where the incident response itself may need executive awareness (e.g. credential rotation that affects multiple people, decisions about external help)

**For data incidents involving personal data:**
- **Tim Watson immediately.** Law 25 has a 72-hour notification window for the Quebec privacy regulator (CAI) when a confidentiality incident creates a risk of serious harm. Tim makes the call on whether the threshold is met and handles regulatory notification. If Tim is unreachable, escalate to whoever is acting in his role; do not delay.
- **Affected individuals** if Law 25 / PIPEDA require it. Tim makes this call.
- **HR** only if employee personal data was exposed to people who shouldn't see it (per `05-policies/data-classification.md`). HR doesn't need to be looped in for every incident affecting an employee — only for incidents where employee personal data left its appropriate scope. A tool failing during an employee's workflow is not an HR matter; an employee's compensation data being visible to non-HR staff is.

**For data incidents involving commercial data only (no personal data):**
- Corey makes the call on whether external notification (e.g. to affected counterparties) is required.

**For security incidents:**
- Tim if there's any chance personal data was accessed.
- Kenny coordinates broader IT response if it touches Fitzrovia infrastructure beyond the AI Studio.

**For availability incidents:**
- Affected users via the `ai-studio-support` Teams channel and direct Teams messages, with an honest summary ("the intake form is down, we're working on it, will update in 30 min"). Don't speculate about cause until you know.

The notification message says: what happened, who's affected, what we're doing about it, when we'll update next. It does not speculate, does not assign blame, does not promise specific timelines unless they're known.

### 5. Fix

Get back to working state. For most incidents, this is straightforward — debug, fix, redeploy. For data and security incidents, the fix may require changes to the underlying tool or its configuration that go beyond the immediate restoration.

The fix follows the standard PR workflow per `04-standards/branching-and-prs.md` — even in incident response. The branch protection rules don't go away because there's an incident. The PR can be reviewed faster than usual, but it still gets reviewed.

The exception is when the fix is a Vercel rollback to a previous deployment — that's a single-click action, not a PR, and is the right move when the incident was caused by the most recent merge.

### 6. Post-mortem

Not every incident requires a written post-mortem. Routine, fast-fixed incidents are closed via the Teams thread that handled them — that's sufficient.

**Written post-mortems are required for:**

- Any incident involving Red data exposure (personal or commercial)
- Any incident triggering Tim Watson involvement
- Any incident requiring notification to Corey
- Any security incident
- Anything Karim, Kenny, or Joseph judges material enough to warrant one (errs toward writing it when uncertain)

For incidents below those thresholds, a brief Teams summary is enough — what happened, what we did, fixed.

When a written post-mortem is required, it's drafted within a week of the incident closing using the standard template. **The template is the questions below — copy them into a new document and answer each:**

- **What happened?** A factual timeline.
- **What was the impact?** Who was affected, what data was exposed, how long it lasted.
- **Why did it happen?** Root cause, with honesty.
- **What did we do well?** What worked in the response.
- **What did we do poorly?** Where the response was slow or wrong, without blame.
- **What changes prevent this from happening again?** Concrete actions, with owners and dates.

Post-mortems are written by Karim, Kenny, or Joseph (typically whoever was Incident Lead), reviewed by the others. For incidents involving personal data, Tim sees the post-mortem. For incidents that affected staff broadly, Corey sees it.

Post-mortems are stored in the handbook under a `post-mortems/` folder (created when the first one is written). They are blameless — the goal is system improvement, not finding fault. Post-mortems that read as blame-finding get rewritten.

---

## Roles during an incident

> **Plain English:** Even in a small team, having explicit roles during an incident reduces confusion. Who's deciding, who's communicating, who's fixing. These roles overlap — at our scale, one person often holds two — but they should be named explicitly.

The roles:

- **Incident Lead.** Decides what's happening, what to do next, and when the incident is resolved. Default: Karim. If Karim is unavailable, Kenny.

- **Communicator.** Sends notifications, posts updates to affected users, handles the messaging. Communications go through the AI Studio's support channels (the `ai-studio-support` Teams channel for broad updates; Teams DMs to specific affected users when targeted), with email backup for users who aren't reachable on Teams. The Communicator drafts the user-facing updates; the Incident Lead approves before they go out. Default: whoever is more available; often Karim because he knows the user-facing context.

- **Fixer.** Actually does the technical work to contain and fix. **Default: the tool's builder, if available and they have the access needed.** The tool's builder knows the code best and is the fastest path to a real fix. If the builder is unavailable, doesn't have the access required (e.g. the fix requires touching shared infrastructure), or the issue is in shared infrastructure rather than a specific tool, then Karim or Kenny does the fixing — Karim for application-level issues, Kenny for IT-infrastructure-level issues (Entra, DNS, M365). For shared development infrastructure (GitHub, Vercel, Supabase), either Karim or Kenny.

The roles can be held by the same person during a small incident. For a serious incident, splitting them reduces context-switching cost. Tool builders are expected to be reachable for incidents involving their tools — this is a reasonable on-call expectation that should be in the builder onboarding doc.

---

## When the incident involves Karim or Kenny themselves

If a credential leak or compromise involves either Karim or Kenny's account, the affected person stops being the Incident Lead. The other one runs the response — including any decisions about rotating credentials, revoking access, or notifying others.

This isn't about distrust. It's because someone whose account is compromised has a conflict of interest in deciding the scope of the response, and may also have lost access to the tools needed to run it.

---

## What this policy does NOT cover

- **General bug fixes that aren't incidents** — those follow the standard `04-standards/branching-and-prs.md` workflow.
- **Routine maintenance and outages** — planned downtime is communicated separately, not via this policy.
- **The criteria for what data is sensitive** — see `05-policies/data-classification.md`.
- **Who has access to what** — see `05-policies/access-control.md`.
- **Fitzrovia-wide incident response policies** — those are owned by Fitzrovia IT and HR, not the AI Studio. This policy operates within whatever broader policies exist; it doesn't replace them.
- **Detailed Law 25 breach notification procedures** — those are Tim Watson's domain. This policy says "Tim makes the call"; it doesn't reproduce the regulatory text.
