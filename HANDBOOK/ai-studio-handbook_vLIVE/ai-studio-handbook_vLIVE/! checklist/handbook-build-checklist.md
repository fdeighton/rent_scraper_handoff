# AI Studio Handbook — Build Checklist

**Purpose:** Track which parts of the handbook are drafted, in review, or live.
Use this as the working roadmap until the handbook itself is the source of truth.

**Last updated:** May 18, 2026 (post AIS-11 merge)
**Owner:** Karim Mourad
**Version:** v3.9

---

## What changed in v3.9

- **AIS-11 (PR #7, May 18) shipped** — Submit-a-Tool-Request live at `/tools/request`. Six-batch journey (1, 2, 3a, 3b, 3c, 3d) plus three infra follow-up commits resolved (a) Vercel's 4.5 MB function payload limit by switching to direct-from-client uploads via Supabase signed upload URLs, (b) the `NEXT_PUBLIC_*` env var inlining failure inside `@fitzrovia/supabase-client` by refactoring to the explicit-pass pattern (env vars read in `apps/hub/`, passed to package factories as explicit arguments), and (c) a MIME allowlist enforcement gap surfaced by `/security-review` (commit `10a4f2b`) — sniffStoredFile was detecting true MIME via magic bytes but not rejecting non-allowlisted types. Merge commit `fa03dc7`. 14 commits, +2,274 lines.
- **Foundation tools now:** hub landing page + `/tools` selection + `/tools/request` form, all in `apps/hub/`. The form genuinely works end-to-end; staff signed into the Vercel auth wall can submit requests with attachments and files land in Supabase Storage at `submissions/<email-slug>/<uuid>/<safeFilename>`. The Linear ticket creation step is stubbed (returns `STUB-<timestamp>`); real `issueCreate` + `attachmentCreate` lands in AIS-15 (batch 4).
- **`Part of AIS-X` auto-transition correction.** AIS-11 used `Part of AIS-11` in its PR description and auto-transitioned to Live on merge anyway, contradicting the keyword-dependence hypothesis recorded in v3.7. The hypothesis was based on a single failed observation (AIS-7) and three subsequent confirmations that don't actually validate it (AIS-8/9/10 only proved `Closes` works, not that `Part of` fails). AIS-7's failure was likely due to integration setup, not keyword choice. `04-standards/branching-and-prs.md` rewritten to reflect actual behavior: auto-transition fires on any merged PR linked to the ticket; keyword is a semantic signal for humans, not a gate for the automation.
- **Linear plan clarified as Free.** Earlier checklist versions implied Linear was in the May 1 paid wave. Actual paid platforms: GitHub Team, Vercel Pro, Supabase Pro, Claude Teams, CodeRabbit Pro. Linear is on Free, which means every workspace member is automatically Admin (no role differentiation possible). Joseph stays Admin as a deliberate accepted limitation. Upgrade trigger: 3+ active users + role differentiation matters + budget allows (~$24/mo for 3 users at Standard $8/user/mo).
- **`apps/admin/` locked in** as the future home for admin views (usage dashboards, cost analytics, builder activity feeds, request triage dashboards beyond Linear). Different audience and design intent from `apps/hub/`. The `tool_activity_log` schema is the data precursor; build deferred. Subdomain pattern (`admin.fitzrovia.ca` vs `admin.aistudio.fitzrovia.ca`) decides alongside the hub subdomain.
- **Mobile spot-checks dropped from the foundation-phase pattern** (Karim preference). Foundation tools are desktop-first staff workflows; mobile remains untested by design until a tool explicitly needs it.
- **Three follow-up tickets opened in Linear backlog:** AIS-15 (Batch 4 — Linear API integration, the PR that genuinely completes AIS-11's intent), AIS-14 (Install Vitest + backfill tests for AIS-11 helpers; foundation-phase tests gap), AIS-16 (AIS-11 polish — LOW-severity findings deferred from `/review`).
- **`04-standards/codebase-organization.md` patched** to add the workspace package env var rule under "Imports and module boundaries" — packages don't read `process.env` directly; consuming apps read and pass explicitly to package factories. The rule reflects the AIS-11 explicit-pass discovery.
- **`06-operations/supabase-setup.md` patched** with the legacy JWT vs new key format gotcha — `SUPABASE_SERVICE_ROLE_KEY` must be the legacy `eyJ…` JWT format for signed-URL operations; the new `sb_secret_…` format triggers "Invalid Compact JWS" errors.
- **`06-operations/vercel-setup.md` patched** with two operational gotchas — Vercel build cache silently masking env var changes (uncheck "Use existing Build Cache" on manual redeploys), and the 4.5 MB function payload limit on Pro tier (direct-from-client uploads bypass it).
- **Foundation-phase admin bypass exercised on IT-critical path.** PR #7 touched `packages/supabase-client/` (an IT-critical path that nominally requires both Karim AND Kenny approval). Merged via `gh pr merge 7 --admin --merge` per the foundation-phase exception. PR description notes the changes for Kenny's retroactive review when he ramps up.
- **Configuration list updated to v1.5.0** with full AIS-11 outcomes, Linear plan clarification, `apps/admin/` lock-in, new follow-up tickets, and the operational gotchas captured above.

## What changed in v3.8 (carried forward)

- **AIS-10 (PR #6, May 8) shipped** — repo housekeeping bundle: ESLint with proper Next.js integration (resolves the soft warning carried since AIS-7), Prettier with `prettier-plugin-tailwindcss`, Husky + lint-staged pre-commit hook ("Standard" strictness — block on ESLint errors only, TypeScript runs in CI), `.coderabbit.yaml` with Fitzrovia path filters and CLAUDE.md as knowledge base, Linear ↔ CodeRabbit OAuth integration. Single PR, five batches (commits abe4a1f, ee3e3e5, 4324bc1, 2604f1c, 82fb4d0), merged via foundation-phase admin bypass at 124f3d2.
- **Closes-keyword convention LOCKED** — three consecutive validations: AIS-8 (May 7), AIS-9 (May 8), AIS-10 (May 8). All three auto-transitioned to Live in Linear via `Closes AIS-X`. Pattern is reliable for all future single-PR tickets. Build-checklist references can now treat this as a fact, not a hypothesis.
- **AIS-10 process near-miss caught by `/approver-review`.** PR #6 was originally framed `Part of AIS-10 (1/N batches)` from batch 1 — the "batches" referred to commit groupings within the PR, but the keyword would have meant Linear didn't auto-transition. The Fitzrovia approver-review skill flagged this as should-fix-pre-merge under the Process dimension; corrected to `Closes AIS-10` before merge. Skill earned its keep.
- **Approver-review skill patch flagged.** The skill's flag also cited "PR #5 missed the auto-transition" — actually PR #3 (AIS-7) was the one that missed it; PR #5 worked correctly. Tracked as a small future patch in the configuration list.
- **CodeRabbit auto-detection of CLAUDE.md confirmed** end-to-end on PR #6 (and retroactively on PRs #4 and #5). Auto-detection works as documented; AIS-10 added explicit `knowledge_base.code_guidelines.filePatterns` as defense-in-depth.
- **Vercel preview SSO verified** end-to-end (V4 incognito check passed via email magic-link login). Note: configured as "Vercel team members only", not literal `@fitzrovia.ca`-domain — non-builder pilot will need access-model expansion.
- **Pre-commit DX improved**: ~10s+ → ~1–2s on a typical single-file commit. Compounding gain over hundreds of future commits.
- **Discoveries logged** in v3.8: `@typescript-eslint/no-unused-vars` is `warn` not `error` in `next/typescript` (so unused vars don't block commits — Standard strictness, intentional); long branch names (>44 chars) get auto-truncated/hashed by Vercel into hashed preview URLs (don't construct preview URLs by hand — read from Vercel-bot comment).
- **Configuration list updated to v1.4.0** with full AIS-10 outcomes, the new "Open future migrations" section (5 items), and three-in-a-row convention validation.

## What changed in v3.7 (carried forward)

- **Foundation-phase build executed** May 5–8: five PRs merged covering AIS-5 (CLAUDE.md, PR #1), AIS-6 (monorepo scaffolding, PR #2), AIS-7 (`apps/hub/` landing page + design system v1.1.0 materialization, PR #3), AIS-8 (housekeeping — re-copied approver-review skill, `bun.lockb`→`bun.lock` patch, `Closes AIS-X` PR convention introduced, design-system sync checkbox added, PR #4), AIS-9 (`apps/hub/` `/tools` page + mock session provider + sign-in stub redirect, PR #5).
- **Approver-review skill is shipped and used in production.** `02-skills/approver-review/` flipped from "Not started" to drafted + in active use; the skill ran on every foundation-phase PR review. Stale-path reference fixed May 7 (canonical token location is `packages/design-system/src/tokens.css` in-repo, not `01-design-system/colors_and_type.css`); skill re-copied into the repo at `.claude/skills/approver-review/SKILL.md` in AIS-8.
- **`04-standards/branching-and-prs.md` patched twice** — v1.0.2 added the `Closes AIS-X` closing-keyword paragraph (May 7); v1.0.3 added the validation history (May 8) after AIS-8 and AIS-9 both auto-transitioned to Live on merge. Convention is now reliable.
- **Design system materialized in-repo at v1.1.0.** AIS-7 corrected divergences from the previous in-repo v1.0.0 (naming + palette) to bring the package into alignment with the canonical handbook spec. Hero-display sanctioned exception added to the design system.
- **Vercel region correction recorded.** Foundation work confirmed the Vercel region is `yul1` (Toronto), NOT `cle1` (Cleveland) as the v3.6 checklist incorrectly stated. `cle1` references corrected throughout.
- **Linear `merge → Live` mapping understanding refined and validated.** Auto-transition is keyword-dependent (`Closes AIS-X` / `Fixes AIS-X` / `Resolves AIS-X` only). AIS-7's PR #3 used `Part of AIS-7` and didn't auto-transition (manual flip required). Convention switched to `Closes AIS-X` for single-ticket PRs; AIS-8 (May 7) and AIS-9 (May 8) both validated the new convention. Pattern locked.
- **Mock session provider pattern established** as the foundation-phase auth-stub pattern. `apps/hub/src/contexts/session-context.tsx` shape matches what Microsoft Entra will return (AIS-10), so the swap is isolated to the provider implementation.
- **`PageHeader` identified as platform-header candidate** — sticky chrome (wordmark + breadcrumb + user avatar + sign-out) currently lives in `apps/hub/src/components/tools/`. Lift to a shared package only when a second app needs it; premature abstraction risk.
- **Decisions captured during the build phase:**
  - Foundation-phase admin bypass remains active until the first tool ships to production (Karim self-merges his own PRs while Joseph isn't yet review-capable; Kenny isn't an active reviewer)
  - Builders use real data during build phase, not test data (deliberate)
  - "Good enough" cleanup threshold rule for CodeRabbit nits (don't death-spiral on minor findings; reply with skip-reason in PR thread)
  - Triage findings explicitly (Fixed / Deferred / Skipped with reasons) for every CodeRabbit + `/review` + `/security-review` output
  - Support widget timing deviation accepted in principle: hub shipped before the widget; revisit retrofit-vs-defer at AIS-X scope
- **Configuration list updated to v1.3.0** with full Foundation tools section, AIS-7 + AIS-9 specifics, mock session pattern, the closing-keyword convention validation, and Vercel region correction.

## What changed in v3.6 (carried forward)

- CodeRabbit org-level setup completed Monday May 4. Pro Plus 14-day trial active until May 18 (auto-converts to Pro $30/mo monthly billing). Profile set to Chill, critical safety toggles confirmed (Request changes workflow OFF, Auto assign reviewers OFF).
- New document `06-operations/coderabbit-setup.md` v1.0.0 captures the configuration with rationale and a watchlist of settings to revisit after real PRs.
- Configuration list v1.2.8 reflects full CodeRabbit state plus the deferred Linear integration (Wednesday) and the Pro Plus trial conversion decision (May 16 calendar reminder).
- All five paid platforms now configured at org level: GitHub, Vercel, Supabase, Claude Teams, CodeRabbit. Phase 1 of the platform layer is done.

## What changed in v3.5 (carried forward)

- Karim completed commit signing setup; new `06-operations/commit-signing-setup.md` v1.0.0 written.

## What changed in v3.3 (carried forward)

- Vercel "Require Verified Commits" enabled May 1 cascade across configuration list, development-setup.md milestone 7, and this build checklist's post-payment section.

## What changed in v3.2 (carried forward)

- Added four 🟠 High items to `06-operations/`: `github-setup.md`, `vercel-setup.md`, `supabase-setup.md`, `coderabbit-setup.md`
- Friday May 1 payment meeting: GitHub Team, Claude Teams, Vercel Pro, Supabase Pro all paid. CodeRabbit deferred to Monday May 4.

## What changed in v3.1 (carried forward)

- Dropped `08-meta/` entirely from handbook structure
- Top-level `CHANGELOG.md` removed
- Per-skill `CHANGELOG.md` files removed
- All `08-meta/` references stripped from existing documents

## What changed in v3.0 (carried forward)

- Major version bump: v3.0 marked completion of v1 of the AI Studio handbook
- `05-policies/acceptable-use.md` patched to v0.2 with IP / code ownership section

## What changed in v2.9 (carried forward)

- `05-policies/incident-response.md` patched to v1.0.3
- Decision captured: AI Studio internal tools briefly being unavailable is normal operating reality, not an event requiring escalation

## What changed in v2.8 (carried forward)

- `05-policies/incident-response.md` patched to v1.0.2. Removed "current state vs future state" framing
- `! Checklist/handbook-configuration-list.md` updated to v1.2.1 with support widget items promoted from foundation phase to first foundation tool

## What changed in v2.7 (carried forward)

- `05-policies/incident-response.md` patched to v1.0.1 with eight refinements
- `! Checklist/handbook-configuration-list.md` updated to v1.2.0 with Support Widget Infrastructure section
- Decision captured: every Fitzrovia tool will include a Support widget

## What changed in v2.6 (carried forward)

- All three remaining policies complete: `access-control.md` v1.0.2, `incident-response.md` v1.0.0, `acceptable-use.md` v0.1
- The 05-policies folder is done for v1 of the handbook (four documents)

## What changed in v2.5 (carried forward)

- Two policies dropped: `law-25-pipeda.md` and `personal-ai-policy.md`
- Three policies remained to draft (now all complete)
- AUP scope clarified to AI-Studio-specific

## What changed in v2.4 (carried forward)

- `06-operations/development-setup.md` complete (v2.0.1) — Major rewrite from v1.0.0 reflecting the Claude-Chat-as-navigator workflow at Fitzrovia, then v2.0.1 patch adding rationale per milestone. Windows-only, Microsoft 365 environment.
- `05-policies/data-classification.md` complete (v1.0.1) — Red broadened to "data whose leak would cause material harm." Three Red sub-categories with sign-off model.
- `00-foundations/glossary.md` updated to v1.3.0
- Pure-checkbox appendix added

## What changed in v2.3 (carried forward)

- `04-standards/pre-pr-checklist.md` complete (v2.0.0, then v2.0.1 patch). Major rewrite from v1.0.0 (~25 items) to seven non-code judgement items.
- New 🔴 `04-standards/ci-configuration.md` — post-foundation Critical document
- New 🔴 `04-standards/coderabbit-configuration.md` — post-foundation Critical document
- Decision captured: verification at Fitzrovia is layered

## What changed in v2.2 (carried forward)

- `04-standards/codebase-organization.md` complete (v1.0.4)
- `04-standards/branching-and-prs.md` complete (v1.0.1)
- Foundation/steady-state approval model with Joseph as third approver post-onboarding
- Karim builds first three foundation tools by hand; Tool Starter extracted afterward
- Three skills moved from pre-payment Critical to "before Joseph onboards"

## What changed in v2.1 (carried forward)

- Three 🔴 Critical documents added in response to Joseph's architecture questions
- Pre-payment work reordered

## What changed in v2 (carried forward)

- Status updated for items already drafted
- `runbook-v2.md` removed from `00-foundations/`
- `02-skills/code-review/` replaced with the layered review model
- `02-skills/security-review/` removed (handled by Anthropic's `/security-review`)
- New 🔴 `04-standards/pre-pr-checklist.md` — canonical pre-PR checklist
- New 🟠 `.github/PULL_REQUEST_TEMPLATE.md`

---

## Legend

- `[ ]` Not started
- `[~]` Draft in progress
- `[R]` In review (drafted, awaiting refinement)
- `[x]` Complete and committed to handbook

**Priority tags:**
- 🔴 **Critical** — Must exist before first tool is built
- 🟠 **High** — Must exist before first tool ships to staff
- 🟡 **Medium** — Important but can wait until after soft launch
- 🟢 **Low** — Nice to have, draft as needed

---

## Top-level files

- [x] 🔴 `README.md` v0.3 — Handbook landing page (what it is, how to navigate, who maintains)
- [ ] 🟠 `CONTRIBUTING.md` — How to propose changes to the handbook (referenced by README, not yet drafted)

---

## 00-foundations/

Strategic and conceptual baseline.

- [x] 🔴 `roadmap-v20.md` — Roadmap reconciled with handbook decisions (consolidation onto hub.fitzrovia.ca, layered review model)
- [x] 🔴 `operating-principles.md` v1.2.0 — 15 principles
- [x] 🟠 `glossary.md` v1.3.0 — Tier 1/2 tools, data classifications, studio roles, technical terms, layered review model

> Note: `runbook-v2` is not migrated to markdown. The HTML/Word version remains the source of truth — it's reviewed, leadership-facing, and migration is mechanical work that doesn't unblock anything.

---

## 01-design-system/

The Fitzrovia design system.

- [ ] 🟠 `tokens.md` — Colours, fonts, spacing, radii (rough draft acceptable for v1.0)
- [ ] 🟡 `components.md` — Standard components and usage
- [ ] 🟡 `voice-and-tone.md` — Writing guidelines
- [ ] 🟡 `claude-design-config.md` — How Claude Design is configured for Fitzrovia

---

## 02-skills/

All Fitzrovia-specific Claude skills, versioned individually.

> **Code review architecture (key context):**
>
> Anthropic ships built-in `/review` and `/security-review` commands in Claude Code. These cover general engineering and security review. Fitzrovia does **not** need to draft a from-scratch code review skill.
>
> Instead, the layered review model is:
>
> 1. **Builder self-review** — Builder runs `/review` and `/security-review` in Claude Code, then walks through `04-standards/pre-pr-checklist.md` for Fitzrovia-specific items. *No skill required — the built-ins plus the checklist do the job.*
> 2. **CodeRabbit** — Runs automatically on PR open. Configured separately, not a handbook skill.
> 3. **Approver review** — Karim runs the `approver-review` skill (a prompt pasted into Claude.ai) on the PR diff + ticket to produce a plain-English go/no-go report. This is the only review skill the handbook drafts from scratch.

- [ ] 🟠 `README.md` — Index of all skills, plus the layered review model explained above

### Tier 1 skills (before Joseph onboards, after foundation tools ship)

> **Timing change in v2.2:** These were originally Critical pre-payment items. With Karim building the first three foundation tools himself, the urgency shifted. Karim is also the approver for foundation-phase PRs and writes his own intake/spec thinking, so the skills' absence doesn't block foundation work. They become Critical *before Joseph onboards* — Joseph needs the approver-review skill to be reviewable, the intake-triage skill to handle his triage of staff submissions, and the tool-spec skill when he picks up his first ticket. Target: drafted during the foundation tools build, ready by the time Tool Starter is extracted.

- [x] 🔴 `approver-review/` — Plain-English go/no-go review of PRs for the non-technical approver. **Drafted, in active use as of May 5, 2026.** Patched May 7 to fix a stale styling-path reference (canonical tokens live at `packages/design-system/src/tokens.css` in-repo, not `01-design-system/colors_and_type.css`). Re-copied into the repo at `.claude/skills/approver-review/SKILL.md` in AIS-8 (PR #4).
  - [x] `README.md` — When to use, how to use (workflow: open PR → copy diff → paste with prompt → ...)
  - [x] `prompt.md` v1.0.x — overlay on `/review` and `/security-review`, focused on Fitzrovia stack, data classification, and Law 25/PIPEDA. Patched May 7 to tighten the Linear closing-keyword check (flags `Part of AIS-X` framing as a workflow risk on single-ticket PRs).
  - [~] `examples/` — first real Fitzrovia PRs now exist (PRs #1–5); curate the most useful ones into the examples folder when time permits. Not blocking.

- [ ] 🔴 `intake-triage/` — Turns raw intake submissions into triage outputs
  - [ ] `README.md`
  - [ ] `prompt.md`
  - [ ] `examples/`

- [ ] 🔴 `tool-spec/` — Produces structured tool specifications
  - [ ] `README.md`
  - [ ] `prompt.md`
  - [ ] `examples/`

### Tier 2 skills (before first tool ships)

- [ ] 🟠 `ux-review/` — Reviews tool UX against design system
  - [ ] `README.md`
  - [ ] `prompt.md`
  - [ ] `examples/`

- [ ] 🟠 `data-sensitivity/` — Classifies tools as Green/Amber/Red
  - [ ] `README.md`
  - [ ] `prompt.md`
  - [ ] `examples/`

### Tier 3 skills (after first tool ships, based on real gaps)

- [ ] 🟡 `launch-checklist/` — Meta-skill confirming all other skills have been run
- [ ] 🟡 `schema-reviewer/` — Database schema review (if `/review` proves insufficient for schemas)
- [ ] 🟡 `api-endpoint-reviewer/` — API endpoint review (if `/review` proves insufficient for endpoints)
- [ ] 🟡 `security-overlay/` — Fitzrovia-specific security review for Red-classified tools (if `/security-review` proves insufficient). Reference: gstack's `/cso` skill for OWASP Top 10 + STRIDE structure with confidence-gated finding filtering.

### Tier 4 skills (when scale demands)

- [ ] 🟢 `bug-triage/` — Triage incoming bug reports
- [ ] 🟢 `impact-tracker/` — Quarterly impact assessment of tools
- [ ] 🟢 `investor-story/` — 200-word writeup for board/investor materials

---

## 03-tool-starter/

The standard tool template.

- [ ] 🟠 `README.md` — How to use the starter (must include "Before you push" section referencing `04-standards/pre-pr-checklist.md`)
- [ ] 🟠 `architecture.md` — What's in it and why
- [ ] 🟠 `conventions.md` — Naming, file structure, etc.

> Note: The actual Tool Starter code lives in a separate GitHub repo (`fitzrovia-residential/tool-starter`).
> This folder documents how to use it.
> The Tool Starter repo also contains `.github/PULL_REQUEST_TEMPLATE.md` (see `04-standards/`).
> The Tool Starter must be designed to fit inside the monorepo structure defined in `04-standards/codebase-organization.md` — i.e. it generates new tool folders under `apps/` that import from `packages/shared-entities/` by default.

---

## 04-standards/

Engineering and operational standards.

- [x] 🔴 `codebase-organization.md` v1.0.5 — **Monorepo structure and shared-entities pattern.** One repo holds all tools as folders under `apps/`. Shared entities (Building, Unit, Tenant, Employee, Vendor) are defined exactly once in `packages/shared-entities/` and imported by every tool. Defines what gets a shared definition vs what stays app-specific. Includes foundation phase vs steady-state approval rules with Joseph as third approver post-onboarding. Includes the "first three foundation tools are built by hand, Tool Starter extracted afterward" note. **Patched May 18, 2026 (v1.0.5)** with the workspace package env var rule under "Imports and module boundaries" — packages don't read `process.env` directly; consuming apps read and pass explicitly to package factories. Reflects the AIS-11 explicit-pass discovery.
- [x] 🔴 `branching-and-prs.md` v1.0.4 — **Branching workflow and PR rules.** Trunk-based development. `main` is always deployable. Feature branches named `AIS-XX-short-description` (corrected from earlier `aisXX-short-description` casing). Branch protection on `main`. PR template, foundation/steady-state CODEOWNERS configurations, scope-based branch lifecycle (acknowledging part-time builders), conflict resolution workflow via Claude Code, testing before merge (local → Vercel preview → production), rollback options. Patched May 7 (v1.0.2) with the `Closes AIS-X` closing-keyword paragraph after AIS-7 didn't auto-transition. Patched May 8 (v1.0.3) with three-in-a-row validation history. **Rewritten May 18, 2026 (v1.0.4)** to correct the keyword-dependence hypothesis after AIS-11 used `Part of AIS-11` and auto-transitioned anyway. Auto-transition fires on any merged PR linked to the ticket; keyword is a semantic signal for humans, not a gate for the automation.
- [x] 🔴 `pre-pr-checklist.md` v2.0.0 — **Canonical pre-PR checklist.** Seven items, all non-code judgement and intent. Code-reading checks moved to automation (CI, CodeRabbit, GitHub secret scanning). Referenced from PR template, tool starter README, and `06-operations/pr-review-process.md`.
- [ ] 🔴 `ci-configuration.md` (post-foundation) — **GitHub Actions and ESLint configuration that enforces what the pre-PR checklist no longer asks humans to verify.** Defines: ESLint rules for import discipline (no cross-app imports, alias imports, no entity definitions outside `shared-entities/`), automated checks for RLS on tables in `supabase/migrations/` for Red-classified tools, activity-log coverage check (PRs touching user-action paths must call `logActivity`), Prettier auto-formatting, branch protection rule configuration. Drafted during foundation-tool build; finalised when patterns from those tools have stabilised.
- [ ] 🔴 `coderabbit-configuration.md` (post-foundation) — **CodeRabbit's repo configuration.** Defines: review profile ("Chill" per the roadmap), what CodeRabbit blocks vs flags (block: missing PR template checkboxes, credential-shaped patterns, ESLint failures; flag: design suggestions, naming concerns, performance hints), how CodeRabbit interprets Fitzrovia conventions (links to handbook documents in its config), how its findings flow into the approver-review skill. Drafted during foundation-tool build.
- [ ] 🟠 `code-conventions.md` — Naming conventions, folder structure within an app, file organization. Branching is in `branching-and-prs.md`; this doc is about code-level patterns.
- [ ] 🟠 `database-conventions.md` — Schema design, RLS patterns, how Supabase tables relate to the canonical entities in `packages/shared-entities/`
- [ ] 🟠 `api-conventions.md` — REST patterns, error codes
- [ ] 🟠 `security-baseline.md` — What every tool must do
- [ ] 🟠 `activity-logging.md` — `tool_activity_log` usage patterns
- [ ] 🟡 `testing-baseline.md` — What must be tested
- [ ] 🟠 `deployment-checklist.md` — Pre-launch gates

> Note: `.github/PULL_REQUEST_TEMPLATE.md` lives in every tool repo (not the handbook), and mirrors `pre-pr-checklist.md` as a checkbox list. The Tool Starter ships with this template pre-installed so every new tool inherits it.

---

## 05-policies/

Governance documents.

- [x] 🟠 `acceptable-use.md` v0.2 — AI Studio AUP. Includes Intellectual property and code ownership section. Pending Tim Watson and HR review for any legal-adjacent revisions.
- [x] 🔴 `data-classification.md` v1.0.1 — Green/Amber/Red criteria. Red broadened to cover both personal data and commercial data with sign-off model based on first-time-handling-this-kind-of-data trigger.
- [x] 🟠 `access-control.md` v1.0.2 — Universal admin model, M365 group naming, per-tool access patterns, hidden-by-default tool visibility, lightweight access request workflow.
- [x] 🟠 `incident-response.md` v1.0.3 — Six-step playbook (detect, triage, contain, notify, fix, post-mortem). Short and operational. Includes "Non-incident bugs" section pointing to Linear flow. Support widget described as operating reality, built into every tool from day one. Joseph included in triage and post-mortem authorship.

---

## 06-operations/

Day-to-day playbooks plus one-time platform setup records.

- [x] 🔴 `development-setup.md` v2.1.1 — **Local laptop setup, env vars, secrets.** Windows-only Microsoft 365 environment. Thirteen milestones with rationale per step. Written for the Claude-Chat-as-navigator workflow at Fitzrovia. Milestone 7 points to dedicated commit-signing guide.
- [x] 🔴 `commit-signing-setup.md` v1.0.0 — **Step-by-step Windows + Git Bash commit signing setup.** SSH-based (separate signing key and auth key). Written from Karim's first-time setup on May 1, 2026, captures real pitfalls hit during that session. ~20-30 minutes for a clean run.
- [ ] 🟠 `github-setup.md` — Record of the `fitzrovia-residential` GitHub org configuration done at programme inception (May 1 2026). Org plan, member privileges (8 locked-down settings), 2FA enforcement with secure-methods-only, why each setting is what it is. Reference document for Kenny review and future change reasoning. Drafted within a few days of the May 1 setup.
- [x] 🟠 `vercel-setup.md` v1.0.1 — Record of the Fitzrovia Vercel team configuration. Pro plan, region (Toronto `yul1`), member access, deployment protection settings, why monthly billing. **Patched May 18, 2026** with two operational gotchas surfaced during AIS-11: build cache silently masking env var changes (uncheck "Use existing Build Cache" on manual redeploys), and the 4.5 MB Pro-tier function payload limit (direct-from-client uploads bypass it). (Note: this checklist line was previously marked `[ ]` despite the doc existing on disk — corrected May 18.)
- [x] 🟠 `supabase-setup.md` v1.0.1 — Record of the Fitzrovia Supabase organisation configuration. Pro plan, spend cap behaviour, region selection model (per-project, `ca-central-1`), why business billing was elected. **Patched May 18, 2026** with the legacy JWT vs new key format gotcha — `SUPABASE_SERVICE_ROLE_KEY` must be the legacy `eyJ…` JWT format for signed-URL operations; the new `sb_secret_…` format triggers "Invalid Compact JWS" errors. (Note: this checklist line was previously marked `[ ]` despite the doc existing on disk — corrected May 18.)
- [ ] 🟠 `claude-teams-setup.md` — Same for the Fitzrovia Claude Teams workspace. Team plan, 5 seats (3 Premium + 2 Standard), identity-and-access lockdown (invite link off, member invites off, JIT off), data-and-privacy posture (location off, public projects off), capabilities and Claude Code "speed not bank" stance, billing on monthly. Why each setting is what it is.
- [x] 🟠 `coderabbit-setup.md` v1.0.0 — Record of the May 4 CodeRabbit org-level configuration. Pro Plus 14-day trial (auto-converts to Pro May 19), Chill profile, critical safety toggles, watchlist of settings to revisit after real PRs, Linear integration deferred to Wednesday.
- [ ] 🟡 `intake-triage-process.md` — How to triage submissions
- [ ] 🟠 `pr-review-process.md` — Full flow: builder finishes work → runs `/review` and `/security-review` → walks `pre-pr-checklist.md` → opens PR → CodeRabbit runs → approver runs `approver-review` skill → merge
- [ ] 🟠 `deployment-process.md` — How tools go live
- [ ] 🟡 `bug-response.md` — How to handle reported bugs
- [ ] 🟡 `offboarding.md` — When someone leaves
- [ ] 🟡 `monthly-cadence.md` — What Karim and Kenny do each month

---

## 07-tools-registry/

Living catalogue of all tools (populated as tools ship).

- [ ] 🟡 `README.md` — Index with status of every tool
- [ ] `tools/` — One markdown file per live tool, added as tools ship

> Note: This folder stays empty until the first tool goes live.

---

## Pre-payment work (April 29 → Friday May 1, 2 days remaining)

> **Status update (v2.4): pre-payment Critical work is complete.** All five planned Critical pre-payment documents are drafted. Friday's setup can proceed without document gaps.

In priority order:

1. [x] 🔴 `04-standards/codebase-organization.md` v1.0.4 — done
2. [x] 🔴 `04-standards/branching-and-prs.md` v1.0.1 — done
3. [x] 🔴 `04-standards/pre-pr-checklist.md` v2.0.1 — done
4. [x] 🔴 `06-operations/development-setup.md` v2.0.1 — done
5. [x] 🔴 `05-policies/data-classification.md` v1.0.1 — done

> **People-asks pending this week** (separate from documentation, low effort but lead time matters):
> - Email Kenny (Entra access for groups, DNS readiness, Office IPs for Supabase whitelisting) — overdue; Kenny needs lead time before Friday
> - Tim Watson Law 25 / PIA heads-up — less urgent; can slip to next week
> - Corey heads-up on data-classification policy (new) — he hasn't seen the policy yet and may be asked to sign off on first commercial-Red tools

> Deferred from this window:
> - AUP (waiting on Tim Watson heads-up email; let him shape it rather than drafting blind)
> - CONTRIBUTING.md (low traffic until Joseph onboards)
> - Builder self-review skill (replaced by `pre-pr-checklist.md` per layered review model)
> - The three skills (`approver-review`, `intake-triage`, `tool-spec`) — moved to post-foundation per the timing change in v2.2

> **Realistic call.** Items 3 is genuinely Friday-blocking. Items 4 and 5 are short and ideally drafted this week, but if they slip to next week the foundation-tool work isn't blocked — Karim can use the underlying built-ins (`/review`, `/security-review`) without the formal Fitzrovia checklist for the first PR or two. Items 4 and 5 should land in week 1 of foundation building, not later.

> **People-asks pending this week** (separate from documentation, low effort but lead time matters):
> - Email Kenny (Entra access, DNS readiness, IPs for Supabase whitelisting) — defer to next week per Karim's note that we're a couple of steps away from needing those done
> - Tim Watson Law 25 / PIA heads-up — defer until AUP drafting is closer

> Deferred from this window:
> - AUP (waiting on Tim Watson heads-up email; let him shape it rather than drafting blind)
> - CONTRIBUTING.md (low traffic until Joseph onboards)
> - Builder self-review skill (replaced by `pre-pr-checklist.md` per layered review model)
> - The three skills (`approver-review`, `intake-triage`, `tool-spec`) — moved to post-foundation per the timing change above

---

## After payment, foundation-tool build phase (Karim builds first three tools)

Karim builds the landing page, tool selection page, and intake form by hand. The Tool Starter is extracted from these three rather than written before them. Joseph onboards into a working environment after the Tool Starter exists.

**Sequence:**

- [ ] Stand up the empty monorepo at `github.com/fitzrovia-residential/fitzrovia-tools` per `04-standards/codebase-organization.md`
- [ ] Configure branch protection on `main` per `04-standards/branching-and-prs.md`
- [ ] Set up the foundation-phase CODEOWNERS file (Karim and Kenny only; Joseph added later when review-capable)
- [ ] Install `.github/PULL_REQUEST_TEMPLATE.md` based on `pre-pr-checklist.md`
- [ ] Configure CodeRabbit on the org with the "Chill" review profile
- [ ] **Design the Support widget UI** — button placement, form fields, confirmation behaviour. The widget gets used by every tool, so this design happens before the foundation tools' code so it can be part of their initial build. See `! Checklist/handbook-configuration-list.md`.
- [ ] **Build `packages/support-widget/`** — the React component, API client, TypeScript types. Built before or in parallel with the first foundation tool.
- [ ] **Configure Support widget backend** — Supabase `support_submissions` table, Teams webhook for `ai-studio-support` channel, email inbox forwarding. End-to-end verified before the first foundation tool ships.
- [ ] **Karim builds the landing page** (`apps/hub/`) — includes the Support widget from day one
- [ ] **Karim builds the tool selection page** (part of `apps/hub/` or a separate sub-route) — includes the Support widget from day one
- [ ] **Karim builds the intake form** (`apps/intake-portal/`, wired to the Linear API key generated 2026-04-27) — includes the Support widget from day one
- [ ] Extract the Tool Starter from the three foundation tools into `github.com/fitzrovia-residential/tool-starter` — the Support widget integration becomes part of what new tools inherit by default
- [ ] During this phase, draft the three skills as time allows: `approver-review`, `intake-triage`, `tool-spec`
- [ ] During this phase, draft `02-skills/README.md` capturing the layered review model
- [ ] During this phase, draft `04-standards/ci-configuration.md` and `04-standards/coderabbit-configuration.md` — these are where most of the verification work happens, and the actual configuration values come from working with the foundation-tool codebase

---

## Before Joseph onboards

- [ ] Tool Starter v1.0.0 exists and is tested (generated and used to build the third foundation tool, ideally)
- [ ] All three Tier 1 skills drafted (`approver-review`, `intake-triage`, `tool-spec`)
- [ ] `02-skills/README.md` drafted
- [ ] Joseph's @fitzrovia.ca account exists and has access to GitHub, Vercel, Supabase, Claude Teams
- [ ] Joseph's onboarding doc drafted (probably `06-operations/onboarding-builder.md`, currently 🟡 — promote to 🟠 closer to onboarding date)
- [ ] Karim and Kenny review the three foundation tools' code together before Joseph sees it (set the "this is what good looks like" baseline)

---

## After first builder-led tool ships (Joseph's first build)

Phase 4 of the rollout — handbook stabilises around real usage.

- [ ] Refine drafts based on real environment usage (Claude Design ingestion, etc.)
- [ ] Configure CodeRabbit to flag PRs where the template checkboxes aren't completed
- [ ] Draft Tier 2 skills (UX Review, Data Sensitivity)
- [ ] Draft remaining `04-standards/` files (after Tool Starter is stable)
- [ ] Draft remaining `05-policies/` files
- [ ] Draft `03-tool-starter/` documentation
- [ ] Decide on Joseph as third approver — if patterns are clean, update CODEOWNERS and move to steady-state approval rules

---

## After first builder-led tool ships

- [ ] Draft Tier 3 skills based on observed gaps
- [ ] Add first tool entry in `07-tools-registry/`
- [ ] Capture first real `approver-review/examples/` from PR #1
- [ ] Spot-check: pick a recent PR and ask the builder to walk through what `/review` and `/security-review` flagged and how they handled it
- [ ] Revisit gstack — by this point you'll know whether `/cso`, `/codex`, or `/document-release` patterns are worth adopting

---

## Notes

- This checklist lives in `! Checklist/` of the handbook repo. Once the handbook is in GitHub, Git tracks the history.
- The 🔴 Critical items should not be skipped, but the 🟢 Low items can be deferred indefinitely if not yet needed.
- Skills evolve. v1.0.0 of any skill is the starting point, not the destination. Plan to update each skill within a week of first real use.
- Some files (AUP, Law 25/PIPEDA) need external review (Tim Watson, HR) before they can be marked complete.
- Anthropic ships several relevant built-ins (`/review`, `/security-review`, `frontend-design`, `simplify`). Before drafting any new skill, check whether a built-in or community pattern already covers it. The Fitzrovia handbook should focus on what's specific to Fitzrovia — stack, data, compliance, governance — not general engineering practice.

---

## Status summary

**As of May 18, 2026 (post AIS-11 merge):**

- **Documents complete:** 14 (unchanged from v3.8 — AIS-11 patched four existing docs but didn't add new ones)
- **Skills complete:** 1 of 3 Tier 1 (approver-review drafted + in active use; intake-triage and tool-spec still pending; small approver-review prompt patch tracked in config list)
- **Critical handbook items remaining:** 4 (intake-triage, tool-spec, ci-configuration.md, coderabbit-configuration.md — all post-foundation-tool work)
- **High priority items remaining:** ~15 (unchanged from v3.8 — AIS-11 was app code + infra, not handbook docs)

**Platform layer — Phase 1 complete (May 1 + May 4):** unchanged from v3.7.

**Phase 2 — foundation-tool build IN PROGRESS (May 5–18):**

- ✓ AIS-5 (PR #1, May 5): `CLAUDE.md` at repo root
- ✓ AIS-6 (PR #2, May 5–6): Monorepo scaffolding
- ✓ AIS-7 (PR #3, May 7): `apps/hub/` landing + design system v1.1.0
- ✓ AIS-8 (PR #4, May 7): Repo housekeeping + `Closes AIS-X` convention introduced
- ✓ AIS-9 (PR #5, May 8): `apps/hub/` `/tools` page + mock session + sign-in stub redirect
- ✓ AIS-10 (PR #6, May 8): ESLint + Prettier + Husky + `.coderabbit.yaml` + Linear-CodeRabbit integration
- ✓ AIS-11 (PR #7, May 18): `apps/hub/` `/tools/request` Submit-a-Tool-Request form, Supabase Storage `tool-requests` bucket, `@fitzrovia/supabase-client` package, direct-from-client upload pattern, MIME content sniffing, atomic rollback
- ⏳ AIS-15: Batch 4 — Linear API integration (replaces stub ticket ID with real `issueCreate` + `attachmentCreate`; closes AIS-11's full intent)
- ⏳ AIS-12: Microsoft Entra SSO wiring — blocked on Kenny's Application Developer role grant
- ⏳ AIS-13: Install Supabase CLI for future migrations via `bunx supabase db push`
- ⏳ AIS-14: Install Vitest + backfill tests for AIS-11 helpers (foundation-phase tests gap)
- ⏳ AIS-16: AIS-11 polish — remaining LOW-severity findings deferred from `/review`
- ⏳ Support widget package + backend — deferred to bundle with widget's external infrastructure

**`Part of AIS-X` auto-transition correction** (May 18) — AIS-11 used `Part of AIS-11` and auto-transitioned anyway, contradicting the keyword-dependence hypothesis. `04-standards/branching-and-prs.md` rewritten to reflect actual behavior: auto-transition fires on any merged PR linked to the ticket; keyword is a semantic signal, not a gate.

**This week's open follow-ups (non-document):**

- Microsoft Entra Application Developer role grant for Karim — pending Kenny (blocks AIS-12)
- DNS provisioning for chosen subdomain (`hub.fitzrovia.ca` vs `aistudio.fitzrovia.ca` — decision pending) — pending Kenny (~1 week from non-builder pilot)
- Tim Watson Law 25 / PIA heads-up — pending; not blocking foundation phase
- Corey heads-up on data-classification / sign-off model — pending; first commercial-Red tool is the trigger
- CodeRabbit Pro trial conversion decision — May 16 calendar reminder
- Vercel `@fitzrovia.ca`-domain access expansion — needed before non-builder pilot

**All four policies complete for v1.** The `05-policies/` folder is done.

**Foundation-tool build remaining work:**

- Build `packages/support-widget/` + configure backend — pending; revisit timing at AIS-X scope
- Build `apps/intake/` (third foundation tool) — next major build after AIS-11
- Extract Tool Starter from the three foundation tools — premature; revisit after intake form ships
- Draft `04-standards/ci-configuration.md` and `04-standards/coderabbit-configuration.md` — `.coderabbit.yaml` and pre-commit setup from AIS-10 are the source material
- Draft `02-skills/intake-triage/` and `02-skills/tool-spec/` — pending
- Draft `02-skills/README.md` — pending
- Patch `02-skills/approver-review/prompt.md` — tiny PR-number citation fix flagged in AIS-10

---

# Appendix — Pure checklist

*A clean checkbox list of everything in the build checklist, organized by phase, with no descriptions or notes. Use this for fast progress tracking. Detail and rationale for each item is in the main body above.*

## Top-level files
- [x] 🔴 `README.md` v0.3
- [ ] 🟠 `CONTRIBUTING.md`

## 00-foundations/
- [x] 🔴 `roadmap-v20.md`
- [x] 🔴 `operating-principles.md` v1.2.0
- [x] 🟠 `glossary.md` v1.3.0

## 01-design-system/
- [ ] 🟠 `tokens.md`
- [ ] 🟡 `components.md`
- [ ] 🟡 `voice-and-tone.md`
- [ ] 🟡 `claude-design-config.md`

## 02-skills/
- [ ] 🟠 `README.md`

### Tier 1 skills (before Joseph onboards)
- [x] 🔴 `approver-review/README.md` (drafted, in active use)
- [x] 🔴 `approver-review/prompt.md` v1.0.x (patched May 7)
- [~] 🔴 `approver-review/examples/` (real PRs exist; curate when time permits)
- [ ] 🔴 `intake-triage/README.md`
- [ ] 🔴 `intake-triage/prompt.md`
- [ ] 🔴 `intake-triage/examples/`
- [ ] 🔴 `tool-spec/README.md`
- [ ] 🔴 `tool-spec/prompt.md`
- [ ] 🔴 `tool-spec/examples/`

### Tier 2 skills (before first tool ships)
- [ ] 🟠 `ux-review/README.md`
- [ ] 🟠 `ux-review/prompt.md`
- [ ] 🟠 `ux-review/examples/`
- [ ] 🟠 `data-sensitivity/README.md`
- [ ] 🟠 `data-sensitivity/prompt.md`
- [ ] 🟠 `data-sensitivity/examples/`

### Tier 3 skills (after first tool ships)
- [ ] 🟡 `launch-checklist/`
- [ ] 🟡 `schema-reviewer/`
- [ ] 🟡 `api-endpoint-reviewer/`
- [ ] 🟡 `security-overlay/`

### Tier 4 skills (when scale demands)
- [ ] 🟢 `bug-triage/`
- [ ] 🟢 `impact-tracker/`
- [ ] 🟢 `investor-story/`

## 03-tool-starter/
- [ ] 🟠 `README.md`
- [ ] 🟠 `architecture.md`
- [ ] 🟠 `conventions.md`

## 04-standards/
- [x] 🔴 `codebase-organization.md` v1.0.5
- [x] 🔴 `branching-and-prs.md` v1.0.4
- [x] 🔴 `pre-pr-checklist.md` v2.0.1
- [ ] 🔴 `ci-configuration.md` (post-foundation)
- [ ] 🔴 `coderabbit-configuration.md` (post-foundation)
- [ ] 🟠 `code-conventions.md`
- [ ] 🟠 `database-conventions.md`
- [ ] 🟠 `api-conventions.md`
- [ ] 🟠 `security-baseline.md`
- [ ] 🟠 `activity-logging.md`
- [ ] 🟡 `testing-baseline.md`
- [ ] 🟠 `deployment-checklist.md`

## 05-policies/
- [x] 🟠 `acceptable-use.md` v0.2
- [x] 🔴 `data-classification.md` v1.0.1
- [x] 🟠 `access-control.md` v1.0.2
- [x] 🟠 `incident-response.md` v1.0.3

## 06-operations/
- [x] 🔴 `development-setup.md` v2.1.1
- [x] 🔴 `commit-signing-setup.md` v1.0.0
- [ ] 🟠 `github-setup.md`
- [x] 🟠 `vercel-setup.md` v1.0.1
- [x] 🟠 `supabase-setup.md` v1.0.1
- [ ] 🟠 `claude-teams-setup.md`
- [x] 🟠 `coderabbit-setup.md` v1.0.0
- [ ] 🟡 `intake-triage-process.md`
- [ ] 🟠 `pr-review-process.md`
- [ ] 🟠 `deployment-process.md`
- [ ] 🟡 `bug-response.md`
- [ ] 🟡 `offboarding.md`
- [ ] 🟡 `monthly-cadence.md`

## 07-tools-registry/
- [ ] 🟡 `README.md`
- [ ] `tools/` (populated as tools ship)

---

## People-asks (this week)
- [x] Email Kenny — Entra access, DNS readiness, Office IPs for Supabase ✓ DONE (initial email sent week of April 27; Kenny accepted, Friday May 1 payment meeting executed). **Open follow-ups with Kenny:** Microsoft Entra Application Developer role grant for Karim (blocks AIS-10 Entra SSO wiring), DNS provisioning for `hub.fitzrovia.ca` (~1 week from non-builder pilot), commit signing setup for Kenny's local environment.
- [ ] Tim Watson — Law 25 / PIA heads-up (still pending; not blocking foundation phase but should land before Tier 1 / commercial-Red tools)
- [ ] Corey — heads-up on data-classification policy and sign-off model (still pending; first commercial-Red tool is the trigger)

## Friday May 1 — payment day ✓ DONE May 1, 2026
- [x] GitHub Team plan — corporate card entered
- [x] Claude Teams — corporate card entered
- [x] Vercel Pro — corporate card entered
- [x] Supabase Pro — corporate card entered
- [x] Send Claude Teams invites — Premium to Kenny and Joseph; Standard to Corey and Parker (or Robert per Corey's confirmation)

## Friday post-payment infrastructure (per `! Checklist/handbook-configuration-list.md`)
- [x] Create `fitzrovia-residential/fitzrovia-tools` repo ✓ DONE May 5 (AIS-5 PR #1)
- [x] Configure branch protection on `main` ✓ DONE
- [x] Set up CODEOWNERS (foundation phase config) ✓ DONE
- [x] Install `.github/PULL_REQUEST_TEMPLATE.md` ✓ DONE
- [x] Enable GitHub secret scanning + push protection ✓ DONE
- [x] Configure auto-delete branches ✓ DONE (validated on every PR merge through PR #5)
- [x] Initialize monorepo structure (apps/, packages/, .github/, root config) ✓ DONE May 5–6 (AIS-6 PR #2)
- [x] Vercel team Pro paid; Toronto **`yul1`** region confirmed (NOT `cle1` — corrected during AIS-7 work)
- [x] Supabase `fitzrovia-prod` project in `ca-central-1`
- [ ] 🟠 Run `tool_activity_log` schema — deferred per the Configuration List; design alongside the support widget package or first foundation tool when concrete usage exists
- [x] CodeRabbit installed on org with "Chill" profile ✓ DONE May 4
- [x] CodeRabbit Pro plan paid (Pro Plus 14-day trial active until May 18 at v3.6 writing; trial conversion decision May 16)

## Karim's Friday laptop setup (per `06-operations/development-setup.md`) ✓ DONE May 1, 2026
- [x] Git installed
- [x] Node 20 installed via nvm-windows
- [x] Bun installed
- [x] VS Code installed
- [x] Claude Code VS Code extension installed and signed in with @fitzrovia.ca
- [x] Git identity configured
- [x] GitHub CLI installed and authenticated
- [x] Monorepo cloned to `C:\Users\KarimMourad\fitzrovia-tools` (corrected from `C:\code\fitzrovia-tools` — Karim's actual setup landed under his user directory)
- [x] Dependencies installed (`bun install`)
- [x] Push test completed (validated end-to-end on AIS-5 PR #1 May 5)

## Kenny-owned post-payment
- [~] Step 8: Supabase IP whitelisting — partially deferred. Decision B (Dashboard allowlist) to apply when first non-Karim user accesses the Supabase project; not yet triggered.
- [x] Step 9: Vercel Canadian region verification, written sign-off ✓ DONE during AIS-7 work (`yul1` Toronto confirmed; `cle1` was the v3.6 typo)
- [ ] Step 10: Microsoft Entra SSO across all 4 platforms — Application Developer role grant for Karim still pending (blocks AIS-10)
- [ ] Steps 12 and 20: DNS for `hub.fitzrovia.ca` — pending (~1 week from non-builder pilot)

## Foundation-tool build phase (Karim builds first three tools)
- [x] Design Support widget UI ✓ DONE May 6 via Claude Design (full spec in `! support widget design spec/`)
- [ ] 🟠 Build `packages/support-widget/` (React component, API client, types) — **deferred:** widget infrastructure (Teams channel, email inbox, Supabase backend) lands together as a block; revisit timing at AIS-X scope. Hub shipped without the widget; non-builder pilot still weeks away.
- [ ] 🟠 Configure Support widget backend (Supabase table, Teams webhook, email forwarding) — same deferral as above
- [x] Build landing page (`apps/hub/`) ✓ DONE May 7 (AIS-7 PR #3, deployed at `hub-flame-eight.vercel.app`). **Did NOT include Support widget** — exception to the original "from day one" rule, formally accepted; will retrofit when the widget package ships.
- [x] Build tool selection page (`apps/hub/` `/tools` route) ✓ DONE May 8 (AIS-9 PR #5). Same widget exception.
- [ ] 🟠 Build intake form (`apps/intake-portal/`) — next major build after AIS-10 Entra wiring; still planned to include Support widget from day one (i.e., widget ships with this tool)
- [ ] Extract Tool Starter into `fitzrovia-residential/tool-starter` — premature; revisit after intake form ships
- [x] Draft `02-skills/approver-review/` ✓ DONE (in active use; patched May 7)
- [ ] 🟠 Draft `02-skills/intake-triage/` (during foundation phase) — pending
- [ ] 🟠 Draft `02-skills/tool-spec/` (during foundation phase) — pending
- [ ] 🟠 Draft `02-skills/README.md` (during foundation phase) — pending
- [ ] 🟠 Draft `04-standards/ci-configuration.md` (during foundation phase) — pending; ESLint/Prettier/Husky setup is the precursor
- [ ] 🟠 Draft `04-standards/coderabbit-configuration.md` (during foundation phase) — pending; `.coderabbit.yaml` creation is the precursor

## Before Joseph onboards
- [ ] Tool Starter v1.0.0 exists and is tested
- [ ] All three Tier 1 skills drafted
- [ ] `02-skills/README.md` drafted
- [ ] Joseph's @fitzrovia.ca account has access to GitHub, Vercel, Supabase, Claude Teams
- [ ] Joseph's onboarding doc drafted
- [ ] Karim and Kenny review the three foundation tools' code together before Joseph sees it

## After first builder-led tool ships
- [ ] Refine drafts based on real environment usage
- [ ] Configure CodeRabbit to flag PRs where template checkboxes aren't completed
- [ ] Draft Tier 2 skills (UX Review, Data Sensitivity)
- [ ] Draft remaining `04-standards/` files
- [ ] Draft remaining `05-policies/` files
- [ ] Draft `03-tool-starter/` documentation
- [ ] Decide on Joseph as third approver — update CODEOWNERS to steady-state if approved
