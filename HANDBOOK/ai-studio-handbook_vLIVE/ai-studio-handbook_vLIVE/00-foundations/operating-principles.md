# Operating Principles

**Path in handbook:** `00-foundations/operating-principles.md`

**Last updated:** April 30, 2026
**Owner:** Karim Mourad

---

## Purpose

This document captures how the Fitzrovia AI Studio operates day-to-day. It is intentionally short. It does not repeat the strategy from the roadmap, nor the specific rules from individual policies. It captures the **non-obvious choices** that shape decisions when no specific policy applies.

If a future builder is faced with a decision that isn't covered by a Skill, a standard, or a policy — these principles are the answer.

These principles also encode the trade-offs that distinguish how the AI Studio operates from how it could otherwise operate. Each principle is paired with the alternative we are deliberately rejecting. This is what makes the principle real rather than aspirational.

For terms used throughout this document (Tier 1, Tier 2, RLS, Green/Amber/Red, etc.), see `00-foundations/glossary.md`.

---

## The principles

### 1. Build for leverage, not for novelty

**What it means.** Every tool the AI Studio builds must create operating leverage for Fitzrovia. Operating leverage means time saved at scale, better decisions, accessible intelligence, or capability we did not have before. The studio exists to make Fitzrovia operate at a level that headcount alone cannot achieve. Tools that are interesting, clever, or fun but do not create leverage do not get built.

**Why we believe this.** Fitzrovia operates 30+ buildings, 5,000+ units, and a growing portfolio. The opportunity is to use AI to make the company operate as if it had ten times the staff in the right places. That opportunity is squandered if the studio drifts toward novelty. Every tool must answer the question: what operating leverage does this create, and is it material at our scale?

**What this rejects.** "Wouldn't it be neat if..." as a justification for building something. Tools that solve problems no one actually has, no matter how technically clever. Demoware that impresses leadership but doesn't change how anyone works. The slow drift toward becoming an internal hackathon.

---

### 2. Proportionate governance, not enterprise-grade theatre

**What it means.** Controls match the tool's actual risk. Tier 1 tools handling sensitive data get strong controls — RLS, activity logging, security review, Privacy Officer sign-off. Tier 2 internal experiments still get baseline controls (auth, logging, RLS) but don't get the full enterprise treatment. Every governance addition needs to be justified by a real risk it mitigates, not a hypothetical one. Proportionate means matching controls to risk; it does not mean lowering controls overall.

**Why we believe this.** Fitzrovia is 30+ buildings, not a Fortune 500. Enterprise-grade security on every tool slows the studio to a crawl with no real benefit. The cost of over-governance is invisible (tools that didn't get built) but real. The cost of under-governance is occasional but severe. Proportionate governance gets the balance right.

**What this rejects.** Blanket SOC 2 Type II requirements on every tool. Mandatory penetration testing for every release. A dedicated DevSecOps hire at this scale. Approval committees that produce paperwork instead of safety. Equally rejected: skipping baseline controls on "internal" tools because they feel low-risk.

---

### 3. Builders use real data during development

**What it means.** Builders develop against production data, not synthetic test data. Real data exposes real edge cases. Test data hides them. RLS, access controls, and activity logging give us the safety the test environment was supposed to provide. Builders working on a tool already have legitimate access to the data the tool will handle.

**Why we believe this.** We are not a software company shipping products to external customers. We are an internal team building tools for ourselves. The cost of "not finding the bug" is higher than the cost of "developer saw real data they have access to anyway."

**What this rejects.** The traditional staging-database-with-fake-data pattern, which is appropriate for external products but slows internal tool development without meaningfully improving safety.

---

### 4. One person triages, one person decides, two people verify

**What it means.** Karim triages every incoming intake submission. Karim decides what gets built. Code requires both Karim and Kenny to approve before merging — neither can approve their own work. Tier 1 tools require Corey's sign-off before launch. The "two-person rule" applies to verification, not to decision-making.

**Why we believe this.** Single decision-makers are fast. Multiple verifiers are safe. We want both. Adding more triagers, more deciders, or more committees adds latency without adding meaningful safety.

**What this rejects.** Approval committees that meet weekly. Design-by-consensus. Formal stage gates with three-week review cycles. The illusion that more people in a decision means a better decision.

---

### 5. Default to monthly, evolve to annual when proven

**What it means.** AI tools, infrastructure, and SaaS subscriptions start on monthly billing. We commit to annual contracts only when usage and value are validated and the alternative tools have been considered.

**Why we believe this.** AI is changing fast. ChatGPT vs. Claude vs. whatever-comes-next is undecided. Annual commitments lock in choices we may want to revisit in 6 months. Monthly billing preserves optionality at a small premium.

**What this rejects.** Annual prepayments for unproven tools. Multi-year vendor agreements before product-market fit is established. Discounts that obscure switching cost.

---

### 6. Spend deliberately, measure ruthlessly

**What it means.** Cost is a first-class consideration in every tool, not an afterthought. Builders estimate cost-per-use during the spec phase. Every tool logs its API costs to `tool_activity_log`. Monthly cost dashboards are visible to Karim and Kenny. Builders default to the cheapest model that works for the task — upgrading from a smaller to a larger model requires justification, not the reverse. Caching, pre-computation, and token-efficient prompts are standards, not nice-to-haves.

**Why we believe this.** API costs scale with usage. A tool that's 10x more expensive than it needs to be will quietly burn money for years if nobody is watching. The studio's value depends on cost discipline at the same level as quality discipline.

**What this rejects.** "Just use the most powerful model to be safe." Tools that re-fetch the same data every time without caching. Prompts that include 20 pages of context when 2 paragraphs would suffice. Cost surprises at month-end because nobody was watching the dashboards.

---

### 7. Skills, templates, and standards over tribal knowledge

**What it means.** Anything that should be done consistently across tools is captured in a Skill, a template, or a standard in this handbook. Not in someone's head, not in a Microsoft Teams chat, not in an email thread.

**Why we believe this.** Tribal knowledge is fragile. People leave. People forget. Skills, templates, and standards survive turnover and scale. They also force clarity — if a standard can't be written down clearly, it probably isn't a standard.

**What this rejects.** "Karim handles that." "Ask Joseph, he knows." "We discussed this in a meeting." These can be true short-term answers, but never long-term ones. Either it's documented or it doesn't reliably exist.

---

### 8. Plain English over technical jargon

**What it means.** Tool documentation, intake forms, status pages, error messages, and PR reviews are written in language a non-technical colleague would understand. Code review skills produce plain-English summaries, not technical findings lists. When jargon is unavoidable, it's defined in the glossary.

**Why we believe this.** This studio operates with a non-technical lead (Karim) and serves non-technical staff. Technical jargon excludes people who should be involved. It also masks shallow thinking — explaining something in plain English is harder than hiding behind terminology.

**What this rejects.** Documentation written for engineers by engineers. Error messages that say `ECONNREFUSED 127.0.0.1:5432`. Review processes that require code literacy. The assumption that "users will figure it out."

---

### 9. Hub-first, not domain sprawl

**What it means.** Every internal tool, including the intake form, bug reporter, status page, and admin pages, lives on `hub.fitzrovia.ca`. Per-tool access controls handle visibility. There is one URL, one auth boundary, one mental model.

**Why we believe this.** One mental model is easier to maintain than five. One auth boundary is more secure than five. Per-tool access controls (Microsoft 365 groups, Vercel access groups, Supabase RLS) give us the same governance as separate sites with less complexity.

**What this rejects.** `build.fitzrovia.ca`, `status.fitzrovia.ca`, `admin.fitzrovia.ca`, and the proliferation of internal subdomains that confuses staff and multiplies operational overhead.

---

### 10. The handbook is the source of truth

**What it means.** When in doubt about a standard, skill, or process, the handbook is canonical. If a Microsoft Teams message and the handbook conflict, the handbook wins. If your memory and the handbook conflict, the handbook wins. If something isn't in the handbook, it isn't a standard yet.

**Why we believe this.** Without a single source of truth, every disagreement becomes an argument. With one, disagreements resolve quickly. The handbook also makes the studio survivable — if Karim is hit by a bus tomorrow, Joseph can read the handbook and continue.

**What this rejects.** Decisions made in DMs that never get documented. "I thought we agreed..." conversations that have no resolution. Standards that exist in someone's head but not in writing.

---

### 11. Quality over quantity

**What it means.** Better to ship 3 tools that genuinely transform workflows than 12 tools that are cute but underused. Among ideas that pass the leverage test (Principle 1), we still build the top few well rather than spreading thin. Each shipped tool gets the rigour of design review, code review, security review, and post-launch follow-up. A tool isn't done when it's deployed — it's done when it's actually being used to deliver leverage.

**Why we believe this.** Twelve mediocre tools generate maintenance burden, support requests, and noise. Three excellent tools generate compounding value, become embedded in workflows, and earn trust for the studio. Speed without selectivity is a trap.

**What this rejects.** Vanity metrics like "tools built per quarter." Spreading the studio across too many simultaneous builds. Calling a tool "shipped" when no one is actually using it.

---

### 12. Consistency by design, not by audit

**What it means.** Standardisation is enforced through templates and skills, not through after-the-fact inspection. The Tool Starter forces consistency at the structural level (auth, logging, file structure). The design system enforces consistency at the visual level (colours, typography, components). Skills enforce consistency at the review level (code, UX, security). Standardisation isn't a thing you check for at launch — it's a thing the infrastructure produces by default.

**Why we believe this.** Audit-based standardisation requires constant vigilance and inevitably has gaps. Design-based standardisation works even when no one is watching. The infrastructure is the enforcement mechanism.

**What this rejects.** Checking for consistency after a tool is built, then re-doing the work. Bespoke tooling for every new tool. The fantasy that "we'll standardise it later." We standardise upfront, in the template, or we don't standardise at all.

---

### 13. We are non-technical builders, building like professionals

**What it means.** None of us are professional software engineers. That makes professional output more important, not less. We compensate for our backgrounds by leaning harder on automation, skills, and conventions. CodeRabbit catches what we'd miss in code review. Skills enforce consistent quality across PRs. The Tool Starter handles the patterns we'd otherwise get wrong. The design system prevents inconsistency we wouldn't notice. Code hygiene, security, accessibility, and performance are non-negotiable — even if we need tools to enforce them rather than expertise.

**Why we believe this.** Non-technical builders without infrastructure produce hobbyist output. Non-technical builders with strong infrastructure can produce professional output. The infrastructure is the difference. We invest heavily in skills, templates, and automation precisely because we don't have the luxury of expertise.

**What this rejects.** "We're not coders, so we can be loose with conventions." "It works on my machine, ship it." "We don't need security review because nobody outside Fitzrovia sees this." Lower standards because we're not professional engineers — we hold higher standards exactly because of that.

---

### 14. Launch controls before launch, iterate after

**What it means.** Every tool must clear a defined set of launch controls before it ships, regardless of tier. The specific controls scale with the tool's tier — Tier 2 tools meet a baseline of code review, UX review, activity logging, and access verification; Tier 1 tools additionally require security review, data sensitivity classification, and Corey's sign-off. The launch controls are non-negotiable; iteration applies to features, polish, and refinement after launch, not to the launch controls themselves.

**Why we believe this.** Real usage reveals what theoretical analysis misses. Shipping v1.0.0 with limitations and iterating to v1.2.0 in production is faster than building v1.0.0 with no limitations in isolation. But some things must be right before launch, not iterated into rightness afterward — particularly anything affecting data security, access control, or decision-making accuracy.

**What this rejects.** Six-month build cycles. Comprehensive specs that try to anticipate every edge case before any code is written. Perfectionism dressed up as professionalism. Equally rejected: shipping tools that fail launch controls because "we'll fix it in v1.1." Launch controls are not iteration targets.

---

### 15. Sensitive data stays in tools designed for it

**What it means.** Tenant PII, financial data, board materials, and confidential HR information stay in purpose-built Tier 1 tools or established systems (Yardi, Microsoft 365, secure SharePoint). They never go into personal AI accounts, Linear ticket descriptions, public tool README files, or anywhere not specifically designed and audited for that classification.

**Why we believe this.** A leaked tenant PII record is not "an AI mistake" — it is a Quebec Law 25 violation with real penalties. The studio's value comes from automating work, not from concentrating risk.

**What this rejects.** Pasting board minutes into ChatGPT to "summarise quickly." Using personal Claude accounts for work involving real Fitzrovia data. The casual normalisation of sensitive data in inappropriate channels because it was convenient at the time.

---

## How these principles get used

These principles are not laws. They are the default answers when a specific policy doesn't apply.

**When you face a decision and no specific standard applies**, read the principles, identify which ones are most relevant, and decide accordingly. If the decision sets a precedent worth remembering, capture it in the relevant tool README or PR description so future-you can find the reasoning.

**When a colleague proposes something that conflicts with a principle**, point them at the principle. If they have a good reason the principle should be revisited, propose a change to this document via Pull Request. Principles evolve. They are not sacred.

**When this document gets updated**, the change is logged in the version history below, with the rationale for the change. Principles that get updated frequently are signalling something about the studio — pay attention.
