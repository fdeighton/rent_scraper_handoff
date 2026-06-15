# Glossary

**Path in handbook:** `00-foundations/glossary.md`

**Last updated:** April 30, 2026
**Owner:** Karim Mourad

---

## Purpose

This glossary defines terms used throughout the AI Studio Handbook. When a term needs precision, this is where it lives. When a term feels ambiguous in another document, the answer is here.

Terms are organised into thematic groups for readability. Within each group, definitions are short, precise, and include examples where helpful.

---

## Tool tiers

The tier of a tool determines the rigour of its launch controls, the depth of its review process, and the level of leadership sign-off required.

### Tier 1 tool

A tool that handles sensitive data, supports material business decisions, or is used by leadership.

**Tier 1 tools require, before launch:**
- Pre-PR review process (per `04-standards/pre-pr-checklist.md`) — builder runs `/review` and `/security-review`, walks the checklist, then approver runs the Fitzrovia approver-review skill
- UX review (Fitzrovia UX Review skill)
- Data sensitivity classification per `05-policies/data-classification.md` producing a Red rating
- Deeper security review for Red-classified tools where the `/security-review` built-in is judged insufficient
- Tim Watson sign-off — only on the first tool the studio handles in a new kind of Red personal data; subsequent tools handling the same kind of data follow precedent and Karim approves alone
- Corey's sign-off — only on the first tool the studio handles in a new kind of Red commercial data; subsequent tools handling the same kind of data follow precedent and Karim approves alone
- Full activity logging via `tool_activity_log`
- Documented access controls (Microsoft 365 group, Vercel access group, or Supabase RLS policy)
- RLS at the database level (Red data)
- README documenting purpose, owner, users, retention, and deletion process
- PIA (Privacy Impact Assessment) where required by Law 25/PIPEDA

See `05-policies/data-classification.md` for the full Sign-off model and Karim's discretion to escalate.

**Tier 1 examples:**
- Investor Reporting Drafter (handles financial data, used by leadership)
- Compensation Modeller (handles HR data, supports compensation decisions)
- Tenant Screening Reports (handles tenant PII)
- AGM Package Generator (handles board materials)
- Yardi Insights Dashboard (handles per-property financial performance — Red commercial)

**A tool is Tier 1 if any of these are true:**
- It handles tenant PII, employee PII, or other personal data subject to Law 25/PIPEDA
- It handles building-level financial performance, vendor pricing, cost structures, or per-property operational metrics (Red commercial)
- It is used to make decisions with material financial or legal consequences
- It produces output that goes to external parties (investors, regulators, tenants)
- The data classification is Red (any sub-category)

---

### Tier 2 tool

A tool used internally for productivity, workflow automation, or general business operations. Lower data sensitivity. Lower decision stakes.

**Tier 2 tools require, before launch:**
- Pre-PR review process (per `04-standards/pre-pr-checklist.md`) — builder runs `/review` and `/security-review`, walks the checklist, then approver runs the Fitzrovia approver-review skill
- UX review (Fitzrovia UX Review skill)
- Activity logging via `tool_activity_log`
- Access controls appropriate to the user group
- README documenting purpose, owner, and users
- Karim's sign-off (no Corey sign-off required)

**Tier 2 examples:**
- Rent Comps Scraper (general business data, internal use)
- Maintenance Triage (operational, no PII)
- Yardi Insights Dashboard (aggregated metrics, internal use)
- Construction Status Board (project tracking)

**A tool is Tier 2 if all of these are true:**
- It does not handle PII, financial data, or confidential HR/board information
- It is used for productivity or operational visibility, not material decisions
- Its data classification is Green or Amber (not Red)
- Its audience is internal staff with appropriate access

---

### Edge cases — how to decide tier

Some tools sit on the boundary. Apply this priority order when deciding:

1. **Data trumps audience.** A tool handling PII is Tier 1 even if used by junior staff. A tool used by Corey to view aggregated data is Tier 2 if no sensitive data is involved.

2. **Decision stakes trump complexity.** A simple tool that drives compensation decisions is Tier 1 even if it's just a calculator. A complex tool that produces internal dashboards is Tier 2.

3. **External audience trumps internal scope.** Anything that produces output going to investors, regulators, or tenants is Tier 1.

4. **When in doubt, classify up.** If the tier is genuinely ambiguous, treat the tool as Tier 1. The cost of over-classifying is small (more rigour); the cost of under-classifying can be significant (a Law 25 violation, a financial misstatement).

5. **Document the tier decision** in the tool's README, with the reasoning. Future builders should be able to see why the tier was chosen.

---

## Data classifications

Data classification governs how data is stored, who can access it, and what review depth is required. Every tool's data is classified during the spec phase.

### Green data

General business information with no personal, financial, or confidential dimension.

**Examples:** Aggregated occupancy rates, public market data (rent comps for competing buildings), maintenance ticket volumes, internal metrics that don't identify individuals.

**Implications:** Can flow through Tier 2 tools. Standard activity logging. No PIA required. Standard access controls.

---

### Amber data

Internal business information that should not be shared externally, but where a leak would be embarrassing or operationally inconvenient rather than materially harmful.

**Examples:** Aggregated team-level productivity data (team-level, not individual), project status indicators that don't include budget or financial detail, internal documentation about how teams operate, operational data at a regional or portfolio level that doesn't break down to specific properties.

**Implications:** Tier 2 tools acceptable for handling. Access restricted to relevant staff via Microsoft 365 groups. Activity logging required. Karim approves alone; no Tim Watson or Corey sign-off required. See `05-policies/data-classification.md` for the full criteria.

---

### Red data

Data whose leak would cause material harm to Fitzrovia or to identifiable individuals — legal, regulatory, commercial, or reputational. Red is not only personal information; it covers any data where the consequence of a leak is genuinely material.

Red is split into three sub-categories with uniform controls but different sign-off triggers:

- **Red — personal data.** Information about identifiable individuals subject to Law 25, PIPEDA, contractual obligations, or that could harm specific people. Examples: tenant names + addresses + financial details, employee compensation, performance reviews, credit reports.

- **Red — commercial.** Information whose leak would materially damage Fitzrovia's competitive position, deal-making, or financial position. Examples: building-level financial performance (revenue, NOI, occupancy by property), vendor pricing and contract terms, internal cost structures and margins, operational metrics broken down by property.

- **Red — both.** Tools that handle both kinds of Red data simultaneously.

**Implications (uniform across sub-categories):** Tier 1 tool required. RLS at the database level. Detailed activity logging with quarterly review. Strict access controls via Microsoft 365 groups. README documents purpose, owner, users, retention, and deletion process. Sign-off pattern depends on whether this is the first time the studio handles this kind of Red data — see `05-policies/data-classification.md`'s Sign-off model and the Sign-off model entry below.

---

## Studio roles

### Karim Mourad

Director of Operations & AI Strategy. AI Studio lead. Triages every intake submission. Decides what gets built. Approves all PRs (except his own — those go to Kenny). Is universal admin on every tool by design.

### Kenny

Head of IT. Co-owner of the AI Studio platform. Approves Karim's PRs. Reviews infrastructure and security configurations. Universal admin on every tool. Final sign-off on Tier 1 launch controls related to security, data residency, and access.

### Joseph

Senior Builder. Non-technical vibe coder. Builds tools using the Tool Starter, Claude Code, and Skills. PRs reviewed by Karim and Kenny. Cannot approve his own work.

### Builder 4 / Builder 5

Future hires. Same role as Joseph. Onboarded via the handbook, the Tool Starter, and shadowing on the first 1-2 builds.

### Corey Pacht

EVP. Final sign-off on Tier 1 tool launches. Final override authority on tool prioritisation and executive risk acceptance.

### Adrian Rocca

CEO. Awareness-only stakeholder for the AI Studio. Briefed quarterly on impact and roadmap.

### Tim Watson

Legal counsel. Privacy Officer (post Phase 5). Reviews tools handling personal data. Approves PIAs. Owns Law 25 / PIPEDA breach response.

---

## Technical terms

### Anthropic built-in commands

Commands shipped with Claude Code that are available in every session without any configuration. The two most relevant to the AI Studio are `/review` (general code review) and `/security-review` (general security review). These are the baseline review tooling. Fitzrovia-authored skills layer on top of these built-ins rather than replacing them — see *Skill (overlay)* below.

**In practice:** Builders run `/review` and `/security-review` in Claude Code before opening a PR. The pre-PR checklist enforces this. The Fitzrovia approver-review skill assumes these have already been run and focuses on what they cannot know — Fitzrovia stack, data classification, Law 25/PIPEDA red flags.

---

### API key

A credential that authenticates a tool to a paid external service (Anthropic Claude API, Yardi, OpenAI, Google Maps, etc.). Each Fitzrovia tool that calls a paid API gets its own dedicated key — one key per tool, never shared. Keys are provisioned by Karim or Kenny (builders never mint their own), live in Vercel environment variables for production and `.env.local` for local development, and are subject to monthly spend limits set in the provider's console. Approval scales with projected spend: Karim solo up to $500/month, Karim and Corey jointly above that. Full policy: `05-policies/api-keys-and-secrets.md`.

---

### Approver review (Fitzrovia approver-review skill)

A Fitzrovia overlay skill, run by Karim (or Kenny when reviewing Karim's PRs), to produce a plain-English go/no-go report on a pull request. Implemented as a prompt pasted into Claude.ai, not a Claude Code skill — the approver runs it on the PR diff plus the originating Linear ticket.

**What it does:** Layers Fitzrovia-specific judgement (stack, data classification, Law 25/PIPEDA, requester alignment, `tool_activity_log` usage) on top of what `/review` and `/security-review` have already covered. Produces a structured report with summary, concerns ranked by severity, and an explicit approve/request-changes recommendation.

**Lives at:** `02-skills/approver-review/`.

---

### Branch protection

A GitHub feature that locks down a branch (in our case, `main`) so nobody can push directly to it or skip the review process. Configured at the repo settings level. Even Karim and Kenny can't bypass these rules — they apply to administrators too.

**At Fitzrovia:** `main` is configured to require a PR before merge, require approvals from CODEOWNERS, require status checks (CodeRabbit, build, lint) to pass, require branches to be up to date, disable force-pushes, disable deletions, and apply rules to administrators. The dual-approval requirement for `packages/auth/`, `packages/supabase-client/`, and `packages/activity-log/` is implemented via "Required number of approvals = 2" on PRs touching those paths. Full configuration in `04-standards/branching-and-prs.md`.

---

### Bun

A modern JavaScript/TypeScript package manager and script runner. Faster than npm or yarn for installing dependencies and running scripts. The Fitzrovia monorepo uses Bun exclusively — `bun install` to install dependencies, `bun run <script>` to run scripts defined in `package.json`.

**Why Bun and not npm:** speed matters when builders are running `bun install` multiple times a week and waiting for dev servers to start. Bun is several times faster for both. The monorepo's scripts and tooling are configured around Bun.

---

### CodeRabbit

A GitHub App that auto-reviews pull requests using AI. Configured for the AI Studio with the "Chill" review profile. Catches common code issues without being overly aggressive. Comments appear directly in the PR for human review.

**Used in Fitzrovia to:** provide a baseline code review on every PR before Karim or Kenny does the human review. Sits between the builder's self-review (`/review` + `/security-review` + checklist) and the approver review. Especially valuable for non-technical reviewers who use CodeRabbit's plain-English summaries to make merge decisions. Also configured to block PR merge when the pre-PR checklist's checkboxes are unticked.

---

### CODEOWNERS

A GitHub feature that automatically routes PR review requests based on which files a PR touches. The `.github/CODEOWNERS` file in the monorepo lists which paths require which approvers. When a PR is opened, GitHub reads CODEOWNERS, identifies the affected paths, and auto-requests review from the right people.

**Used in Fitzrovia to:** enforce path-specific approval rules without builders having to remember them. For example, PRs touching `packages/auth/` automatically request review from both Karim and Kenny because that path is configured for dual approval. The full configuration for the foundation phase and steady state lives in `04-standards/branching-and-prs.md`.

---

### CI (Continuous Integration)

An automated process that runs every time code is pushed to GitHub. Runs a series of checks against the code — does it compile, do the tests pass, does it match the style rules, are the database migrations valid — and reports back on the PR. If any check fails, the PR shows a red X and cannot be merged until the issue is fixed and the checks re-run.

**Used in Fitzrovia to:** enforce mechanical rules without human attention. CI runs ESLint, type-checking, build verification, and (eventually) tests on every PR. The configuration lives in the repo's `.github/workflows/` directory and is documented in `04-standards/ci-configuration.md` (post-foundation). CI is one of the "automation does the mechanical work" layers in the verification architecture described in `04-standards/pre-pr-checklist.md`.

---

### Design system

Fitzrovia's canonical visual and interaction language, documented in `01-design-system/design-system.md`. Defines colors (navy, orange, light blue, dark grey + neutrals), typography (Poppins family), spacing scale, error contract, labelled-vs-icon-only rule, layout rules, and iconography (Lucide). Every Fitzrovia tool inherits this system. The system is the *style layer* — it says how things look and feel, not what to build. Component-specific designs (e.g., the support widget) apply the system but are not part of it.

### Diff

The list of changes between two versions of files. When code is changed, Git tracks exactly what was added and what was removed, line by line. The "diff" is that list — short for "difference."

**In practice:** when opening a PR on GitHub, the "Files changed" tab shows the diff visually — added lines highlighted in green, removed lines highlighted in red. Reviewers scroll through to see what changed without having to compare files manually.

**Why it appears in handbook documents:** several places reference "scrolling through the diff" or "the PR's diff" — that's what they mean.

---

### ESLint

An automated code-quality checker for JavaScript and TypeScript. Configured once with rules — "don't allow unused variables," "don't allow imports from other apps," "always use the `@fitzrovia/<package>` alias instead of relative paths" — and from then on, every line of code that breaks a rule gets flagged. Rules can be set to warn (visible but doesn't block) or error (blocks the build).

**Used in Fitzrovia to:** enforce import discipline and other mechanical rules from the codebase organization standard. Instead of asking a human reviewer to scan a 200-line PR for cross-app imports, ESLint catches them automatically. Runs both on the developer's laptop while coding (catches issues immediately) and again in CI on PR open. The Fitzrovia-specific ESLint configuration is documented in `04-standards/ci-configuration.md` (post-foundation).

---

### Environment variable (`.env.local`, `env.example`)

Configuration values a tool needs to run — API keys, database URLs, authentication tokens. They never go in code (they'd leak to GitHub) and never in production with the development copy of the laptop.

The Fitzrovia three-tier model:

- **`.env.local`** — Per-builder file on each laptop, gitignored, holds real values for local development. Each builder maintains their own.
- **`env.example`** — Committed to the repo in each app folder. Lists the env vars the tool needs with placeholder values. Used as a template — a new builder copies it to `.env.local` and fills in real values from the password vault.
- **Vercel dashboard** — Holds production env vars. Set once per app by Karim or Kenny. Vercel injects these when production deployments run. Builders never have direct access to production env vars.

This separation exists because credentials need to be rotatable independently of code. Full operational detail in `06-operations/development-setup.md`.

---

### Error contract

Three platform-wide rules every Fitzrovia tool's error handling follows: (1) say what to do, not just what went wrong — every error message ends on a verb the user can act on; (2) never lose the user's input — drafts persist through network errors, attachment failures, and accidental dialog close; (3) validate at the earliest moment that's helpful — file too big fires on pick, empty required field fires on submit attempt. Documented in `01-design-system/design-system.md`. Originated in the support widget design but elevated to platform-level because it applies everywhere.

### Foundation phase

The period from Friday's payment until Joseph is review-capable (~2-3 months). During this phase, only Karim and Kenny are approvers — Karim is also the most prolific builder (building the three foundation tools), and Kenny is his only available reviewer for non-IT-critical code.

The foundation phase is intentionally bounded. It ends when Joseph is added as a third approver per the steady-state CODEOWNERS configuration. The transition is a deliberate decision documented in the decision log. See `04-standards/branching-and-prs.md`'s "When Joseph becomes review-capable" section.

The opposite of foundation phase is *steady state* (see entry).

---

### Foundation tools

The first three tools the AI Studio builds: the landing page, the tool selection page, and the intake form — all hosted on `hub.fitzrovia.ca`. Karim builds these by hand, before the Tool Starter exists, because the Tool Starter is extracted *from* these tools rather than written before them.

The reason: a starter template only encodes patterns that have proven themselves. Building the starter before any real tool exists would be guessing. The right order is build the foundation tools properly, identify what worked, and crystallize that into the Tool Starter for every tool that follows.

After the third foundation tool ships and patterns have stabilised, the Tool Starter is extracted into `fitzrovia-residential/tool-starter` and the standard generator-based process becomes the default. From that point, every new tool — including Joseph's first build — uses the generator. See `04-standards/codebase-organization.md` for full detail.

---

### GitFlow

A branching strategy from 2010 where teams maintain multiple long-lived branches at the same time — `main` (production), `develop` (in-progress work), `release/*` (versions being prepared to ship), and `hotfix/*` (emergency fixes). Every change traverses several branches before reaching production.

**Why this is in the glossary:** Fitzrovia explicitly does **not** use GitFlow. We use trunk-based development (see entry). The term appears in `04-standards/branching-and-prs.md` as the thing being rejected. GitFlow makes sense for software released on schedules where there's a manual coordination step between "code complete" and "shipped." Vercel auto-deploys `main` for us, so there's no schedule to coordinate around. GitFlow's overhead would be pure tax with no benefit at our scale.

---

### Hub (`hub.fitzrovia.ca`)

The single entry point for all AI Studio tools. Hosts the tool selection page, the intake form, the bug reporter, the AI Studio status page, and the platform admin section. Every internal AI tool is accessed through the hub.

---

### Layered review model

The three-stage review pipeline every PR goes through before merging:

1. **Builder self-review** — builder runs `/review` and `/security-review` in Claude Code, then walks the pre-PR checklist for Fitzrovia-specific items (RLS, activity logging, data classification, requester alignment).
2. **CodeRabbit** — auto-review on PR open, posts plain-English findings as PR comments.
3. **Approver review** — Karim (or Kenny for Karim's own PRs) runs the Fitzrovia approver-review skill in Claude.ai on the PR diff plus the originating Linear ticket.

Each stage has a different audience and catches different problems. The full explanation lives in `02-skills/README.md`.

---

### Lucide

Open-source icon library used as Fitzrovia's default icon system. ~1,500 icons, 1.5px stroke weight, MIT licensed, standard in the React/Next.js ecosystem. Locked in May 6, 2026 during design system v1.0.0 authoring. See `01-design-system/design-system.md` "Iconography" section. Override possible if a real need surfaces (e.g., a tool needs an icon Lucide doesn't have), but Lucide is the default every Fitzrovia tool inherits.

### Microsoft 365 group

A group defined in Microsoft Entra (Azure AD) used to control access to tools at the user-identity level. Adding someone to the `ai-studio-builders` group grants them access to builder-only tools. Removing them revokes it.

**Used in Fitzrovia to:** define who has access to each tool without rebuilding access logic per tool. The Tool Starter integrates with Microsoft 365 groups by default.

---

### Monorepo

A single Git repository that holds multiple projects (or "apps") together, plus shared code that those projects use. Contrasts with "polyrepo" — one project per repository. At Fitzrovia, the monorepo is `fitzrovia-residential/fitzrovia-tools` and contains every internal AI Studio tool as a folder under `apps/`, plus shared code under `packages/`.

**Why monorepo:** so that shared concepts (Building, Tenant, Employee) are defined exactly once in `packages/shared-entities/` and imported by every tool, instead of being duplicated across separate repos and drifting over time. Also makes it possible to update a shared schema with a single PR rather than coordinating version bumps across multiple repos. Detailed reasoning and rules are in `04-standards/codebase-organization.md`.

---

### PIA (Privacy Impact Assessment)

A structured analysis of a tool's privacy implications. Required by Quebec Law 25 for tools handling personal information of Quebec residents. Owned by Tim Watson. Template in `05-policies/law-25-pipeda.md`.

**Required when:** a tool handles tenant PII, employee PII, or any other personal data subject to Law 25 / PIPEDA.

---

### Pre-PR checklist

The canonical pre-PR review checklist at `04-standards/pre-pr-checklist.md`. Enforces that builders run `/review` and `/security-review` before opening a PR, and adds Fitzrovia-specific checks (RLS enabled where required, `tool_activity_log` writes for personal data, data classification documented, requester alignment confirmed).

**Mirrored in:** `.github/PULL_REQUEST_TEMPLATE.md` in every tool repo, as a checkbox list the builder physically completes when opening a PR. The Tool Starter ships with this template pre-installed.

---

### RLS (Row-Level Security)

A Supabase / PostgreSQL feature that restricts which rows of a database table a user can see or modify based on their identity. Enforces access control at the data layer rather than only at the application layer.

**In practice:** A tenant screening tool with RLS will return only the screening records that the logged-in user is authorised to see. Even if the application has a bug that requests more, the database refuses.

**Used in Fitzrovia tools to:** enforce per-tool access without relying on application logic. RLS is the safety net.

---

### Shared entity

A type or concept that represents a real-world Fitzrovia thing — Building, Unit, Tenant, Employee, Vendor, Property — and is defined exactly once in `packages/shared-entities/` rather than duplicated across multiple tools.

**The principle:** every tool that needs to talk about Buildings imports the canonical Building type from `packages/shared-entities/`. Tools never define their own version. If a tool needs Building plus extra fields, it extends the canonical type rather than redefining it. This prevents drift — five tools, five subtly different Building shapes — which is the failure mode that breaks codebases over years.

**What qualifies as a shared entity:** something that represents a real-world Fitzrovia concept (not a tool-specific construct), appears in two or more apps, and has a single source of truth elsewhere (typically Yardi). Detailed criteria and the "extend, don't redefine" rule are in `04-standards/codebase-organization.md`.

---

### Sign-off model

The pattern by which Tim Watson and Corey are pulled into Red tool sign-offs. The principle: **sign-offs scale with novelty, not volume.** Tim and Corey sign off on the *first* tool the studio handles in a new kind of Red data — not every Red tool. Subsequent tools handling the same kind of Red data follow the precedent, and Karim approves alone.

- **Tim Watson** signs off on the first tool the studio handles in a new kind of Red personal data (e.g. tenant PII the first time, employee compensation the first time). Subsequent tools handling the same kind of personal data inherit the precedent.

- **Corey** signs off on the first tool the studio handles in a new kind of Red commercial data (e.g. per-property financials the first time, vendor pricing the first time). Subsequent tools inherit the precedent.

Karim retains discretion to pull Tim or Corey in regardless of whether the rule technically requires it, and the responsibility to escalate when something genuinely warrants additional review even if it falls within an existing precedent. Full operational detail in `05-policies/data-classification.md`.

---

### Skill (overlay)

A reusable, versioned prompt or instruction set authored by Fitzrovia and stored in `02-skills/` of this handbook. Each skill has its own folder with a README, a prompt or SKILL.md, and example inputs/outputs.

**How skills are invoked depends on the skill:**
- Some are **Claude Code skills** (SKILL.md files) that builders invoke in their Claude Code session — these typically extend builder workflows.
- Some are **Claude.ai prompts** (prompt.md files) that someone pastes into a chat — the approver-review skill works this way because the approver doesn't run Claude Code.

**Most Fitzrovia skills are overlays.** They add Fitzrovia-specific context (stack, data classification, governance, compliance) on top of Anthropic built-ins or general engineering practice. They do not duplicate what built-ins like `/review` and `/security-review` already cover. The principle: teach Claude what it doesn't already know.

**Examples:** Fitzrovia approver-review (overlay on `/review` + `/security-review`), Fitzrovia Intake Triage (no built-in equivalent), Fitzrovia UX Review (overlay on Anthropic's frontend-design skill).

---

### Steady state

The phase after Joseph is review-capable (~2-3 months post-onboarding), in which Joseph is added as a third approver for `apps/*` and non-IT-critical packages alongside Karim and Kenny. This solves the foundation-phase bottleneck where Karim's PRs would otherwise pile up waiting for Kenny.

In the steady state, IT-critical packages (`packages/auth/`, `packages/supabase-client/`, `packages/activity-log/`) still require Karim and Kenny — Joseph never approves these. The steady state is "approval scaled to the team," not "everyone approves everything."

The transition from foundation phase to steady state is a deliberate decision documented in the decision log. It happens when Joseph has shipped a few of his own PRs through Karim/Kenny review, has demonstrated competent review judgement, and Karim and Kenny both agree he's ready. See `04-standards/branching-and-prs.md`'s "When Joseph becomes review-capable" section.

The opposite of steady state is *foundation phase* (see entry).

---

### Support widget

An in-tool "Report an issue" feature that every Fitzrovia tool will include. Users click a Support button (typically in the header or footer), fill in a short form (free-text description, optional screenshot), and submit. The form auto-captures which tool, which page, and which user.

**Submissions are routed to three places:**

- The `ai-studio-support` Teams channel for Karim and Kenny's triage
- A dedicated email inbox as backup
- A Supabase log (`support_submissions` table) for searchability and metrics

The widget lives in `packages/support-widget/` so every tool inherits the same support flow without rebuilding it. It is extracted into the Tool Starter so every new tool inherits it automatically. Karim and Kenny triage submissions from the Teams channel and route them: incidents trigger the incident response playbook (see `05-policies/incident-response.md`); bugs become Linear tickets in the AI Studio queue; misunderstandings get a direct reply.

**Status:** to be built during the foundation phase. Configuration and build steps in `! handbook configuration list/handbook-configuration-list.md`.

---

### Tool activity log (`tool_activity_log`)

A standard PostgreSQL table that every tool writes to whenever a user performs an action. Captures who did what, when, with what input, and what output. Provides the audit trail required for Tier 1 tools and the visibility required for cost monitoring.

**Schema:** `id`, `timestamp`, `user_email`, `tool_name`, `action`, `input_summary`, `output_summary`, `metadata` (JSONB).

**Used by:** Karim and Kenny via the Operations dashboard on the hub. Inspected during incident response, cost reviews, and quarterly impact assessments.

---

### Tool Starter

A Next.js + Supabase + Tailwind + shadcn/ui template repository. Pre-wired with SSO, activity logging, universal admin pattern, design tokens, standard error handling, and the pre-PR pull request template. Lives at `github.com/fitzrovia-residential/tool-starter`.

**Used by:** every new tool. Builders clone the starter as the basis for new builds. Ensures structural consistency from day one.

---

### Trunk-based development

A branching strategy where there's one main branch (`main`) that's always deployable, and everyone's work merges back into it via short-lived feature branches. Contrasts with GitFlow (see entry), which maintains multiple long-lived branches simultaneously.

**Used in Fitzrovia because:** Vercel auto-deploys `main`, so the merge to `main` *is* the release. There's no separate release coordination step that would benefit from a `develop` or `release/*` branch. Trunk-based fits this model and avoids ceremony. Detailed rules are in `04-standards/branching-and-prs.md`.

**What "short-lived" means at our scale:** branches are scoped to one logical change, not bounded by calendar time. A bug fix branch lives a few hours. A new tool branch can live for weeks because Fitzrovia's builders are part-time and a real new tool takes time. The discipline is "is this branch doing one thing?" — not "how long has this been alive?"

---

### Vercel preview deployment

A temporary deployment Vercel automatically creates for every PR, accessible at a unique URL like `intake-portal-aisXX-init-intake-portal.vercel.app`. The URL is fully functional — every interaction works the same as production — connected to development data, accessible only via SSO.

**Used at Fitzrovia as the primary testing environment.** When a builder opens a PR, the Vercel preview link is what gets attached for review. The approver clicks the link and tests the tool in their browser as part of approval — they don't approve based on code reading alone. The requester (e.g. someone in Finance who asked for a feature) also tests via the preview link before the PR merges, confirming the change does what they asked. Production deployment happens when the PR merges to `main`. See `04-standards/branching-and-prs.md`'s "Testing before merge" section.

---

### Vercel access group

A Vercel-level mechanism for restricting which deployment environments a user can see. Used to keep tools that aren't yet ready for general staff hidden from the hub's tool list for those users.

**Used in Fitzrovia to:** control visibility of beta tools, admin tools, and Tier 1 tools restricted to specific business groups.

---

## How this glossary is maintained

When a new term enters common use in the handbook or in studio operations, it gets added here. The trigger to add a definition is: "I had to explain this term twice."

When an existing term changes meaning (because the studio's practices evolve), the definition is updated. The update history at the bottom of this document tracks the change.

When a term becomes obsolete, it stays in the glossary but is marked as deprecated, with a note explaining what replaced it. Definitions are not deleted — they are part of the historical record.
