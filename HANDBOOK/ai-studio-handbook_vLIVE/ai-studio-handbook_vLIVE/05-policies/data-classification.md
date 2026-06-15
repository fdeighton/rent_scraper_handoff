# Data Classification

**Path in handbook:** `05-policies/data-classification.md`

**Last updated:** April 29, 2026
**Owner:** Karim Mourad

---

## TL;DR

Three classifications, drives every decision about a tool:

- **Green** — aggregated/operational data with no personal or financial detail. (E.g., "47 tickets last week.") No special controls. Tier 2 OK.
- **Amber** — internal data that shouldn't leak externally but a leak is embarrassing, not material. (E.g., team-level productivity stats.) Standard controls. Tier 2 OK.
- **Red** — data whose leak would cause material harm. Personal data (tenant PII, employee compensation), commercial data (per-property financials), or both. **Forces Tier 1**, RLS required, activity logging required.

Two rules that prevent over-process:
- **Sign-offs scale with novelty, not volume.** Tim Watson signs off on the *first* Red tool of a new kind, not every Red tool. Same for Corey on commercial Red.
- **When in doubt, classify higher.** It's easier to relax controls than to add them after a leak.

Every tool's README declares its classification. Every PR for a new tool sets it. Every PR for an existing tool verifies it's still correct.

The full classification rules, edge cases, sub-categories, and sign-off matrix are below.

---

## Purpose

Every Fitzrovia AI Studio tool handles data. This policy defines how we classify that data into three categories — Green, Amber, Red — and what each category means for how the tool is built, deployed, and reviewed.

The glossary defines the categories briefly. This document is where the practical application lives: how to decide which category applies, what to do at the boundary cases, and what each classification actually requires in terms of controls.

Every tool's README must document its classification. Every PR for a new tool sets it. Every PR for an existing tool verifies it's still correct.

---

## Why classification matters

> **Plain English:** Different kinds of data carry different risks. A list of how many maintenance tickets came in last week is harmless. A list of tenants and their financial details is sensitive enough that mishandling it could lead to legal action, fines, or harm to real people. We can't apply the same level of caution to both — we'd either over-spend protecting harmless data, or under-spend protecting sensitive data. Classification lets us match the level of care to the actual risk.

The three classifications drive specific decisions across the studio:

- **Tool tier.** Red data forces Tier 1; Amber and Green can be Tier 2.
- **Required controls.** RLS, activity logging, access groups, encryption at rest, retention policies — all calibrated to classification.
- **Review depth.** Red tools get more scrutiny than Green tools, both at code review and at launch.
- **Compliance obligations.** Law 25 and PIPEDA apply specifically to personal data — Red. Green data has no such obligations. Amber sits in between.
- **Privacy Officer involvement.** Tim Watson signs off on Red tools handling personal data; not required for Green.

Misclassifying a tool isn't just a paperwork error — it leads to the wrong controls being applied, which is how breaches and compliance failures happen.

---

## The three classifications

### Green

**General business information with no personal, financial, or confidential dimension.**

Green data is information that, if it became public tomorrow, would not embarrass anyone, harm anyone, or put Fitzrovia at legal risk. It might still be commercially sensitive in a "we'd prefer competitors not know" sense, but it doesn't trigger compliance obligations.

**Examples of Green data:**

- Aggregated occupancy rates across the portfolio (e.g. "average occupancy 94%")
- Public market data scraped from competitor websites (rent comps for buildings we don't own)
- Internal volume metrics that don't identify individuals (e.g. "the maintenance team handled 47 tickets last week")
- Operational dashboards aggregating activity at a regional or portfolio level
- Internal documentation, training materials, process diagrams

**Examples of tools that handle Green data:**

- Rent Comps Scraper (pulls public listings from competitor sites)
- Maintenance ticket volume dashboard (aggregated counts, no PII)
- Construction status board showing project progress at a high level

**Implications:**

- Tool tier: Tier 2 acceptable
- Activity logging: standard
- PIA: not required
- Access controls: standard (Microsoft 365 group appropriate to the tool)
- Privacy Officer sign-off: not required

---

### Amber

**Internal business information that should not be shared externally, but where a leak would be embarrassing or operationally inconvenient rather than materially harmful.**

Amber is the genuine middle. It's clearly internal — competitors, regulators, or the public shouldn't see it — but a leak doesn't trigger legal exposure or materially damage the business. The harm is bounded.

**Examples of Amber data:**

- Aggregated team-level productivity data (team-level, not individual)
- Project status indicators that don't include budget or financial detail
- Internal documentation about how teams operate
- Operational data at a regional or portfolio level that doesn't break down to specific properties

**Examples of tools that handle Amber data:**

- Team productivity dashboards (aggregated by team, not by person)
- Project status boards showing high-level progress without budget detail
- Internal training and onboarding tools

**Implications:**

- Tool tier: Tier 2 acceptable
- Activity logging: required
- Access controls: restricted to relevant staff via Microsoft 365 groups
- Documented access controls: yes, in the tool's README
- Sign-off: Karim approves; no Corey or Tim sign-off required

---

### Red

**Data whose leak would cause material harm to Fitzrovia or to identifiable individuals — legal, regulatory, commercial, or reputational.**

Red data isn't only personal information. It's any data where the consequence of a leak is *material* — meaning real legal exposure, real regulatory exposure, real commercial damage to deal-making and competitive position, or real harm to specific people whose information we hold. The controls are the same regardless of which kind of harm we're protecting against, because the protective tooling (RLS, logging, retention rules) is the same. What differs is who signs off and why.

Red data falls into three sub-categories that drive different sign-off patterns. The controls (Tier 1, RLS, logging, retention) are uniform; only the sign-off path differs.

**Red — personal data.** Information about identifiable individuals where mishandling triggers Law 25, PIPEDA, contractual obligations, or harm to the people whose data we hold.

Examples: tenant names + addresses + financial details (any combination), employee compensation, performance reviews, HR records, credit reports, screening results, background checks, identifiable individual contact information combined with anything else, information governed by leases or employment contracts.

Examples of tools: Tenant Screening Reports, Compensation Modeller, HR Performance Review Compiler, AGM Package Generator (where it includes individual director information).

**Red — commercial.** Information whose leak would materially damage Fitzrovia's competitive position, deal-making, or financial position. No specific identifiable individual is the victim; the harm is to the business.

Examples: building-level financial performance (revenue, NOI, occupancy by specific property), vendor pricing and contract terms, internal cost structures and margins, operational metrics broken down by property, project budgets and timelines that aren't yet public.

Examples of tools: Yardi Insights Dashboard, vendor management dashboards, construction budget trackers, per-property financial reporting tools.

**Red — both.** Tools that handle both kinds of Red data simultaneously. A tool combining tenant information with per-property financials, for example, fits both sub-categories.

**Implications (uniform across all three Red sub-categories):**

- Tool tier: Tier 1 required
- RLS at the database level: required (the database itself enforces who can see which rows, not just the application)
- Activity logging: detailed, with quarterly review
- Access controls: strict, via Microsoft 365 groups; principle of least privilege
- README: documents purpose, owner, users, retention, and deletion process
- Sign-off pattern: see "Sign-off model" below — depends on whether this is the first time the studio handles this kind of Red data

---

## At-a-glance comparison

| | Green | Amber | Red |
|---|---|---|---|
| Tool tier | Tier 2 | Tier 2 | Tier 1 |
| Activity logging | Standard | Required | Detailed, with quarterly review |
| Access control enforcement | Application layer | Application layer + M365 groups | **Database layer (RLS) + application + M365 groups** |
| README documentation | Purpose, owner | Purpose, owner, users, access controls | Purpose, owner, users, **retention, deletion process** |
| Karim approves | Yes | Yes | Yes (always) |
| Tim Watson sign-off | No | No | First tool handling new kind of personal data |
| Corey sign-off | No | No | First tool handling new kind of commercial data |
| PIA required | No | No | Yes, where personal data is involved |

**The two big differences between Red and the lower tiers:**

1. **Access control happens at the database layer for Red tools.** Green and Amber tools enforce access in the application — the tool checks "is this user in the right Microsoft 365 group?" before showing data. If the application has a bug, the check might be bypassed. Red tools also enforce access at the database layer via Row-Level Security (RLS): even if the application has a bug, the database itself refuses to return rows the user isn't authorised to see. This is the safety net that catches application-layer mistakes.

2. **Some Red tools require additional sign-offs the first time the studio handles a new kind of Red data.** This is the "Sign-off model" below.

The actual *quality of code review* doesn't differ by classification. Every tool gets `/review`, `/security-review`, the pre-PR checklist, CodeRabbit, and the approver-review skill. What differs is the *additional controls* applied to Red tools. The code review baseline is the same.

---

## Sign-off model

> **Plain English:** Tim Watson and Corey don't need to sign off on every Red tool — that would slow the studio down for no real benefit. They sign off when the studio is genuinely doing something new. Once a precedent is set for a kind of data, subsequent tools handling that same kind of data follow the precedent and Karim approves them alone. Karim uses his judgement to decide when something is genuinely new versus when it follows an existing pattern, and to flag tools to Tim or Corey when extra eyes feel warranted regardless of the formal rule.

The principle: **sign-offs scale with novelty, not volume.** The studio's edge is speed. We don't preserve speed by adding people to every approval — we preserve it by deciding the rules clearly once, applying them mechanically afterward, and pulling in additional eyes only when something is genuinely new.

### What "first time handling this kind of Red data" means

A Red sub-category becomes "established" once the studio has shipped a tool handling that kind of data with the appropriate sign-off. Subsequent tools handling the same kind of data don't need re-signing — they inherit the precedent.

Examples:

- **Tenant PII.** First tool: Tenant Screening Reports. Tim Watson signs off, retention rules established, RLS pattern established, PIA template completed. Now a second tool needs tenant PII — say a tenant-communication tool. It follows the established precedent: same RLS pattern, same retention rules, same logging. Tim doesn't need to re-sign. Karim approves alone.

- **Per-property financials.** First tool: Yardi Insights Dashboard. Corey signs off — he's accepting the executive risk that internal staff will see per-property financial data with appropriate access controls. Now a second tool needs per-property financials — say a vendor performance dashboard that ties spend to specific buildings. It follows the established precedent. Corey doesn't need to re-sign. Karim approves alone.

- **Employee compensation.** First tool: Compensation Modeller. Tim signs off (HR data is personal), Corey signs off (executive risk). Established. Second tool that touches compensation data inherits the precedent.

The trigger for Tim or Corey's review is the introduction of a new *kind* of Red data into the studio, not the introduction of a new *tool* that happens to handle Red data. If we already have a pattern for the data, the tool follows the pattern.

### Karim's judgement on whether a tool is "first" or "established"

**Karim decides whether a tool fits an existing precedent or whether it's genuinely new.** This is a judgement call, not a mechanical rule. Some questions to apply:

- Does this tool handle the same kind of data as a previous Red tool, with the same access pattern, the same retention needs, and the same audience? → Established. Karim approves.
- Does this tool handle data that's similar but not identical — combining tenant PII with new third-party data, for example, or surfacing per-property financials to a wider audience than before? → Probably new. Pull Tim or Corey in.
- Does this tool feel novel in a way Karim can't quite articulate? → Trust the instinct. Pull Tim or Corey in.

**Karim retains discretion to involve Tim or Corey on any tool, regardless of whether the rule technically requires it.** When something feels off — the data, the access pattern, the audience, the risk — Karim flags it directly to whoever's judgement matters. The policy supports this without requiring it. The cost of an extra review on a tool that turns out to be routine is small; the cost of skipping a review on a tool that turns out to be novel can be material.

This is also true in the other direction: Karim cannot use the "established precedent" framing to skip review when something genuinely warrants it. The policy assumes Karim will escalate when warranted, even when the formal rule doesn't require it.

### The trust model

This sign-off approach trusts Karim's judgement to determine what's "established" versus what's "new." If Karim decides a tool fits an existing precedent when it actually doesn't, the executive sign-off has been silently removed without anyone noticing — and the policy can't catch this.

The check on this is the working relationship with Corey and Kenny. Karim should keep them roughly aware of what's being shipped, even when their formal sign-off isn't required, so they can flag if something feels off. The trade-off versus a bank-style "every tool gets every approval" is real: the bank model catches more cases of misjudgement at the cost of catching them slowly. The Fitzrovia model catches them faster (Karim flags directly when something feels off) but depends on Karim actually flagging them.

The deal is: Karim has authority to decide "this fits an existing pattern, I'm approving" *and* the responsibility to escalate when something doesn't fit. Both halves are part of the role.

---

## Edge cases — how to decide when it's not obvious

> **Plain English:** Some tools sit on the boundary. When you're unsure, these rules tell you which way to lean.

Apply these in order. The first rule that resolves the question wins.

### 1. Data trumps audience

A tool's classification is set by **what data it handles**, not by **who uses it**.

A tool used by junior staff that handles tenant PII is Red. A tool used by Corey that only displays aggregated regional metrics is Green. The seniority of the user doesn't change the data's classification.

This rule exists because it's tempting to think "but only the right people will use this tool, so the data is fine." That's an access-control argument, not a classification argument. Classification is the *baseline* — access controls are the additional layer on top.

### 2. Decision stakes trump complexity

A simple tool that drives material decisions about people or money is Red, even if it's just a calculator.

A complex tool that produces internal dashboards from aggregate data is Amber or Green, even if it's technically sophisticated.

This matters because we tend to assume "more code = more risk." That's not how the policy works. Risk follows the data and the consequences, not the code.

### 3. External audience trumps internal scope

Anything that produces output going to investors, regulators, tenants, or any party outside Fitzrovia is Red, even if internally the data feels routine.

A "simple" investor report still creates legal exposure. The data crosses a boundary; the classification reflects that.

### 4. Combinations can escalate classification

Two pieces of Amber data combined can produce Red data. Classic example: a list of building names with their NOI is Amber. A list of tenants with their rent payments is Red. Either alone is one tier. Combining them — building names mapped to specific tenants and their financials — is Red because the combination is more identifying and consequential than either part.

When designing a tool, think about what the *outputs* look like, not just the inputs. A Green tool that combines its inputs into an Amber output is an Amber tool. A tool that combines Amber inputs into Red output is a Red tool.

### 5. When in doubt, classify up

If the classification is genuinely ambiguous, treat the tool as the higher tier. The cost of over-classifying is proportionate controls (more rigour, slightly slower review). The cost of under-classifying can be a Law 25 violation, a regulatory investigation, or harm to someone whose data we mishandled.

The asymmetry favours caution.

### 6. Document the decision

Every tool's README documents its classification *and the reasoning*. Future builders and auditors should be able to see why this tool was classified the way it was. Without the reasoning, classification drift happens silently.

Format in the README:

```markdown
## Data classification

**Classification:** Amber

**Reasoning:** This tool displays team-level productivity data aggregated across
the operations team. It does not break down to individual employees, does not
include financial detail, and is restricted to ops-team Microsoft 365 group.
```

Two or three sentences. Enough to reconstruct the decision.

---

## What changes a classification

A tool's classification can change over its lifetime. The most common cause is scope creep: a tool that started Green ("display maintenance ticket volumes") gains a feature that makes it Amber ("...and show which technician handled each one") or Red ("...and include the tenant's name and unit number on each ticket").

When a PR changes a tool's classification:

1. The PR description flags the change explicitly: "This change moves the tool from Amber to Red because it now displays tenant names alongside ticket history."
2. The README is updated, including the reasoning for the new classification.
3. The approver evaluates whether the additional controls required by the new classification are in place. If moving to Red, that means RLS, activity logging upgrade, retention rules, and the appropriate sign-offs per the "Sign-off model" section — depending on whether this is the first time the studio handles this kind of Red data.
4. If the controls aren't yet in place, the PR is split: one PR adds the controls (RLS migration, etc.), a follow-up PR adds the feature that triggered the upgrade.

Classification can also move *down* — a tool simplified to remove personal data fields might move from Red to Amber. Same documentation rule applies: the PR explains the change, the README is updated, the approver verifies.

---

## Who decides

For any individual tool: the builder proposes the classification in the tool's spec or README. Karim verifies during approval. Edge cases get discussed with Kenny.

For sign-off on Red tools: Karim decides whether the tool fits an established precedent or is genuinely new. If new, Tim Watson signs off on personal-data tools and Corey signs off on commercial-risk tools. If established, Karim approves alone. Karim retains discretion to pull Tim or Corey in regardless of whether the rule requires it. See "Sign-off model" above for the full pattern.

For policy-level questions (does this kind of data count as Red? does this combination cross a threshold? is this a new sub-category or an extension of an existing one?): Karim and Tim Watson decide together where personal data is involved; Karim and Corey for commercial-risk questions. Kenny is consulted on anything with IT or access-control implications.

For systemic changes to this policy: a PR to this document, following the standard `04-standards/branching-and-prs.md` workflow. Reviewed by Karim, Kenny, and Tim Watson. Substantive changes are flagged in the changelog.

---

## What this policy does NOT cover

This document is the data classification policy. It is not:

- **The full Law 25 / PIPEDA compliance framework** — see `05-policies/law-25-pipeda.md` (to be drafted with Tim Watson)
- **The Acceptable Use Policy** — see `05-policies/acceptable-use.md` (to be drafted)
- **How RLS is configured for Red tools** — see `04-standards/database-conventions.md` (post-foundation)
- **How activity logging works** — see `04-standards/activity-logging.md` (post-foundation)
- **Who has access to which tools** — see `05-policies/access-control.md` (to be drafted)
- **The launch checklist for each tier** — see the roadmap (Section 10) and `04-standards/deployment-checklist.md` (post-foundation)

If you're looking for something not covered here, it's almost certainly in one of those documents.
