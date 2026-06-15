# Handbook Configuration List

**Purpose:** Running list of every code-side configuration, tooling setup, and infrastructure rule required to make the handbook's standards real. The handbook describes how things should work; this list captures what actually has to be configured for that to be true.

**Path:** `! handbook configuration list/handbook-configuration-list.md` (kept alongside the handbook; not part of the published handbook)

**Last updated:** May 18, 2026 (post AIS-11 merge)
**Owner:** Karim Mourad

---

## Why this list exists

The handbook's standards documents make claims like "ESLint enforces import discipline" and "CodeRabbit blocks PRs with unticked checkboxes" and "RLS is required on Red-classified tables." Each of those claims is currently aspirational — the rules exist on paper but aren't yet wired into any tooling.

This list tracks every aspirational claim until it's actually implemented. It's the bridge between "the handbook says X" and "the system enforces X."

Items move from this list into the relevant `04-standards/ci-configuration.md` or `04-standards/coderabbit-configuration.md` document once they're configured and verified working.

---

## Legend

- `[ ]` Not yet configured
- `[~]` Partially configured / in progress
- `[x]` Configured and verified

**Phase tags:**
- 🔴 **Friday setup** — Must be configured during Friday's infrastructure standup, or work breaks
- 🟠 **First foundation tool** — Configure when standing up the first foundation tool's repo
- 🟡 **Foundation phase** — Configure during the foundation-tool build phase, before extracting Tool Starter
- 🟢 **Post-foundation** — Configure after Tool Starter exists and patterns are stable

---

## GitHub repository setup

### Org-level configuration (done May 1, 2026)

The `fitzrovia-residential` organisation was created and configured on May 1. The settings below are captured for the record; the full decisions-and-state record lives in `06-operations/github-setup.md`.

**Plan and identity:**

- [x] 🔴 Org `fitzrovia-residential` created on Team plan
- [x] 🔴 Display name: `Fitzrovia Residential`. Description: `Fitzrovia Residential's internal AI development platform.`
- [x] 🔴 Billing email: `kmourad@fitzrovia.ca` (private)
- [x] 🔴 Public profile email: not set (deliberate; we don't run a public-facing org)

**Member privileges (locked down):**

- [x] 🔴 Base permissions: **Read** (members default to read-only; push access granted via teams or per-repo)
- [x] 🔴 Repository creation: **Public disabled** (greyed out at the plan level), Private only
- [x] 🔴 Repository forking: **Disabled** for private repos
- [x] 🔴 Projects base permissions: **Read** (we use Linear for project tracking, not GitHub Projects)
- [x] 🔴 Pages creation: **Both Public and Private disabled** (Vercel handles deployment)
- [x] 🔴 App access requests: **Members only** (outside collaborators cannot request apps)
- [x] 🔴 GitHub Apps: **Repo admins cannot install Apps without org owner approval**
- [x] 🔴 Repository visibility change: **Members cannot change visibility** (org owners only)
- [x] 🔴 Repository deletion and transfer: **Members cannot delete or transfer** (org owners only)
- [x] 🔴 Issue deletion: **Disabled** (org owners only)
- [x] 🔴 Team creation: **Owners-only** (members cannot create teams)

**Authentication security:**

- [x] 🔴 Two-factor authentication: **Required for everyone in the org**
- [x] 🔴 Only secure 2FA methods allowed (authenticator apps, passkeys, security keys, mobile app — SMS not allowed)

**People:**

- [x] 🔴 Karim Mourad — Owner
- [x] 🔴 Kenny Marcano (`kmarcano@fitzrovia.ca`) — invited as Owner; pending acceptance
- [ ] 🟢 Joseph — defer until he onboards into a working environment after Tool Starter exists

### Repo creation and ownership

- [x] 🔴 Create `fitzrovia-residential/fitzrovia-tools` repository (private, owned by org) ✓ DONE May 4, 2026
- [x] 🔴 Initialize repo with the monorepo structure per `04-standards/codebase-organization.md` (`apps/`, `packages/`, `.github/`, root config files) ✓ DONE May 4, 2026 (commit 008460a — `package.json`, `.gitignore`, `README.md` plus empty `apps/`, `packages/`, `.github/workflows/` scaffolding)
- [ ] 🔴 Create the `builders` GitHub team with Write access (Joseph added to this team when onboarded). Deferred — Joseph not yet onboarded.
- [x] 🟠 Create `CLAUDE.md` at the monorepo root ✓ DONE May 5, 2026 (PR #1, commits 9cd9191 + a71b389, squash-merged via foundation-phase admin bypass). The file Claude Code reads when working in the repo to learn about Fitzrovia conventions. References: monorepo structure, shared-entities discipline, branching workflow, the layered review model, where standards docs live, what Bun is and why we use it. Pulls from `04-standards/codebase-organization.md`, `04-standards/branching-and-prs.md`, `04-standards/pre-pr-checklist.md`. Forward-referenced in `06-operations/development-setup.md` Step 7. Beyond the file itself, this PR also (a) registered CodeRabbit's check name with GitHub, unlocking the required-status-check task below; (b) verified the GitHub-Linear and CodeRabbit-Linear integrations end-to-end; (c) surfaced the Linear `On PR or commit merge → Live` mapping gap (AIS-5 stuck at In Review, since corrected — see v1.2.22 changelog).

### Branch protection on `main` (configured via GitHub Rulesets)

Source: `04-standards/branching-and-prs.md`, "Branch protection and the dual-approval mechanism" section.

**Configured as Ruleset `main protection` (Active) on May 4, 2026:**

- [x] 🔴 Require pull request before merging ✓
- [x] 🔴 Require approvals from CODEOWNERS (1 required approval, Code Owners review required, dismiss stale approvals on new commits, require approval of most recent reviewable push) ✓
- [x] 🔴 Require branches to be up to date with `main` before merge ✓
- [x] 🔴 Require conversation resolution before merge ✓
- [x] 🔴 Disable force-pushes to `main` (Block force pushes) ✓
- [x] 🔴 Disable deletions of `main` (Restrict deletions) ✓
- [x] 🔴 Require signed commits (bonus belt-and-suspenders — already enforced by Vercel deployment, now also at GitHub level) ✓
- [ ] ⚠️ "Restrict who can dismiss reviews to Karim and Kenny" — this sub-rule exists in classic Branch Protection but **does not exist as a separate option in GitHub Rulesets**. Effectively superseded by "Dismiss stale pull request approvals when new commits are pushed" (which auto-dismisses on new commits) plus the Org Owner role being limited to Karim and Kenny anyway. Verify by attempting to dismiss a review as a non-admin once Joseph onboards; if a gap exists at that point, revisit.

**Foundation-phase exception:**

- [x] 🔴 Repository admin role on bypass list with "Always allow" — applies to Karim through foundation-phase scaffolding and the first real tool ship. **Sunset trigger: after the intake tool ships to production.** Trigger updated May 6, 2026 from the original "before any tool building begins, including the landing page." Operational reality: Karim is the only active committer through the foundation phase and the foundation tools (`apps/hub/` landing/login, Microsoft Entra SSO wiring, tools selection page) and the first real tool (intake); Kenny has not yet onboarded as an active reviewer and Joseph is not yet review-capable. Removing the bypass before the intake tool ships would block all merges. Karim removes the bypass entry from the ruleset himself when the trigger is hit.

**Pending — to be configured once first PR exists and CodeRabbit has reviewed it:**

- [x] 🟠 Re-enable "Require status checks to pass" on the `main protection` ruleset and add CodeRabbit as a required check ✓ DONE May 5, 2026. CodeRabbit's check name (`CodeRabbit`, provider `coderabbitai`) registered with GitHub when CodeRabbit reviewed PR #1; added as required check immediately after the merge. "Require branches to be up to date before merging" sub-toggle also enabled (was previously checked but inert without any required checks). The ruleset list view now shows 5 branch rules (up from 4) — note that GitHub's list view consolidates sub-options into top-level categories, so the underlying configuration is intact. Build/lint/typecheck checks to be added alongside CodeRabbit as those CI jobs are created (post-foundation work).
- [x] 🟠 Add CodeRabbit to `fitzrovia-tools` ✓ DONE May 4, 2026. The May-1 "All repositories" scope did not auto-pick up the new repo; resolved by re-running the "Add Repositories" flow. See `06-operations/coderabbit-setup.md` for the corrected procedure and operational lesson.
- [x] 🟠 Open a trivial PR on `fitzrovia-tools` to trigger the first CodeRabbit review and register CodeRabbit's check name with GitHub ✓ DONE May 5, 2026. PR #1 (CLAUDE.md addition) served this purpose. CodeRabbit's check name now registered as `CodeRabbit` (provider `coderabbitai`) and added as required status check on `main protection` (see item above).

**Apply to administrators — current state and steady-state target:**

- [x] 🔴 Apply rules to administrators (default behaviour for Rulesets — admins are subject to the rule unless explicitly bypass-listed) ✓
- [ ] 🟠 At foundation-phase exit, remove Repository admin from the bypass list so the no-self-approval rule applies to Karim and Kenny going forward. Sunset trigger as documented above.

### Dual-approval on IT-critical packages

Source: `04-standards/branching-and-prs.md`, "Dual-approval on IT-critical packages — how it's actually enforced" section.

**Important correction:** The original plan was to enforce this via a second GitHub ruleset (`IT-critical dual approval`) using the per-path "Required number of approvals" rule. That rule is gated behind the GitHub Enterprise plan; Fitzrovia is on the Team plan. Discovered May 4, 2026 during the actual configuration. **The intended Ruleset B was abandoned.**

**Replacement mechanism — two layers:**

- [x] 🔴 **Layer 1: CODEOWNERS routing.** PRs touching `/packages/auth/`, `/packages/supabase-client/`, or `/packages/activity-log/` auto-request review from both Karim and Kenny. Configured in `.github/CODEOWNERS` (commit 09a34c3). ✓
- [~] 🟠 **Layer 2: CodeRabbit gating.** Two parts:
  - **Part A: CodeRabbit's check is required for merge** ✓ DONE May 5, 2026 (see ruleset items above). PRs now cannot merge unless CodeRabbit's review check passes. This is the foundation that Layer 2 needs.
  - **Part B: Configure CodeRabbit to recognize PRs touching IT-critical paths and withhold its own approval until both Karim and Kenny have approved.** Pending. Approach TBD — likely a path-instruction rule in CodeRabbit settings (`Settings → Reviews → Behavior → Path instructions`) plus a custom pre-merge check. To be configured before any IT-critical PR is opened (none expected during foundation phase, since Karim is scaffolding configs, not modifying `packages/auth/`). Realistic timing: alongside the support widget package work or first foundation tool.

**Until Layer 2 is configured (Wednesday-ish):**

- [ ] 🔴 The dual-approval rule is enforced **by convention only**. CODEOWNERS routes the requests to both Karim and Kenny; both review IT-critical PRs as a matter of practice. Realistically, no IT-critical PRs are likely during the foundation-phase bypass exception (Karim is scaffolding configs, not modifying `packages/auth/`), so this gap is small. Document this clearly to Kenny when he reviews the setup.

### CODEOWNERS

Source: `04-standards/branching-and-prs.md`, "CODEOWNERS" section.

- [x] 🔴 Create `.github/CODEOWNERS` with foundation phase configuration: ✓ DONE May 4, 2026 (commit 09a34c3)

  ```
  # Default reviewers for the whole repo
  *                                @kmourad-fitzrovia @KMarcanoFITZ

  # Apps - either Karim or Kenny can approve
  /apps/                           @kmourad-fitzrovia @KMarcanoFITZ

  # Most packages - either Karim or Kenny can approve
  /packages/shared-entities/       @kmourad-fitzrovia @KMarcanoFITZ
  /packages/design-system/         @kmourad-fitzrovia @KMarcanoFITZ

  # IT-critical packages - both must approve
  /packages/auth/                  @kmourad-fitzrovia @KMarcanoFITZ
  /packages/supabase-client/       @kmourad-fitzrovia @KMarcanoFITZ
  /packages/activity-log/          @kmourad-fitzrovia @KMarcanoFITZ
  ```

- [ ] 🟢 Update CODEOWNERS to steady-state config (add `@joseph` to non-IT-critical paths) when Joseph becomes review-capable, ~2-3 months post-onboarding

### Pull Request template

Source: `04-standards/pre-pr-checklist.md`.

- [x] 🔴 Create `.github/PULL_REQUEST_TEMPLATE.md` mirroring the seven items in `04-standards/pre-pr-checklist.md` as checkboxes ✓ DONE May 4, 2026 (commit 09a34c3)
- [x] 🟠 Verify template auto-populates on every new PR ✓ DONE in AIS-10 (PR #6, May 8). Confirmed via `gh pr view 5 --json body --jq .body`: PR #5's body did contain the "Design system changes" checkbox section signature from the AIS-8 template update, proving auto-populate works. (PRs since AIS-7 have replaced the template body with custom content but auto-populate fires correctly on PR open; replacement is by Claude Code, not by GitHub.)
- [ ] 🟡 Replicate the same template into the Tool Starter repo so every generated tool inherits it

### Auto-delete branches

- [x] 🔴 Configure GitHub to auto-delete head branches when PRs merge ✓ DONE May 4, 2026 (Settings → General → Pull Requests → "Automatically delete head branches")
- [x] 🟠 Enable "Always suggest updating pull request branches" (Settings → General → Pull Requests). Surfaces an "Update branch" button on PR pages when behind `main` — makes pre-PR checklist item #6 actually visible to builders. ✓ DONE May 4, 2026
- [x] 🔴 Auto-merge: deliberately disabled. Approver clicks Merge as the final sanity step. ✓ Verified May 4, 2026
  Source: `04-standards/branching-and-prs.md`, "Branch lifecycle" step 8.

### Merge strategy

Decision May 6, 2026: merge commit by default, squash disabled. Reasoning documented in `04-standards/branching-and-prs.md` "Merge strategy: merge commit by default" section. Short version: preserves per-batch commit history (matters for non-technical builders reading PR archaeology), and `git branch -d` works cleanly on merged branches (squash breaks safe-delete because original commits don't exist on `main`).

- [x] 🟠 Disable squash-merge and rebase-merge in GitHub repo settings ✓ DONE May 6, 2026 (Settings → General → Pull Requests → "Allow squash merging" and "Allow rebase merging" both unchecked, "Allow merge commits" remains checked).
- [x] 🟢 Tighten the merge-commit message default to "Pull request title" ✓ DONE May 6, 2026 (cleaner subject lines than GitHub's default `Merge pull request #N from <branch>` format).

### GitHub Secret Protection and Code Security (deferred — proportionate-governance decision)

GitHub split GitHub Advanced Security into two paid products in 2025: **Secret Protection** (push-time secret scanning + push protection, ~$19 USD/active committer/month) and **Code Security** (Dependabot, dependency graph, etc., ~$30 USD/active committer/month). Free secret scanning on private repos no longer exists. Discovered May 4, 2026.

**Decision May 6, 2026: defer both. Strengthen the layered review model instead.**

The reasoning: at Fitzrovia's scale (private repo, 1-3 committers in the foreseeable timeframe, all trusted, layered review with `/review` + `/security-review` + CodeRabbit + the Approver Code Review Skill), the marginal value of Secret Protection over the existing layers is modest. The repo is private (no GitHub-bot scraping), access is tightly scoped (Karim, Kenny, Joseph eventually, plus Vercel and CodeRabbit read-only), and a leaked secret would sit in private repo history with a small trusted audience until rotated. That's bounded risk, not catastrophic.

The strengthened layered model addresses the gap that *would* exist:

- **`/review` and `/security-review`** — Anthropic built-ins, run by the builder before pushing. Free, already mandatory per `04-standards/pre-pr-checklist.md`.
- **CodeRabbit** — runs automatically on PR open. Flags credential-shaped patterns.
- **Approver Code Review Skill** — created May 6, 2026 at `02-skills/approver-review/`. Now includes an explicit secret-scanning instruction in its security dimension (patterns to watch: `sk-` prefixes, `eyJ` JWTs, 32+ character hex strings, `_KEY`/`_TOKEN`/`_SECRET`/`_PASSWORD` assignments, embedded URL credentials).
- **Foundation-phase admin bypass** — currently means Karim pushes direct to `main` without PR review. This is the genuine gap window. Closes when Joseph is review-capable. While active, mitigation is: Karim runs `/review` and `/security-review` before every push. Habit, not automation.

- [x] 🟠 Approver Code Review Skill drafted ✓ DONE May 6, 2026. Lives at `02-skills/approver-review/` with three files: `README.md` (orientation, when to use, how to use), `prompt.md` (Claude.ai paste-in version — fallback), and `claude-code/SKILL.md` (Claude Code slash command version — default, fetches PR data automatically via `gh pr view` / `gh pr diff` / `gh pr view --comments`). Six-dimension review: functional, UX/design, security (with explicit secret scanning), stack alignment, compliance (Law 25/PIPEDA), process. Layered output: executive summary + advisory recommendation on top, dimension findings below.
- [x] 🟠 **Install Claude Code skill at `.claude/skills/approver-review/SKILL.md`** ✓ DONE May 6, 2026 in PR #2 (commit 16b8c9c). Slash command `/approver-review` works end-to-end — verified on PR #2 itself, which produced a clean six-dimension report and an Approve recommendation.
- [x] 🟠 **AIS-8 (housekeeping PR — PR #4)** ✓ DONE May 7, 2026. Shipped: re-copied `02-skills/approver-review/claude-code/SKILL.md` from the handbook into the repo at `.claude/skills/approver-review/SKILL.md` (with the May 7 stale-path fix and the tightened Linear closing-keyword check); patched `CLAUDE.md` (`bun.lockb` → `bun.lock` and added the new "PR description conventions" subsection documenting `Closes AIS-X` vs `Part of AIS-X`); added the "Design system changes" sync checkbox to `.github/PULL_REQUEST_TEMPLATE.md`. Merged via merge commit 8dc324d. PR description used `Closes AIS-8` and AIS-8 auto-transitioned to Live on merge — first validation of the new convention.
- [ ] 🟢 **Re-evaluate Secret Protection when:** (a) Joseph is review-capable AND there are 3+ committers active in the steady-state PR review model, OR (b) `fitzrovia-tools` has 5+ live tools in `apps/`, OR (c) any real secret leak incident occurs (in which case revisit the day after). Until then, the layered review model is the defense.
- [ ] 🟢 **Re-evaluate Code Security when:** the codebase has 5+ live tools or non-trivial third-party dependencies. Same proportionate stance — Dependabot is nice-to-have but not as critical at Fitzrovia's scale and stage.

**Honest gap acknowledgement (still applies during foundation-phase admin bypass):** a hardcoded password in code that Claude Code generated would only get caught at PR review (CodeRabbit + approver-review skill), not at push time. During the foundation-phase bypass window where Karim is pushing direct to `main`, there's no PR review either — so the defence is Karim running `/review` and `/security-review` before every push, plus catching anything missed during a later PR's review. This gap is real and time-bounded; it closes when the foundation-phase bypass exception ends.

---

## Vercel configuration

### Team and project setup

The Fitzrovia Vercel team was created and configured on May 1. Settings captured for the record; the full decisions-and-state record lives in `06-operations/vercel-setup.md`.

**Plan and identity:**

- [x] 🔴 Vercel team `Fitzrovia` Pro plan paid (May 1, 2026)
- [x] 🔴 Team URL slug: `fitzrovia` (`vercel.com/fitzrovia`)

**Deployment Protection:**

- [x] 🔴 Vercel Authentication enabled — Standard Protection (preview URLs gated, production domains accessible for Entra SSO)
- [x] 🔴 "Require Owner role to disable or change Vercel Authentication settings" — checked

**Security & Privacy:**

- [x] 🔴 Require Verified Commits enabled — every Git commit must be cryptographically signed or the build is blocked. See "Commit signing setup" below for downstream implications.
- [x] 🔴 Enforce Sensitive Environment Variables enabled — env vars are write-only; once stored, no team member can read the plaintext value
- [x] 🔴 Two-Factor Authentication Enforcement enabled at the team level — Kenny and Joseph must have 2FA on their personal Vercel accounts before they can access the team
- [x] 🔴 IP Address Visibility — both "Show in Vercel Dashboard" and "Show in Log Drains" kept ON. Deliberate decision: visible IPs are needed for incident response per `05-policies/incident-response.md`. The privacy framing applies to external sharing, not internal observability.

**Personal account hygiene (Karim):**

- [x] 🔴 Karim's personal Vercel account 2FA enrolled via Microsoft Authenticator (TOTP)
- [ ] 🟡 Karim adds a Passkey as secondary auth method (optional convenience)

**Build and deployment defaults:**

- [x] 🟢 Build Machines: Standard (4 vCPUs, 8 GB Memory) as Team Default — sufficient for our scale; faster tiers cost more per minute and aren't needed
- [x] 🟢 Remote Caching: enabled (default)
- [x] 🟢 On-Demand Concurrent Builds: default behaviour kept
- [x] 🟢 Deployment Retention: defaults kept (Canceled 30d, Errored 90d, Pre-Production 180d, Production 1 year)

**Skipped (Enterprise-only, not worth the upgrade for our scale):**

- ⛔ Audit Logs (Enterprise only)
- ⛔ Protected Git Scopes (Enterprise only)
- ⛔ IP Blocking (Enterprise only)
- ⛔ Directory Sync (Enterprise only)

**Pending:**

- [x] 🔴 Connect Vercel team to GitHub org `fitzrovia-residential` ✓ DONE — verified May 4, 2026 (`fitzrovia-residential` org and `fitzrovia-tools` repo visible in Vercel's Git provider import dropdown; connection was already in place from original Vercel team setup)
- [ ] 🔴 Confirm region is Toronto (cle1) per the runbook (set per-project in `vercel.json`, not at team level — done as part of each app's import below)
- [ ] 🔴 Kenny written sign-off on Canadian region verification

### Vercel project imports — one per app (deferred until each app exists)

**Pattern:** Vercel's standard monorepo deployment model is one project per app, with the project's "Root Directory" pointed at the app's subfolder under `apps/`. Each app gets its own Vercel project, its own production URL, its own preview deployments, and its own environment variable scope. The hub deploys at `hub.fitzrovia.ca` and is conceptually the platform shell; each tool deploys at its own URL.

**The `fitzrovia-tools` repo root itself is never a Vercel project** — there's nothing to build at the root. Imports happen per app, when each app exists.

**Common configuration applied to every app's Vercel project at import:**

- Region: `yul1` (Toronto). Set in `vercel.json` at the app's root: `{"regions": ["yul1"]}`. Required for Canadian data residency / Law 25 alignment.
- Framework Preset: Next.js (auto-detected — confirm at import).
- Build & Output settings: defaults unless the app needs custom (rare).
- Environment variables: per-app, populated in Vercel dashboard. Real values never in code. See "Environment variables" below.
- SSO/Vercel Authentication: enabled for preview deployments (only `@fitzrovia.ca` accounts can access previews). Configured per-project at import.

**The `apps/hub/` project (first import — happens when `apps/hub/` exists):**

- [x] 🟠 **Vercel project name:** `hub` ✓ DONE May 7, 2026 (post-merge of PR #3). Project created in Fitzrovia team on Pro plan; auto-generated alias is `hub-flame-eight.vercel.app`. Cosmetic rename to something cleaner (e.g. `hub-fitzrovia.vercel.app`) deferred until pre-pilot.
- [x] 🟠 **Root Directory:** `apps/hub` ✓ DONE May 7, 2026 — set during dashboard import.
- [ ] 🟠 **Production URL:** `hub.fitzrovia.ca` — custom domain still pending Kenny's DNS provisioning. Initial dashboard import attempt May 7 failed because `apps/hub/` wasn't on `main` yet (PR #3 not merged); deferred and completed once PR #3 merged. Hub currently serves at `hub-flame-eight.vercel.app` with Vercel Authentication gating access to `@fitzrovia.ca` — fine for the foundation phase. DNS ask still pending Kenny per the original schedule (~1 week from non-builder pilot).
- [x] 🟠 **`vercel.json`** at `apps/hub/` with `{"regions": ["yul1"]}` ✓ DONE in PR #3 (AIS-7), commit f50f215.
- [x] 🟠 **Connected Git branch:** `main` (production) ✓ DONE May 7, 2026 — preview deployments will trigger automatically on every PR going forward.
- [x] 🟠 **Vercel Authentication on production:** ✓ DONE May 7, 2026. Standard Protection (covers all preview deployments + production on `*.vercel.app`); access list `@fitzrovia.ca` only. The "All Deployments" upgrade was offered ($X/mo extra to cover production custom domains) but skipped — by the time `hub.fitzrovia.ca` lands, PR #4 will have wired Microsoft Entra SSO at the application layer, which handles access there. Standard Protection is sufficient.

**Subsequent app imports (each `apps/<tool-name>/` when created):**

- [ ] 🟢 Each tool follows the same pattern: project name = folder name, root directory = `apps/<tool-name>`, region = `yul1`, custom domain decided per tool (likely subdomain on `fitzrovia.ca` or a path under `hub.fitzrovia.ca` — TBD).

### Commit signing setup

Source: Vercel "Require Verified Commits" setting enabled May 1, 2026. Full setup steps live in `06-operations/commit-signing-setup.md`.

Because Vercel rejects unsigned commits, every builder must set up commit signing locally as a one-time configuration. Without commit signing configured, the builder's pushes will fail to deploy — they'll see a Vercel build error rather than a working preview.

- [x] 🔴 Karim sets up commit signing on his local Windows + VS Code environment (Done May 1, simplified May 6, 2026. **Original setup (May 1):** SSH-based signing with two separate keys (`fitzrovia_signing` + `fitzrovia_auth`), both Ed25519 with passphrases, stored in `~/.ssh/`. Allowed_signers file configured for local verification. **Simplified (May 6):** Migrated to a single combined SSH key (`fitzrovia`) with no passphrase. Old keys deleted from disk and from GitHub. The four-passphrase-prompts-per-push friction is gone — every commit and push is now silent. `06-operations/commit-signing-setup.md` rewritten as v2.0.0 to match the simpler reality. Underlying security still strong via BitLocker, GitHub branch protection, CODEOWNERS approval, and CodeRabbit's required check.)
- [x] 🔴 Document the actual Windows-specific setup steps in `06-operations/commit-signing-setup.md` (Done May 1.)
- [x] 🔴 Update `06-operations/development-setup.md` milestone 7 to point to the dedicated guide (Done — milestone 7 in v2.1.1.)
- [ ] 🟠 Kenny sets up commit signing on his local environment when he accepts the GitHub invite. He'll follow `06-operations/commit-signing-setup.md`. Heads-up included in the upcoming Kenny email.
- [ ] 🟠 Joseph sets up commit signing during onboarding — follows `06-operations/commit-signing-setup.md` as a Day 1 item.

### Environment variables

Source: `06-operations/development-setup.md` (to be drafted).

- [ ] 🟠 Establish convention: production env vars live in Vercel dashboard only, never in code or repos
- [ ] 🟠 Document which env vars belong to which app — single registry, accessible to Karim and Kenny

### Preview deployments

Source: `04-standards/branching-and-prs.md`, "Testing before merge" section.

- [x] 🟠 Verify every PR auto-deploys to a Vercel preview URL ✓ DONE in AIS-10 (PR #6, May 8). Confirmed: every PR since #3 has had a Vercel preview deploy; the preview URL is in the Vercel-bot comment on each PR. PR #6's preview accessed at `hub-git-…vercel.app` (Vercel auto-truncates/hashes long branch names — branch was 51 chars, exceeding the 63-char subdomain label limit; the actual preview URL must be retrieved from the PR's Vercel-bot comment, not constructed by hand).
- [x] 🟠 Verify preview URLs are SSO-protected (only @fitzrovia.ca accounts can access) ✓ DONE in AIS-10 (PR #6, May 8) — Karim's incognito check (V4): hit PR #6's preview URL in fresh Chrome incognito, Vercel Authentication challenge appeared, login via email magic link succeeded, app rendered through preview. **Important nuance:** what's actually configured is "Vercel team members only" (Standard Protection), not literal `@fitzrovia.ca`-domain auth. Today only Karim and Kenny (Vercel team members) can access previews. To extend to non-builder Fitzrovia staff (Corey, Adrian, etc.) without giving them Vercel team seats, configure Vercel's domain-based access feature at the team level. **Tracked as a follow-up** — see new "Vercel preview access expansion" item below.
- [ ] 🟠 Verify previews connect to development Supabase, not production. **Cannot verify until first Supabase-using app exists** — `apps/hub/` is statically prerendered and does not connect to Supabase. Verification deferred to the first app that does (likely `apps/intake/`).

### Vercel access groups

Source: glossary; `05-policies/access-control.md`.

- [ ] 🟡 Establish per-tool Vercel access group convention
- [ ] 🟡 Wire access groups to Microsoft 365 groups via SSO

---

## Design system package

Source: `01-design-system/design-system.md` (handbook canonical spec) and `packages/design-system/` (in-repo materialization, what code consumes).

### Three-source sync model

The design system lives in three places. Each must stay in sync:

- **In-repo `packages/design-system/`** — canonical for code; what every app imports via `@fitzrovia/design-system`.
- **Handbook `01-design-system/`** — authoritative documentation derived from in-repo.
- **Claude Design entry** ("Fitzrovia Design System" in Anthropic Labs Claude Design) — prototyping reference derived from in-repo.

When the design system changes, in-repo lands first; handbook and Claude Design follow. The PR template in `.github/PULL_REQUEST_TEMPLATE.md` should enforce this with a checkbox — scoped into the AIS-8 housekeeping PR.

### Versioning

Per-package semantic versioning. Handbook `01-design-system/design-system.md` and `01-design-system/colors_and_type.css` carry matching version headers and a Changelog at the bottom.

### Configuration timeline

- [x] 🟠 **v1.0.0 — Initial spec** ✓ DONE May 6, 2026 via Claude Design over the support widget design session (the design system fell out of that work as a by-product). Captures brand palette (orange / navy / blue-light / grey), warm-grey neutrals, paper/surface/border semantic tokens, Poppins typography, 4/8/12/16/24/32/48/64/96 spacing scale, 4–8px radii, navy-tinted shadows, motion tokens, layout tokens. Lives at `01-design-system/design-system.md` and `01-design-system/colors_and_type.css`.

- [x] 🟠 **v1.0.0 — In-repo package draft** ✓ PARTIAL May 6, 2026 in PR #2 (commit 5f3a6e6 — monorepo scaffolding). Created `packages/design-system/` with TypeScript token exports + CSS custom properties. **Note discovered May 7, 2026:** this initial materialization didn't fully match the handbook v1.0.0 spec — used `--color-brand-*` naming with a cool zinc grey palette instead of the canonical `--fz-*` naming with warm greys + paper/surface/border semantic tokens. The package was technically v1.0.0 but materialized only partially. No consumers existed yet, so the discrepancy was harmless. Resolved during PR #3 (see v1.1.0 below).

- [x] 🟠 **v1.1.0 — Hero display sanctioned exception (handbook)** ✓ DONE May 6, 2026. Handbook docs updated: `01-design-system/design-system.md` adds "Hero display (sanctioned exception)" section between Typography and Content fundamentals; `01-design-system/colors_and_type.css` adds `--fs-hero-display: clamp(48px, 8vw, 128px)` token plus `.fz-hero-display` and `.fz-hero-display--skewed` utility classes. Restricts use to landing-page hero anchors only (the `apps/hub/` landing); explicitly forbidden inside tools, page titles, card titles, sidebar labels, body. Driven by the decision to replicate Joseph's landing-page treatment (skewed -6° giant uppercase headline) under our stack — the visual was kept as a sanctioned exception rather than letting Joseph's bespoke styling override the design system. Same handbook update also relaxed the landing/login imagery rule from "single full-bleed property photograph on the left half" to "full-bleed looping property video, full-width, 100vh, with prefers-reduced-motion fallback to a poster frame." Iconography section also gained a note about white-variant logo handling on dark hero backgrounds.

- [x] 🟠 **v1.1.0 — In-repo materialization** ✓ DONE May 7, 2026 in PR #3 (AIS-7), commit c3471dc. Brought `packages/design-system/` into alignment with the canonical handbook v1.1.0 spec: token rename `--color-brand-*` → `--fz-*`; cool zinc palette replaced with warm grey series matching the handbook; added paper/surface/border/surface-alt/border-strong neutral semantic tokens; added orange-600 (pressed/hover-darken), orange-100 (soft wash), orange-50 (avatar wash), navy-600/navy-800 (hover/elevated), blue-50 (softer surface tint) shade variants; added letter-spacing tokens (`--tracking-tight/normal/wide/wider`); added the hero-display sanctioned exception (token + classes). Also resolved the `noEmit` + `composite` tsconfig conflict in `packages/design-system/tsconfig.json` by replacing `noEmit: true` with `emitDeclarationOnly: true`. No existing consumers, so the renaming was a no-op breaking change in practice.

- [x] 🟠 **v1.1.0 — Claude Design entry sync** ✓ DONE May 7, 2026 via Claude Design chat. Added the "Hero display" sanctioned exception as a typography variant with the same use restrictions encoded in the description. Existing tokens reviewed for parity with the canonical CSS variables (navy, orange, paper, warm-grey series, 4–8px radii, no serifs); existing palette confirmed correct.

### First consumer

- [x] 🟠 **`apps/hub/` is the first consumer of the design-system package** ✓ DONE May 7, 2026 in PR #3 (AIS-7). Imports `@fitzrovia/design-system` via Bun workspace dependency. Tailwind v3 added in the same PR, configured to bridge design-system CSS variables via `theme.extend.colors` referencing `var(--fz-*)` rather than redefining values. Establishes the canonical pattern for every future app: use Tailwind, but bridge to the design-system tokens, never redefine colors/spacing/typography.

### Outstanding design-system items

- [ ] 🟢 **Hero display skewed-centered modifier (v1.2.0 candidate).** The skewed `.fz-hero-display--skewed` class uses `transform-origin: bottom left` (Joseph's pattern for left-aligned text). When centered (apps/hub uses centered text), the skew renders asymmetrically; PR #3 worked around it with an inline `style={{ transformOrigin: 'center' }}` override. Cleaner approach: add a `.fz-hero-display--skewed-centered` modifier in v1.2.0 that bakes in the centered transform-origin. Surfaced as a `/review` finding during PR #3, deferred. Standalone design-system PR when ready.

- [ ] 🟢 **Landing-page spacing tokens (v1.2.0 candidate).** PR #3 adopted Joseph's marketing-style spacing rhythm in `apps/hub/` (`mb-14` = 56px, `py-32` = 128px, `lg:text-[1.7rem]` ≈ 27.2px) which falls outside the canonical 4/8/12/16/24/32/48/64/96 scale. Acceptable as part of the landing-page exception spirit (same exception philosophy as the hero-display variant). If the landing pattern needs to repeat for other surfaces, codify these as named landing-page spacing tokens. Surfaced in the AIS-7 approver-review as a Nice-to-have; not blocking.

- [ ] 🟠 **PR template design-system sync checkbox.** Add to `.github/PULL_REQUEST_TEMPLATE.md`: a "Design system changes" section forcing explicit acknowledgement when changes touch the design system (in-repo package + handbook + Claude Design). Scoped into AIS-8 (housekeeping PR).

---

## Password vault setup

Source: `06-operations/development-setup.md` Step 5 references "Fitzrovia's password vault" as the source of real env var values; this section captures setting it up.

The development-setup runbook tells builders to "get values from Karim or Kenny (the password vault)." That assumes a vault exists. Right now it doesn't — 1Password is deferred until Builders 4 and 5 join. This section captures the interim arrangement so the reference in development-setup isn't a dead pointer.

### Interim arrangement (until 1Password)

- [ ] 🔴 Decide on the interim secret store. Options: a shared encrypted note in Microsoft Authenticator's vault that Karim and Kenny both have access to; a SharePoint site with restricted access; an existing Fitzrovia password manager if one is already in use. Pick one before Friday so the development-setup runbook has a real referent.
- [ ] 🔴 Establish the convention: when a builder needs an env var value, they ask Karim or Kenny via Microsoft Teams. Karim or Kenny retrieves the value from the interim store and shares it via Teams direct message (not group chat).
- [ ] 🟠 Document which env vars exist, what each is for, and where its real values live (interim store vs Vercel dashboard). Keep this as a private note, not in the handbook.
- [ ] 🟢 Migrate to 1Password when Builders 4 and 5 join.

### Once 1Password is in place (deferred)

- [ ] 🟢 1Password Business plan paid
- [ ] 🟢 Fitzrovia AI Studio vault created in 1Password
- [ ] 🟢 All builders added with access scoped to the AI Studio vault
- [ ] 🟢 All env vars migrated from interim store to 1Password
- [ ] 🟢 Update `06-operations/development-setup.md` to reference 1Password specifically rather than "the password vault" generically

---

## Supabase configuration

### Org-level configuration (done May 1, 2026)

The Fitzrovia Supabase organisation was created and configured on May 1. Settings captured for the record; the full decisions-and-state record lives in `06-operations/supabase-setup.md`.

**Plan and identity:**

- [x] 🔴 Org `Fitzrovia` on Pro plan ($25 USD/mo, paid May 1)
- [x] 🔴 Organization name: `Fitzrovia`
- [x] ⛔ Organization slug stays as auto-generated `credaozaqnbkqcxpnjug` — Supabase makes the slug read-only on Pro plan, can't be changed. Cosmetic only; no functional impact since navigation happens via the dashboard sidebar, not URL typing. Don't waste time trying to change it.

**Data privacy:**

- [x] 🔴 Supabase Assistant Opt-in Level: **Disabled** — no data shared with third-party AI providers. Deliberate decision: we handle Red-classified data (per `05-policies/data-classification.md`) and don't have data processing agreements with Supabase's AI provider partners. Even Schema Only would leak operational signals via table/column names.

**Security:**

- [x] 🔴 "Require MFA to access organization" enabled — every member must have MFA on their personal Supabase account before accessing org resources
- [x] 🔴 Karim's personal Supabase account MFA enrolled via Microsoft Authenticator (TOTP), labeled

**Plan-gated features deliberately not pursued:**

- ⛔ **SAML SSO** — gated behind Team plan ($599/mo). Skipped: $574/mo extra over Pro is not justified for SSO when the practical offboarding burden is "Karim manually removes Kenny's Supabase membership within a day, twice ever." See `05-policies/access-control.md` for the manual-offboarding caveat this creates. Revisit if team grows past Karim/Kenny/Joseph or if compliance pressure changes.
- ⛔ **Audit Logs** — gated behind Team plan ($599/mo, 62-day retention). Skipped for the same reason. Audit trail for incident response comes from Supabase database logs (Pro), Vercel deployment logs (Pro), GitHub commit history, and Microsoft 365 audit logs (Kenny's domain) — sufficient for our scale.
- ⛔ Note: Team plan upgrade would unlock both SSO and Audit Logs together. If the upgrade ever becomes justified, both benefits arrive at once.

**Members:**

- [x] 🔴 Karim Mourad — Owner
- [ ] 🔴 Kenny Marcano — to be invited as Owner. Universal admin model from `05-policies/access-control.md`. Heads-up included in upcoming Kenny email (he'll need MFA enabled on his personal Supabase account before he can access).
- [ ] 🟢 Joseph — defer until he onboards into a working environment after Tool Starter exists

### Project setup

- [x] 🔴 Create `fitzrovia-prod` project in `ca-central-1` ✓ DONE May 4, 2026 (compute: `t4g.micro`; API URL: `https://vshalfxsydyjlouwbfmx.supabase.co`; security toggles: Data API ON, auto-expose new tables OFF, automatic RLS ON)
- [ ] 🟠 Run `tool_activity_log` schema (deferred — design alongside the support widget package or first foundation tool when we have concrete usage to design against; roadmap Section 10 / runbook Step 11)

### IP whitelisting — deferred

**Office IPs (from Kenny, May 4, 2026):**

- Toronto office: `173.243.205.62`
- Montreal office: `75.98.201.98`

**Decision (May 4, 2026): defer all IP whitelisting.** With a single developer and no production traffic, IP allowlisting is premature complexity. Today's security posture relies on: Supabase auth + MFA on owner accounts, Postgres roles, RLS policies on Red tables, and treating connection strings as secrets stored in Vercel and `.env.local`. None of those depend on IP allowlisting.

**Two distinct decisions wrapped under "IP whitelisting":**

- **Decision A — Database connection allowlisting.** Restricts who can `postgres://` connect to the database directly. Affects Vercel's serverless functions (which connect from Vercel's IP ranges, *not* Fitzrovia office IPs). Mis-applying this breaks production. If we ever apply it, we need Vercel's egress IP ranges (or Vercel's Dedicated Egress IP feature on Pro+) added alongside the office IPs.
- **Decision B — Supabase Dashboard allowlisting.** Restricts who can log into the Supabase web UI. Doesn't affect runtime traffic. Lighter to apply; the office IPs above would be the natural starting allowlist. This is probably what Kenny had in mind when he sent the IPs, but worth confirming with him before applying.

**Trigger for revisiting:** before the first non-Karim user (Kenny accessing the dashboard, Joseph onboarding to development) accesses the production project. At that point, restricting admin access starts to matter and we'll also have a clearer picture of where Vercel connects from. Re-engage Kenny in that conversation; apply Decision B at minimum, evaluate Decision A separately.

- [ ] 🟠 Apply Decision B (Dashboard allowlist) when first non-Karim user accesses the project. Ask Kenny to confirm IPs are still current. Use Toronto + Montreal IPs above; add any work-from-home IPs Kenny or Joseph need.
- [ ] 🟢 Evaluate Decision A (Database allowlist) once we have real Vercel egress data and a real production deployment. Likely deferred until the studio is well past foundation phase.

### Row-Level Security

Source: `04-standards/codebase-organization.md`; glossary entry on RLS.

- [ ] 🟡 Establish convention: every table holding Red-classified data has RLS policies defined. "Red" includes both personal data (tenant PII, employee compensation) and commercial data (per-property financials, vendor pricing) per `05-policies/data-classification.md`.
- [ ] 🟢 CI check for RLS on Red tables (see "GitHub Actions / CI" below)

### Database schema for shared entities

Source: `04-standards/codebase-organization.md`, "How shared entities relate to Yardi and Supabase".

- [ ] 🟡 Confirm Yardi → Supabase data pipeline is one-way (Yardi is source of truth; tools read from Supabase, never write back to entity tables)
- [ ] 🟡 Document existing Yardi-mirrored tables in Supabase as the basis for `packages/shared-entities/` types

---

## Claude Teams configuration

The Fitzrovia Claude Teams workspace was created and configured on May 1. Settings captured for the record and as input to `06-operations/claude-teams-setup.md` (to be drafted).

### Org-level configuration (done May 1, 2026)

**Plan and identity:**

- [x] 🔴 Workspace `Fitzrovia Residential Inc.` on Team plan, paid May 1 (CA$658.46 first invoice; CA$582.71 expected ongoing per memory — investigate if June 1 invoice doesn't match)
- [x] 🔴 5 total seats allocated. Original Finance plan: 3 Premium + 2 Standard. Current actual state as of May 4, 2026: 3 Premium (Karim Active, Joseph Pending, Kenny Pending) + 1 Standard (Corey Pending) = 4 used, 1 available. The allocation is still 5 total — what shifted is one of the Standard slots has not yet been issued to anyone (no second non-builder yet beyond Corey). Kenny's seat may also be returned if he doesn't end up needing one (he's IT, not a builder); revisit when his seat decision is finalized.
- [x] 🔴 Karim Mourad — Primary Owner, Premium seat, Active
- [x] 🔴 Allowed email domains: `fitzrovia.ca` only
- [x] 🔴 Monthly billing, next invoice June 1, 2026 (no annual commitment per established stance)
- [x] 🔴 Payment method: Visa ending 8456 (corporate card)
- [ ] 🟡 Verify the "2 members" count on the May 1 invoice (only 1 actual member exists). Likely a billing-display quirk; not blocking.

**Identity and access — locked down:**

- [x] 🔴 Domain discoverable: OFF (`@fitzrovia.ca` users cannot discover and request to join)
- [x] 🔴 Invite link: OFF (deliberate; prevents back-channel joining outside the joint Karim+Corey approval flow)
- [x] 🔴 Member invites: OFF (deliberate; only the Primary Owner can invite, keeps Standard-seat allocation under joint control)
- [x] 🔴 User provisioning: Invite only (JIT off; manual provisioning is the right model at 5 seats)
- [x] 🔴 New member approval: Require admin approval (no longer visible since the upstream invite paths are off, but it's the safety net)
- [ ] 🟡 Domain verification (DNS-based, Kenny's task) — required before SSO can be configured. Captured in the upcoming Kenny email.
- [ ] 🟡 SSO via Microsoft Entra — pending domain verification + Kenny's broader SSO rollout

**Data and privacy:**

- [x] 🔴 Anthropic does not use Team-plan customer data for training (contractual default on Team plan; no toggle to verify but documented in Anthropic's Commercial Terms)
- [x] 🔴 Rate chats: ON (response feedback to Anthropic; no PII; standard practice)
- [x] 🔴 Share chats: ON (org-internal sharing; supports collaborative AI Studio work)
- [x] 🔴 Share chats that use connectors: ON (with awareness — recipients see Claude's response, not raw connector data, but responses can summarize sensitive content; revisit when first connector is added)
- [x] 🔴 **Location metadata: OFF** (deliberate; Claude doesn't need user city/region for AI Studio work, and it's PII under Law 25/PIPEDA)
- [x] 🔴 **Public projects: OFF** (deliberate; Projects default to private rather than org-wide visible — matches `05-policies/access-control.md` "hidden by default" principle)

**Capabilities — kept open per "speed not bank" stance:**

- [x] 🔴 Claude Design (Beta): ON (deliberate; builders should have access to Anthropic's full toolkit including beta features)
- [x] 🔴 Web search: ON
- [x] 🔴 Interactive content: ON (maps, images, charts via third-party services)
- [x] 🔴 **Ask Fitzrovia: ON** (org-wide search across connected data sources). No connectors are connected today; effect is zero until a connector is added. **Re-evaluate scope at the moment a SharePoint or Drive connector is added** — at that point, decide whether org-wide search is still desired or whether per-user scoping via Projects is preferable.
- [x] 🔴 Inline visualizations: ON
- [x] 🔴 Code execution and file creation: ON (core to handbook document pipeline and other work)
- [x] 🔴 Allow network egress: ON, "Package managers only" (Claude can install npm/pip/etc. libraries but not reach arbitrary domains)

**Claude Code — kept open per same stance:**

- [x] 🔴 Code in CLI / Code in IDE: ON (always-on; standard usage)
- [x] 🔴 Code in the web (Preview): ON (cheap optionality; no concrete use case today but easy to disable later if it causes problems)
- [x] 🔴 Code in the desktop: ON (kept available; Joseph may prefer it over VS Code extension when he onboards)
- [x] 🔴 Allow bypass permissions mode: ON (builder discretion; not enforced as forbidden)
- [x] 🔴 Allow auto permissions mode: ON (builder discretion)
- [x] 🔴 Fast mode: OFF (default; revisit if speed becomes a constraint and budget allows)
- [x] 🔴 Remote Control (Research preview): ON (kept on; harmless if unused)
- [x] 🔴 Claude Code analytics: ON (track accept rates, code generated)
- [x] 🔴 GitHub analytics (Beta): ON, but GitHub not connected yet — connect when monorepo exists
- [x] 🔴 Allow channel notifications (Channels Preview): ON (kept on; harmless if no MCP servers configured)
- [ ] 🟡 Code Review (Anthropic's PR review feature): not configured. CodeRabbit is the chosen review tool for Phase 1. Re-evaluate after CodeRabbit has been used for several weeks if it's not meeting needs.
- [ ] 🟡 Managed settings (settings.json): not configured. Premature without builder usage data; revisit after foundation phase identifies settings worth standardizing across the team (e.g., default to a specific Fitzrovia skill, model preferences).

**Configuration philosophy captured (worth recording explicitly):**

The Capabilities and Claude Code sections were initially proposed for aggressive lockdown (disabling beta features, preview features, and permission modes by default). On reflection that approach was rejected as exactly the "operating like a bank" failure mode the AI Studio is structured to avoid. Decision: enable features by default, let builders use them, evaluate based on real usage rather than hypothetical risk. Disable later if something causes actual problems. This applies specifically to Claude Teams feature toggles. Things with concrete durable consequences (privilege escalation, signed-commit enforcement, MFA on database admin) merit caution; preview-feature toggles do not.

**Members:**

- [x] 🔴 Karim Mourad — Primary Owner, Premium seat
- [ ] 🟡 Kenny Marcano — defer until SSO is wired up so he gets a clean SSO-based account from the start. Per memory, Kenny may not need a seat at all (he's IT, not a builder) — confirm with him before assigning.
- [x] 🔴 Corey Pacht — **Standard** seat (CA$34.27/mo). Seat issued May 4, 2026; status pending acceptance. Tier corrected from earlier plan (which had him at Premium). Standard is correct per the roadmap's tier model — Corey is a non-builder using Claude as an AI assistant, not pushing code.
- [ ] 🟢 Joseph — defer until onboarding into a working environment after Tool Starter exists
- [ ] 🟢 Additional Standard-seat requests — gated on June 2026 ChatGPT Enterprise renewal decision; each request jointly approved by Karim + Corey. Total Standard seat count tracked here. **Current count: 1** (Corey). Threshold for proposal escalation: 10.

### Skills configuration

- [x] 🟡 Existing "Fitzrovia Code Review Skill" — already configured per memory
- [~] 🟢 New skills — `approver-review` ✓ DONE May 6, 2026 (lives at `02-skills/approver-review/`); `pr-description` ✓ DRAFTED May 6, 2026 (lives at `02-skills/pr-description/`, status: draft, awaits real-usage validation on the next PR). `intake-triage` and `tool-spec` deferred to post-foundation work; need real tools and real workflows before designing them.

---

## CodeRabbit configuration

The CodeRabbit GitHub App was installed on `fitzrovia-residential` and configured on May 4, 2026. Settings captured for the record and reflected in `06-operations/coderabbit-setup.md`.

### Org-level configuration (done May 4, 2026)

**Plan and billing:**

- [x] 🔴 CodeRabbit Pro plan ($30 USD/active user/month, monthly billing)
- [x] 🔴 Pro Plus 14-day trial active until May 18, 2026; auto-converts to Pro on May 19
- [x] 🔴 Calendar reminder set for May 16 to decide convert/upgrade/cancel
- [x] 🔴 Payment: Fitzrovia corporate Visa ending 8456
- [x] 🔴 Active users today: 1 (Karim). Will scale as Kenny and Joseph become active reviewers.

**Why monthly billing**: Same logic as the other platforms — annual saves $72/seat/year but commits us before we have real usage data on review quality. Monthly preserves optionality at small premium.

**Scope:**

- [x] 🔴 GitHub App installed on the `fitzrovia-residential` organization (NOT on Karim's personal account)
- [x] 🔴 Repository scope: All repositories in the org (means future `fitzrovia-tools` is auto-covered when created)
- [ ] 🔴 Add `fitzrovia-tools` monorepo when created (Wednesday-ish; should appear automatically due to "All repositories" scope but verify)

**Reviews — Profile:**

- [x] 🔴 Profile: **Chill** (default; matches programme philosophy of less noise for non-technical builders). Re-evaluate to Assertive only if real bugs slip past.

**Reviews — Walkthrough features:** All seven kept ON (Karim's choice during May 4 setup). Watchlist for revisit after first 3-5 PRs:
- [ ] 🟡 **Sequence diagrams** — likely noise; auto-generated diagrams from code changes are usually low-quality. Disable if reviewers consistently skip.
- [ ] 🟡 **Related issues / Related PRs** — returns nothing useful in a brand-new monorepo with no PR history. Revisit after PR history accumulates.
- [ ] 🟡 **Suggested labels** — less useful since Linear handles project tracking, not GitHub labels. Likely disable.
- [x] 🔴 Collapse walkthrough, Changed files summary, Estimate review effort — all useful, keep on.

**Reviews — Behavior (critical safety toggles):**

- [x] 🔴 **Request changes workflow: OFF** — CodeRabbit must never auto-approve PRs. Per the layered review model, only humans approve.
- [x] 🔴 **Auto assign reviewers: OFF** — `.github/CODEOWNERS` handles assignment, not CodeRabbit.

**Reviews — Other Behavior settings:**

- [x] 🟡 Path instructions: empty (defer until folders need different review guidance)
- [x] 🟡 Path filters: empty (will set when monorepo exists; expect to exclude `node_modules/`, build output, generated types)
- [x] 🟡 Labeling instructions: empty (we don't use GitHub labels heavily)
- [x] 🔴 Mode: Concise

**Pre-merge checks:** All defaults left as-is (kept at Warning, not Error — comments but doesn't block merge).
- [x] 🟡 Custom pre-merge checks: none (Pro Plus feature; not defining custom checks today)
- [x] 🟡 **Docstring coverage: Warning at 80%** — likely too high for non-technical builders + AI-generated code; lower threshold or disable if warnings become noise everyone skips.
- [x] 🟡 **Title check: Warning, no requirements specified** — currently a no-op. Either define title requirements or disable.
- [x] 🔴 Description check: Warning (useful — nudges builders to write clearer PR descriptions)
- [x] 🔴 Linked issue assessment: Warning (useful once Linear is connected; currently checking against nothing)

**Finishing touches (Pro Plus trial only — disable May 19 unless we upgrade):**
- [x] 🟡 Docstrings auto-generation: ON during trial
- [x] 🟡 Unit test generation: ON during trial

**Statuses:**
- [x] 🔴 Auto apply labels: OFF
- [x] 🔴 Auto title instructions: empty (default behavior)

**Fun:**
- [x] 🔴 All fun features disabled (poems, fortunes, ASCII art, custom tone)

### Pending integrations

**Linear integration — pending, deferred to Wednesday May 6**

- [x] 🟠 Connect Linear to CodeRabbit via Settings → Integrations → Linear ✓ DONE in AIS-10 (PR #6, May 8). Karim completed the OAuth handshake from CodeRabbit dashboard → Settings → Integrations → Linear → Connect. Connected to fitzrovia-residential workspace, AI Studio team. The integration paired with `.coderabbit.yaml`'s `knowledge_base.linear.usage` and `chat.integrations.linear.usage` config keys.
- [x] 🟠 Verify "Linked issue assessment" pre-merge check actually validates against Linear tickets after connection ✓ DONE in AIS-10 (PR #6, May 8). Confirmed via PR #6's CodeRabbit pre-merge checks panel: all 5 checks passed including Linked Issues. CodeRabbit successfully read AIS-10's Linear ticket and validated the PR delivered against the ticket's stated scope.

The Linear integration lets CodeRabbit see linked Linear issues when reviewing PRs and validate that PRs address the linked tickets. The "Linked issue assessment" pre-merge check is enabled but useless until Linear is connected. Deferred from May 4 to keep the initial setup focused; will be added Wednesday alongside connecting the `fitzrovia-tools` monorepo.

**MCP integrations — skipped:**
- ⛔ Context7, PostHog, Linear-via-MCP — not on roadmap. Default CodeRabbit context is sufficient at our scale.

**Jira and Circle CI — not applicable:**
- ⛔ Not used at Fitzrovia.

### Watchlist (revisit after first 3-5 real PRs)

Captured in `06-operations/coderabbit-setup.md` in detail. Summary of items deliberately left at default that may want adjustment based on real PR experience:

1. Walkthrough features (Sequence diagrams, Related issues/PRs, Suggested labels) — likely noise
2. Docstring coverage threshold — likely too high
3. Title check — currently checking nothing
4. Path filters and Path instructions — empty until monorepo shape is real
5. Pro Plus features — disable May 19 unless real value found

The discipline: don't pre-optimize. Use defaults, observe real PR behavior, prune what's clearly noise.

### Repo-level configuration (deferred until monorepo exists)

- [x] 🟠 Create `.coderabbit.yaml` in monorepo root with Fitzrovia-specific settings ✓ DONE in AIS-10 (PR #6, May 8, commit 82fb4d0). Configured: `reviews.profile: chill` (matches org-level), `reviews.path_filters` excluding bun.lock + .next/ + dist/ + build/ + node_modules/ + public/, `knowledge_base.code_guidelines.filePatterns` referencing `**/CLAUDE.md` (explicit), `path_instructions` adding tighter scrutiny on `packages/**` (shared code) and lighter on `apps/**` (app code), `knowledge_base.linear.usage: auto` + `chat.integrations.linear.usage: auto`. **Schema deviation worth noting:** the AIS-10 ticket scoped `tools.linear: enable` based on stale knowledge of the schema; the actual current CodeRabbit config schema has no top-level `tools` key. Linear integration toggles live under `knowledge_base.linear.usage` and `chat.integrations.linear.usage`. Documented in PR #6 description for future reference.
- [x] 🟠 Verify CodeRabbit picks up `fitzrovia-tools` automatically once it exists (due to "All repositories" scope) ✓ Verified May 4, 2026 — did NOT auto-pick up; resolved via "Add Repositories" re-run. See `06-operations/coderabbit-setup.md` for the operational lesson.
- [x] 🟠 Verify CodeRabbit auto-detects `CLAUDE.md` as code guidelines on the next PR ✓ DONE in AIS-10 (PR #6, May 8). CodeRabbit's reviews on PRs #4, #5, and #6 all reference Fitzrovia-specific conventions from CLAUDE.md (Bun-only, signed commits, AIS-XX branch format, the `Closes AIS-X` keyword convention, foundation-phase admin bypass). Auto-detection works as documented at `docs.coderabbit.ai/knowledge-base/code-guidelines`. AIS-10 also added an explicit `knowledge_base.code_guidelines.filePatterns: ["**/CLAUDE.md"]` in `.coderabbit.yaml` as defense-in-depth, even though auto-detection makes it redundant.
- [x] 🟡 Verify CodeRabbit-status-required is set in branch protection on `main` (combined with PR template checkbox enforcement) ✓ DONE May 5, 2026. CodeRabbit added as required status check on `main protection` ruleset.
- [ ] 🟡 Configure path-aware review depth: deeper review on `packages/auth/`, `packages/supabase-client/`, `packages/activity-log/` (matches dual-approval requirement at human level)

---

## ESLint configuration

To be documented in full in `04-standards/ci-configuration.md` (post-foundation Critical doc).

### Base configuration

- [x] 🟠 Install ESLint with Next.js + TypeScript preset ✓ DONE in AIS-10 (PR #6, commit abe4a1f). Installed `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-next`, `eslint-config-prettier` at monorepo root. `.eslintrc.json` extends `next/core-web-vitals` + `next/typescript` + `prettier`. `eslint-config-next` pinned to `^15.5.0` (not v16) to match the Next.js 15.5.16 + ESLint 8.57 stack — v16 expects ESLint 9. ESLint 9 / flat config / eslint-config-next v16 migration is formally deferred (see new "Open future migrations" item below). Lint output on tip is silent — 0 errors, 0 warnings. The long-deferred soft Next.js ESLint plugin warning carried since AIS-7 batch 1 is now resolved.
- [x] 🟠 Install Prettier and configure for auto-format ✓ DONE in AIS-10 (PR #6, commit abe4a1f). Installed `prettier` + `prettier-plugin-tailwindcss` at root. `.prettierrc.json` configured: `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `plugins: ["prettier-plugin-tailwindcss"]`. `.prettierignore` excludes node_modules, .next, dist, build, bun.lock, public/, *.md (except CLAUDE.md). One-time backfill (commit ee3e3e5) reformatted the entire codebase — ended up touching only one file (PageIntro.tsx Tailwind class reorder), proving Claude Code's foundation-phase output was already Prettier-compliant by default. Format scripts: `bun run format` (write) and `bun run format:check` (CI gate).

### Fitzrovia-specific rules

Source: `04-standards/codebase-organization.md`, "Imports and module boundaries".

- [ ] 🟡 **Rule: no cross-app imports.** Apps in `apps/` cannot import from other apps in `apps/`. Custom ESLint rule or `eslint-plugin-boundaries` configured to enforce this. Violations fail CI.
- [ ] 🟡 **Rule: alias imports only for shared packages.** All imports from `packages/` must use `@fitzrovia/<package>` alias, never relative paths. Configurable via ESLint's `no-restricted-imports` rule.
- [ ] 🟡 **Rule: no entity definitions outside `packages/shared-entities/`.** Any file in `apps/` defining a type named `Building`, `Unit`, `Tenant`, `Employee`, `Vendor`, or `Property` (or anything that looks like the canonical entity shape) gets flagged. This may need a custom ESLint rule.
- [ ] 🟢 **Rule: activity-log coverage.** PRs touching user-action paths must call `logActivity` from `packages/activity-log/`. Detection logic TBD; possibly a CodeRabbit pattern rather than ESLint.

### Pre-commit hooks

- [x] 🟠 Configure Husky or equivalent to run ESLint and Prettier on `git commit` ✓ DONE in AIS-10 (PR #6, commit 2604f1c). Installed `husky` + `lint-staged` at root. `.husky/pre-commit` runs `bunx lint-staged`. `lint-staged` config in root `package.json` maps file patterns to commands: `*.{ts,tsx,js,jsx}` → `prettier --write` then `eslint --fix`; `*.{json,css,md}` → `prettier --write` only. **Pre-commit speed:** ~1–2s per single-file commit (vs ~10s for the prior full-repo lint+format+typecheck chain we tried first). 4-phase end-to-end verification confirmed in PR #6: hook fires on commit, BLOCKS on eslint errors, ALLOWS clean files, `--no-verify` bypass works. **Trade-off:** TypeScript type-checking is NOT in the pre-commit hook (consistent with the "Standard" pre-commit strictness decision); type errors caught by IDE TS server + CodeRabbit + Vercel preview build instead.
- [x] 🟠 Block commits that have unfixed ESLint errors (warnings allowed) ✓ DONE in AIS-10 (PR #6, commit 2604f1c). Default `lint-staged` + `eslint` behaviour blocks on errors, allows warnings to pass. Verified end-to-end. **Discovery worth flagging:** `@typescript-eslint/no-unused-vars` is at warn level in `next/typescript`, not error. So unused-vars currently DON'T block commits; they surface as warnings in CodeRabbit's review summary instead. Consistent with "Standard" strictness. To tighten in the future, add `--max-warnings 0` to the lint-staged eslint command. Tracked in deferred items (revisit when foundation phase tightens or unused-var debt accumulates).

---

## GitHub Actions / CI

To be documented in full in `04-standards/ci-configuration.md` (post-foundation Critical doc).

### Required checks

Source: `04-standards/branching-and-prs.md`, "Branch protection" + "Testing before merge".

- [ ] 🟠 Action: build verification — `next build` succeeds
- [ ] 🟠 Action: type-checking — `tsc --noEmit` succeeds
- [ ] 🟠 Action: linting — ESLint passes (no errors)
- [ ] 🟠 Action: format check — Prettier passes
- [ ] 🟢 Action: test runner (when tests exist; deferred per `04-standards/testing-baseline.md`)

### RLS verification check

Source: `04-standards/codebase-organization.md`; data classification policy.

- [ ] 🟢 Action: when a PR touches `supabase/migrations/`, parse the migrations and verify RLS policies are defined for any new table flagged as Red-classified. Red includes both personal data and commercial data per `05-policies/data-classification.md`. Custom logic, deferred until the first Red-classified tool actually requires it. May not need to be CI; could be approver-review skill responsibility.

### PR template completion check

- [ ] 🟡 Action: parse PR description for unticked checkboxes from the PR template, comment on PR if found, fail check if any are unticked. Alternative: rely on CodeRabbit for this. Pick one approach during foundation phase.

---

## Microsoft 365 / Entra configuration

Kenny-owned. Source: roadmap Step 10; `05-policies/access-control.md`.

- [ ] 🟡 Microsoft Entra SSO across GitHub, Vercel, Supabase, Claude Teams (~90 min)
- [ ] 🟡 **Vercel SAML add-on**: SAML SSO for Vercel is a paid add-on on top of the Pro plan (per-seat fee, not included). Kenny enables this as part of the SSO rollout. Worth flagging for the Kenny email — it's a small additional recurring cost that needs Finance awareness.
- [ ] 🟡 Establish Microsoft 365 group naming convention (e.g. `ai-studio-builders`, `ai-studio-staff`, per-tool groups)
- [ ] 🟡 **Grant Karim the Groups Administrator role in Entra**, scoped to AI Studio groups. This unlocks the access-control policy's design where both Karim and Kenny can manage group membership without bottlenecking on each other. Source: `05-policies/access-control.md`, "Who creates and manages groups" section.
- [ ] 🟡 Document which groups gate which tools/access — single registry
- [ ] 🟠 Create the `ai-studio-support` Teams channel. Receives support widget submissions; Karim and Kenny monitor for triage. Needed before the first foundation tool ships since the widget routes here. Source: `05-policies/incident-response.md`. **Deferred ask:** intentionally not asking Kenny yet (May 6, 2026). The widget doesn't exist; routing destinations for traffic that doesn't exist would sit empty for 2-3 weeks. Bring up to Kenny when `packages/support-widget/` build is ~1 week from completion.
- [ ] 🟠 Set up dedicated email inbox (e.g. `aistudio-support@fitzrovia.ca`) as backup for support widget submissions. Forwards to or aliases Karim and Kenny. Needed before the first foundation tool ships. **Deferred ask:** same reasoning as above — bundle with the Teams channel ask when widget build is ~1 week out.

---

## DNS configuration

Kenny-owned. Source: roadmap Steps 12 and 20.

- [~] 🟠 DNS record for `hub.fitzrovia.ca` → Vercel. **Asked May 6, 2026** — Kenny emailed with the CNAME spec (host: `hub`, type: CNAME, target: `cname.vercel-dns.com`). Pending his action.
- [ ] 🟡 Verify SSL certificate via Vercel (auto-issued by Vercel once CNAME resolves; verify it's working after DNS propagates)

---

## Linear configuration

Already done per the handoff note from chat #1.

- [x] 🔴 Workspace `Fitzrovia Residential` in EU region
- [x] 🔴 Team `AI Studio` with prefix `AIS`
- [x] 🔴 Statuses configured (New → Triaged → Accepted → Parked / Ready to Build / In Progress → In Review → Live / Declined)
- [x] 🔴 Two projects: Intake and Active Builds
- [x] 🔴 Personal API key `Intake Portal Integration` created with scoped permissions

### Plan and members (clarified May 18, 2026)

Earlier versions of this list implied Linear was part of the May 1 paid wave alongside GitHub, Vercel, Supabase, Claude Teams, and CodeRabbit. **It is not.** Linear is on the **Free plan** at Fitzrovia. The five paid platforms remain: GitHub Team, Vercel Pro, Supabase Pro, Claude Teams, CodeRabbit Pro.

- [x] 🔴 **Linear plan: Free** (no monthly cost)
- [x] 🔴 Karim Mourad (`kmourad@fitzrovia.ca`) — Admin (workspace owner)
- [x] 🟠 Joseph Agozzino (`jagozzino@fitzrovia.ca`) — Admin (invited May 2026, accepted)

**Consequence of Free plan:** every workspace member is automatically Admin. The Free plan doesn't expose role differentiation between Admin / Member / Guest — those tiers only appear on Standard ($8/user/month) and above. Joseph being Admin is therefore not a deliberate trust choice; it's a plan limitation. He stays Admin until either (a) we upgrade to Standard and demote him to Member, or (b) we accept the limitation.

**Decision: accept the limitation for now.** Joseph hasn't onboarded into Fitzrovia operationally and isn't building tools yet. The blast radius of Admin access on a workspace with one active builder and a Backlog of tickets is small. Workspace deletion would be the worst-case scenario, and the Linear UI has multiple confirmation steps for that — accidental administrative damage is unlikely.

- [ ] 🟡 **Upgrade trigger for Linear Standard ($8/user/month).** Three conditions, all of which need to be true: (a) 3+ active builders in the workspace (Karim, Joseph, AI Intern at minimum), (b) role differentiation actually matters operationally (e.g., AI Intern shouldn't have Admin), (c) budget allows (~$24/month for 3 users = $288/year). Revisit when Joseph onboards substantively and the AI Intern is past their first month.

### Outstanding Linear configuration

- [x] 🟠 GitHub-Linear integration ✓ DONE May 4, 2026. OAuth scope: GitHub linking & Code access (Recommended). Branch format: `identifier-title` (produces `AIS-XX-...`). Linkbacks, magic words, Linear team keys all configured. See `06-operations/coderabbit-setup.md` and `04-standards/branching-and-prs.md` for details.
- [x] 🟠 CodeRabbit-Linear integration ✓ DONE May 4, 2026. Path: Issue Tracking → Linear (NOT MCP Servers → Linear). Linear team keys restricted to `AIS`. Coding Plan feature deferred for evaluation in first real PR.
- [x] 🟠 Linear PR-event → status mappings configured (per-team Workflows & automations on AI Studio) ✓ DONE May 5, 2026 (initial config); behavior corrected May 18, 2026. Mappings: `On PR or commit open → In Progress`, `On PR review request or activity → In Review`, `On PR or commit merge → Live`. Deliberately left at "No action": `On draft PR open` (Fitzrovia doesn't use draft PRs as a workflow signal), `On PR ready for merge` (preserves the manual "click Merge" step as a deliberate final approval gate, since auto-merge is OFF on both Vercel and GitHub by design). **Important location note:** these mappings live at `linear.app/.../settings/teams/AIS` → Workflows & automations, NOT at the workspace-level GitHub integration page. **Behavior (corrected May 18, 2026):** the merge → Live automation fires on any merged PR linked to the ticket, regardless of the closing keyword used in the PR description. The PR-to-ticket link itself is established by the branch name (`AIS-XX-…`), the PR title containing `AIS-XX`, or any reference in the description — `Closes AIS-X`, `Fixes AIS-X`, `Resolves AIS-X`, `Part of AIS-X`, and bare references all link the PR. The merge transition fires regardless. **Earlier hypothesis retired:** the May 7 belief that the transition was keyword-dependent was based on AIS-7 (PR #3) failing to auto-transition while three subsequent `Closes` PRs (AIS-8, AIS-9, AIS-10) succeeded. AIS-11 (PR #7) used `Part of AIS-11` and also auto-transitioned to Live, falsifying the hypothesis. AIS-7's failure was likely due to the Linear ↔ GitHub integration still being set up that week, not the keyword choice. The corrected behavior is documented in `04-standards/branching-and-prs.md` v1.0.4. **Practical implication:** use `Closes AIS-X` for single-PR tickets as a clear semantic signal for humans, but understand it's not what gates the automation. For multi-PR tickets, either split into separate tickets (cleanest) or manually flip the ticket back to In Progress after each intermediate merge.
- [ ] ⛔ **GitHub Issues bidirectional sync — deliberately NOT enabled.** Linear's GitHub integration offers two-way sync between GitHub Issues and Linear issues (`Settings → Integrations → GitHub → GitHub Issues`). Turning this on would create a parallel ticket system on `fitzrovia-tools`, conflicting with Linear-as-source-of-truth. The handbook's intake model (`build.fitzrovia.ca` → Linear via API) explicitly does not involve GitHub Issues. Documented here so future contributors don't enable it speculatively.

---

## Precedent tracking for Red-data sign-offs

Source: `05-policies/data-classification.md` — Sign-off model.

The data classification policy says Tim Watson and Corey sign off on the *first* tool the studio handles in a new kind of Red data, but not on subsequent tools handling the same kind of Red data. This requires a registry of which kinds of Red data have been "established" and what the precedent looks like.

Without this registry, the sign-off model can't be operationalised. Every Red tool either bothers Tim or Corey (defeating the speed gain), or skips them silently (undermining the policy). The registry is what makes the model real.

- [ ] 🟠 Decide where the precedent registry lives. Options:
  - A dedicated `! handbook configuration list/red-data-precedents.md` file alongside the build checklist
  - A SharePoint-tracked spreadsheet that Karim, Kenny, Tim, and Corey can all see
  - A section of the build checklist itself (consolidated with other tracking)
- [ ] 🟠 Establish the registry's columns: kind of Red data (e.g. "tenant PII," "per-property financials"), sub-category (personal / commercial / both), first tool that handled it, who signed off, date, link to the PR/ticket, link to the tool's README.
- [ ] 🟠 Establish the maintenance convention: when Karim approves a Red-data tool that he judges to be the first-of-kind, he adds an entry to the registry as part of the merge. When he judges a tool to be following established precedent, he references the existing entry in the PR description.
- [ ] 🟠 Backfill the registry once the first three foundation tools (landing page, tool selection page, intake form) have been classified. The intake form will likely be the first entry — it handles submissions which may include tenant or staff names depending on what people submit. Worth deciding its classification deliberately.

---

## Tool Starter configuration

To be done during foundation phase, after the third foundation tool ships and patterns have stabilised.

- [ ] 🟢 Create `fitzrovia-residential/tool-starter` repo
- [ ] 🟢 Build the `bun run new-app <name>` generator command
- [ ] 🟢 Pre-wire SSO, activity logging, Supabase client, design system imports, support widget
- [ ] 🟢 Include `env.example` template
- [ ] 🟢 Include `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] 🟢 Include base ESLint configuration
- [ ] 🟢 Include base CI workflows

---

## Foundation tools

Source: `00-foundations/the-three-tools.md`.

The three foundation tools are the first wave of AI Studio: hub (landing + tool selection), intake form, and lease compliance. Each one is its own `apps/<name>/` workspace and its own Vercel project.

### apps/hub/

The hub is two surfaces glued together: a public landing page (the marketing-style entry point for staff arriving at `hub.fitzrovia.ca`) and the post-auth tool selection page at `/tools` (the launcher staff see after signing in).

#### Landing page

- [x] 🟠 **AIS-7 (PR #3) shipped May 7, 2026** — landing page replicating Joseph's source under the Fitzrovia stack. Hero with full-bleed property video, giant "THE RENTAL / REVOLUTION / IS NOW" headline, Microsoft sign-in stub. The first consumer of the design-system package; introduced Tailwind v3 bridged to design-system tokens via `theme.extend`. Materialized design-system v1.1.0 in-repo at `packages/design-system/` (the previous v1.0.0 in-repo materialization had naming/palette divergences from the canonical handbook spec; AIS-7 brought them into alignment). Hero-display sanctioned exception added to design system. `apps/hub/public/fitz-hero-video.mp4` (16.7 MB) committed; poster image generation deferred (no ffmpeg locally; `<video>` falls back to first frame). Vercel project imported post-merge May 7 at `hub-flame-eight.vercel.app`, region `yul1`, Vercel Authentication Standard Protection (`@fitzrovia.ca` only, covers preview + production on `*.vercel.app`).

#### Tool selection page (`/tools`)

- [x] 🟠 **AIS-9 (PR #5) shipped May 8, 2026** — `apps/hub/src/app/tools/page.tsx` rendering the post-auth tool selection page per the Claude Design source at `app/hub/tool-selection-source/`. Page intro (time-of-day greeting + giant "Tools for the people building the future of rental." headline), department sidebar (12 departments, greyed/smaller treatment for empty ones per design decision), tool grid (filtered to `status === 'live'` only — empty at v1 since all 4 design-tier tools are still `in-development`), submit-request panel at top, sticky `PageHeader` chrome (AI Studio wordmark, breadcrumb, user avatar+name, sign-out). Empty state and filter-empty state both implemented. Greeting recomputes in `useEffect` to avoid the static-prerender hydration mismatch that would have frozen build-time hour into the HTML. Sign-in stub on the landing page now navigates to `/tools` (was a no-op stub from AIS-7). Reusable five-commit PR with disciplined batch structure: scaffold → components → polish → review-cleanup → approver-review-and-merge. Foundation-phase admin bypass merge by Karim; AIS-9 auto-transitioned to Live via `Closes AIS-9` (the convention's second consecutive validation after AIS-8).

- [x] 🟠 **Mock session provider pattern** ✓ ESTABLISHED in AIS-9. `apps/hub/src/contexts/session-context.tsx` — React Context exposing `{ name, email, departments }` with hardcoded test values (`name: "Karim Mourad"`, `email: "kmourad@fitzrovia.ca"`, `departments: ["property"]`). Designed to match the shape Microsoft Entra will return after AIS-10 wiring, so the swap is isolated to the provider implementation — consumers (`useSession()` hook callers) don't change. CodeRabbit flagged the hardcoded internal email as a potential PII concern; skipped with documented reason (private repo, owner's own data, brief explicitly specified the values, AIS-10 replaces them anyway). The pattern (`SessionProvider` + `useSession` hook) is the canonical foundation-phase auth-stub pattern; reuse for any future foundation tool that needs identity context before AIS-10 lands.

- [x] 🟠 **`PageHeader` component as platform-header candidate** ✓ ESTABLISHED in AIS-9. `apps/hub/src/components/tools/PageHeader.tsx` is the sticky platform header (wordmark + breadcrumb + user avatar + sign-out). Written hub-specific for AIS-9 but designed to be lifted into `packages/ui/` (or similar shared package) when the second app needs the same header chrome — the breadcrumb labels, navigation paths, and sign-out semantics are minimal hub-specific bits. Don't lift now (premature abstraction; only one consumer); revisit when `apps/intake/` or another app's first PR needs the header.

#### Submit a tool request (`/tools/request`)

- [x] 🟠 **AIS-11 (PR #7) shipped May 18, 2026** — `apps/hub/src/app/tools/request/page.tsx` rendering the Submit-a-Tool-Request form per the Claude Design source. Four text fields (The Problem, Describe the tool, Impact — all required; Example Data optional), drag-and-drop file upload (max 10 files, 25 MiB each, 100 MiB total, 11-MIME-type allowlist: PDF, CSV, text/plain, Excel xls/xlsx, Word doc/docx, PowerPoint ppt/pptx, PNG, JPEG), display-only Employee Name + Department auto-populated from the mock session, idle/loading/success/error state machine, inline validation errors with per-field touched state. Reused the AIS-9 `PageHeader` chrome and `SubmittingAsBanner` from the session context. Form widens to `max-w-[1000px]` outside the prose column. Six-batch journey: 1 (page scaffold), 2 (form fields + interaction states), 3a (Supabase storage infrastructure), 3b (file upload UI), 3c (server-side single Server Action upload), 3d (rework to direct-from-client uploads after hitting Vercel's 4.5 MB function payload limit). Three infra follow-up commits resolved (a) `NEXT_PUBLIC_*` env var inlining failure inside `@fitzrovia/supabase-client` via the explicit-pass pattern, (b) `transpilePackages` config update, (c) MIME allowlist enforcement gap from `/security-review` (commit `10a4f2b`). PR title: "AIS-11: Submit-a-Tool-Request (batches 1-3d + infra follow-ups)". Merge commit `fa03dc7`. 14 commits, +2,274 lines. `gh pr merge 7 --admin --merge` (foundation-phase admin bypass on IT-critical path `packages/supabase-client/`; documented for Kenny's retroactive review). Auto-transitioned to Live in Linear via the team automation rule despite the PR description using `Part of AIS-11` — see "Linear `Part of AIS-X` auto-transition correction" in build checklist v3.9.

- [x] 🟠 **`@fitzrovia/supabase-client` workspace package** ✓ ESTABLISHED in AIS-11. New package at `packages/supabase-client/` mirroring the `@fitzrovia/design-system` workspace pattern. Two factories: `createBrowserClient({ url, anonKey })` (anon key, browser-safe) and `createServerClient({ url, serviceRoleKey })` (service role, server-only with `typeof window !== 'undefined'` runtime guard). **Both factories accept credentials as explicit arguments** — the package itself reads zero `process.env` values. Consuming apps (`apps/hub/`) read env vars where Next.js definitely inlines them and pass values into the factories. This pattern is now codified in `04-standards/codebase-organization.md` (v1.0.5, rule 6 under "Imports and module boundaries") and applies to every future workspace package. `transpilePackages` in `apps/hub/next.config.ts` includes both `@fitzrovia/design-system` and `@fitzrovia/supabase-client`. Originally written reading `process.env` internally; failed silently in production because Next.js's `NEXT_PUBLIC_*` inlining doesn't reliably reach workspace package source. The explicit-pass refactor (commit `6dae18f`) was the fix.

- [x] 🟠 **Supabase Storage `tool-requests` bucket** ✓ CREATED in AIS-11 prep (Karim, Supabase dashboard). Private bucket. Per-file size limit: 25 MiB. Allowed MIME types (11): `application/pdf`, `text/csv`, `text/plain`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `image/png`, `image/jpeg`. Two RLS policies applied (authenticated INSERT + authenticated SELECT, scoped to `submissions/<auth.uid()>/…`). Path convention: `submissions/<email-slug>/<uuid>/<safeFilename>`. (RLS path uses `<auth.uid()>` while the application currently writes under `<email-slug>` since auth is still mocked — RLS will activate functionally when AIS-12 lands real Microsoft Entra session and the path scheme is reconciled.) Documentary migration at `supabase/migrations/20260508120000_tool_requests_bucket.sql` (not yet applied via CLI — Supabase CLI install is AIS-13; bucket was created via dashboard, RLS via SQL editor).

- [x] 🟠 **Three Vercel env vars set for `apps/hub`** ✓ DONE in AIS-11 prep (Karim, Vercel dashboard): `NEXT_PUBLIC_SUPABASE_URL` (All Environments), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (All Environments, new `sb_publishable_…` format), `SUPABASE_SERVICE_ROLE_KEY` (Sensitive, Production + Preview, **legacy JWT `eyJ…` format required** — see `06-operations/supabase-setup.md` for the gotcha). Local `.env.local` at `apps/hub/.env.local` mirrors the same three values for `bun run dev`.

- [x] 🟠 **Direct-from-client upload architecture** ✓ ESTABLISHED in AIS-11 batch 3d. Vercel's 4.5 MB function payload limit on Pro tier broke the initial "single Server Action routes the file bytes" design (Karim's 12 MB test failed with `413 FUNCTION_PAYLOAD_TOO_LARGE`). Reworked to three-call architecture: (1) `prepareToolRequest` mints signed upload URLs via `createSignedUploadUrl` (stateless), (2) browser uploads bytes directly to Supabase Storage via `uploadToSignedUrl` (bypasses Vercel entirely), (3) `finalizeToolRequest` Range-fetches first 4.1 KiB per path, MIME-sniffs via `fileTypeFromBuffer`, validates against allowlist + extension, mints 7-day signed download URLs. Atomic rollback on any failure point (prepare, upload, finalize) via `cleanupToolRequest` server action — no orphan files left in storage. Pattern is the standard now for any future tool that uploads files; codified in `06-operations/vercel-setup.md` under "Operational gotchas". `@supabase/supabase-js` enters the client bundle as a consequence (+60 kB First Load); bundle optimization tracked in deferred items below.

- [x] 🟠 **MIME content sniffing with allowlist enforcement** ✓ HARDENED in AIS-11 security review (commit `10a4f2b`). The initial `sniffStoredFile` implementation correctly detected the true MIME from magic bytes via `fileTypeFromBuffer` but did NOT check the detected type against `ALLOWED_MIME_TYPES` — meaning a renamed `evil.zip → evil.pdf` would pass client validation, upload, get sniffed correctly as `application/zip`, but never be rejected. `/security-review` surfaced this as a MEDIUM finding with confidence 9. Fixed via two checks: (a) allowlist enforcement after `fileTypeFromBuffer` returns a hit, (b) belt-and-braces extension-match check via a new `EXTENSION_TO_MIME` map (rejects a real PNG renamed to .pdf, even though both individually are allowlisted). Both rejections drop through to the existing atomic rollback. Lesson worth carrying: MIME sniffing must enforce the allowlist, not just detect.

- [x] 🟠 **`SUPABASE.md` operational reference at repo root** ✓ CREATED in AIS-11 batch 3a. Documents the bucket settings, RLS SQL, env var contract, path convention, and the direct-from-client architecture. Not part of the handbook; lives in-repo for builders working in `apps/hub/`.

- [ ] 🟢 **AIS-15 (Linear API batch 4)** — Replaces the stub ticket ID (`STUB-<timestamp>`) returned by `finalizeToolRequest` with a real `issueCreate` GraphQL mutation against Linear's API + `attachmentCreate` calls passing the signed-URL list. Requires `LINEAR_API_KEY` env var (server-only). This is the PR that genuinely closes AIS-11's full intent. Should land as a separate ticket per the corrected `Part of` semantics — single-PR per ticket is the clean lifecycle.

- [ ] 🟢 **AIS-14 (Vitest + tests for AIS-11 helpers)** — Foundation-phase tests gap. Targets: `emailSlug`, `safeFilename`, `disambiguateFilename`, `validateFileMetadata`, `validateSubmissionPaths`, `fileExtension`, `fileKind`, `formatSize`, `readServerSupabaseConfig`. CLAUDE.md says "always write tests"; currently aspirational because no test runner is installed. Backfill before Joseph onboards.

- [ ] 🟢 **AIS-16 (AIS-11 polish — deferred LOW findings)** — Captures the LOW-severity items from `/review` triaged as defer: L2 (UUID validation in `validateSubmissionPaths`), L3 (optional chaining), L4 (sniff-window comment), L5 (constants dedup across server+client), L6 (double-submit guard with `useRef`), L7 (error-string consolidation), L9 (upload-URL expiry tuning), L10 (MAX_FILES UX cap), L11 (RLS path alignment with `auth.uid()` once AIS-12 lands), L12 (migration on-conflict behavior), L15 (`env.example` file). Low priority; bundle into next housekeeping PR.

- [ ] 🟡 **Bundle size optimization on `/tools/request`** — `@supabase/supabase-js` adds ~60 kB to First Load JS (7.5 → 68.2 kB page bundle; 114 → 175 kB total). Two optimization paths: switch to raw `PUT` requests against the signed URL (bypasses SDK entirely; lightest), or import `@supabase/storage-js` alone (smaller subset of the full SDK). Defer until a second tool needs the same upload pattern and the optimization can be amortized.

- [ ] 🟡 **Kenny retroactive review of `packages/supabase-client/`** — IT-critical path was modified during AIS-11 (commits `4b3feb5`, `6dae18f`, `10a4f2b`). Foundation-phase admin bypass let it ship without Kenny's pre-merge approval. When Kenny ramps up as an active reviewer, he should audit the supabase-client factory pattern + the AIS-11 PR description. Tracked in the foundation-phase admin bypass watchlist.

### apps/admin/

Locked in as the future home for admin views during AIS-11 planning. **Not** where the AIS-11 Submit-a-Tool-Request form lives (that's in `apps/hub/` because it's staff-facing intake, same audience as the hub itself). `apps/admin/` is for the operator-facing surfaces:

- Usage dashboards (which tools are getting traffic, which staff are using them)
- Cost analytics (per-tool spend on Anthropic API, Vercel function usage, Supabase storage)
- Builder activity feeds (PRs merged, tools shipped, intake submissions triaged)
- Request triage dashboards beyond what Linear surfaces natively

Different audience (operators vs staff), different design intent (dense data vs friendly intake), different deploy cadence, different access model.

- [ ] 🟡 **`apps/admin/` workspace creation** — deferred until the first admin view has concrete scope. Scaffold from Tool Starter once it exists.
- [ ] 🟡 **`tool_activity_log` schema** — data precursor for the first admin view (usage dashboards need activity data to display). Schema design and Supabase migration deferred until needed; pre-existing item carried forward.
- [ ] 🟡 **Subdomain decision** — `admin.fitzrovia.ca` (sibling, separate brand) vs `admin.aistudio.fitzrovia.ca` (nested under AI Studio). Decide alongside the hub/aistudio subdomain decision (also pending).

- [ ] 🟡 **Cosmetic: rename Vercel auto-alias** — `hub-flame-eight.vercel.app` is Vercel's auto-generated adjective+number alias. Rename via Settings → Domains to something cleaner (e.g., `hub-fitzrovia.vercel.app`) before launching to non-builder staff. Cosmetic, optional.

- [ ] 🟡 **Custom domain `hub.fitzrovia.ca`** — DNS provisioning pending Kenny per the original schedule (~1 week from non-builder pilot).

#### Visual design open items (deferred from AIS-9 review)

- [ ] 🟢 **Mobile CTA visibility on SubmitRequestPanel** — the whole panel is the link target so navigation works on mobile, but the visible "Submit request" pill button hides below `sm:` breakpoint. Visual polish; future iteration. Surfaced via `/review` in AIS-9 cleanup.
- [ ] 🟢 **`LoadingState` min-h matches `ToolCard` size** — only matters when AIS-10 wires async data and the skeleton-to-card swap actually fires; would cause layout shift then. Bring up in AIS-10's brief.

### apps/intake/

To be built. First post-foundation tool. Triggers the support widget retrofit, the Supabase RLS pattern, and the first activity-log integration.

- [ ] 🟠 Create `apps/intake/` workspace, scaffold from Tool Starter once it exists (or copy from `apps/hub/` patterns if Tool Starter isn't ready)
- [ ] 🟠 Vercel project `intake`, root directory `apps/intake`, region `yul1`, Vercel Authentication enabled
- [ ] 🟠 Supabase tables for intake submissions (RLS policies pending Tier classification)
- [ ] 🟠 Wire support widget on day one of build, not retrofitted

### apps/lease-compliance/ (or similar)

To be built. Second post-foundation tool. Likely Tier 1 (high-impact decisions); will need explicit Tim Watson sign-off for the Red-data flow.

---

## Support widget infrastructure

Source: `05-policies/incident-response.md`.

The Support widget is the in-tool "Report an issue" feature every Fitzrovia tool includes from day one. Users click Support, fill in a short form (auto-captured tool/page/user, free-text description, optional screenshot), and the submission lands in three places: the `ai-studio-support` Teams channel for triage, a dedicated email inbox as backup, and a Supabase log for searchability.

The widget is **core infrastructure**, not optional. Every Fitzrovia tool — including the three foundation tools (hub, tool selection page, intake form) — ships with it. Built as a shared package extracted into the Tool Starter so every future tool inherits it automatically.

### Design

- [x] 🟠 Design the Support widget UI before building the first foundation tool ✓ DONE May 6, 2026 via Claude Design (Anthropic Labs) over two iterations. All four open questions resolved: trigger placement (labelled "Support" button with Lucide `life-buoy` icon, header-mounted left of avatar, secondary styling), form opens (right-side drawer), categories (Bug · Question · Feature request · Other, with description placeholder doing the work an extra "Data looks wrong" category would have), confirmation (inline panel + dismiss-toast with `SUP-XXXXXX` reference number). Error states for network failure, validation, attachment-too-large, upload-failed all designed. Full design spec stored in `! support widget design spec/` as build input for `packages/support-widget/`. Two by-products of this work also landed in the handbook: the design system v1.0.0 in `01-design-system/` and the elevation of the error contract + labelled-vs-icon-only rule to platform-wide patterns.

### Shared package

- [ ] 🟠 Create `packages/support-widget/` with the React component (button + form + screenshot upload), API client, and TypeScript types. Built before the foundation tools so they can import it.
- [ ] 🟠 Add the support widget to each foundation tool (landing page, tool selection page, intake form) as part of those tools' initial build, not retrofitted afterward.
- [ ] 🟢 Document the support widget in the Tool Starter so it auto-installs in every new tool

### Backend

- [ ] 🟠 Create Supabase `support_submissions` table with columns: id, tool_name, page_url, user_email, message, attachment_urls, submitted_at, status (new/triaged/closed), linear_ticket_id (nullable). RLS policies: only Karim and Kenny can read; any authenticated user can insert (their own submissions only).
- [ ] 🟠 Create Supabase storage bucket for support widget screenshot attachments. Access scoped — only Karim and Kenny can read the bucket.
- [ ] 🟠 Build the API endpoint that the widget POSTs to — validates input, handles screenshot upload, writes to `support_submissions` and storage, fires the Teams webhook and email.

### Routing

- [ ] 🟠 Configure Microsoft Teams incoming webhook for the `ai-studio-support` channel. The API endpoint posts new submissions to this webhook so they appear in the channel.
- [ ] 🟠 Configure email forwarding from `aistudio-support@fitzrovia.ca` (or whatever the inbox is named) to Karim and Kenny.
- [ ] 🟠 Verify the full flow end-to-end: user clicks Support in a tool, submits, sees confirmation; submission appears in the Teams channel within seconds; submission appears in `support_submissions` table; email arrives.

### Operational

- [ ] 🟡 Establish triage routine: Karim or Kenny reviews new submissions in the Teams channel, decides what each is (incident / bug / feature request / misunderstanding), and routes accordingly. Most submissions become Linear tickets in the AI Studio queue; some trigger the incident response playbook; a few are answered directly with a quick "this is how the tool works" reply.
- [ ] 🟡 Decide on a triage SLA target (e.g. all new submissions seen within one business day). This isn't a commitment, just a target to hold ourselves to.

---

## API keys and secrets

Source: `05-policies/api-keys-and-secrets.md`.

Tracking which paid-API keys exist for which tools, who issued them, when, and what their soft monthly limits are. As tools get built and need keys, entries get added here. Entries stay even after rotation — when a key is rotated, the entry notes the rotation date and the new key's limits.

### Anthropic API keys

- [ ] 🟢 First Fitzrovia tool requiring Anthropic API key — to be issued when the first tool that calls Claude API is built. Per `05-policies/api-keys-and-secrets.md`, key will be tool-specific (named `fitzrovia-<tool-name>-prod`), monthly soft limit set at ~2x projected spend, stored in Vercel env vars + password vault. Karim provisions; Karim+Corey jointly approve if projected spend >$500/month.

### Other paid APIs (Yardi, OpenAI, Google Maps, etc.)

- [ ] 🟢 No tools yet require these. Same provisioning model applies when first one does.

### Operational

- [ ] 🟢 Establish the monthly review cadence. Karim opens the Anthropic Console (and other paid-API consoles) on the first business day of each month, reviews per-key spend, flags anomalies. ~5 minutes; results captured here for keys with notable findings.
- [ ] 🟡 Annual rotation reminder. Set a December calendar reminder for routine annual key rotation across all paid APIs.

---

## Open future migrations and access-model expansion

Surfaced during AIS-10 (May 8, 2026) and extended after AIS-11 (May 18, 2026); each is tracked here so they don't get lost.

- [ ] 🟡 **ESLint 9 / flat config / eslint-config-next v16 migration.** AIS-10 pinned `eslint-config-next` to `^15.5.0` to match the Next.js 15.5.16 + ESLint 8.57 stack. v16 expects ESLint 9, which is a different config format (flat config replaces `.eslintrc.json` with `eslint.config.js`). Migrate when Next.js 16 ships and we're ready to upgrade the framework. Separate ticket at that time.
- [ ] 🟡 **`--max-warnings 0` in lint-staged.** Currently warnings (e.g., `@typescript-eslint/no-unused-vars`) don't block commits; only errors do. "Standard" pre-commit strictness chosen deliberately in AIS-10. Revisit if foundation phase tightens or unused-var debt accumulates.
- [ ] 🟡 **Vercel preview access expansion to `@fitzrovia.ca`-domain (vs current "Vercel team members only").** Today's Vercel Authentication Standard Protection allows only Vercel team members (Karim + Kenny) to access previews. To extend to non-builder Fitzrovia staff (Corey, Adrian, Joseph pre-Vercel-team-add) without giving them Vercel team seats, configure Vercel's domain-based access feature at the team level. Worth doing before non-builder pilot (~1 week from custom-domain DNS).
- [ ] 🟡 **`.coderabbit.yaml` `path_filters` tightening.** AIS-10 set `!**/public/**` which would also exclude any future `packages/*/public/` content. Currently no package has a public/ folder, so this is theoretical. If `packages/design-system/` ever ships static assets under public/, tighten to `!apps/*/public/**` to keep packages' public/ in CodeRabbit's review surface. Surfaced by `/review` in AIS-10 batch 4 triage.
- [ ] 🟡 **Approver-review skill patch — fix PR-number citation.** The skill's process-dimension flagged AIS-10's `Part of AIS-10` keyword and cited "the same gotcha that caught … PR #5 missed the auto-transition". Actual history: PR #3 (AIS-7) was the one that missed the auto-transition; PR #5 (AIS-9) used `Closes AIS-9` and worked correctly. The skill cites the wrong PR number. Patch the prompt's process-section reference language to reflect actual history. **Also update the skill's framing** to reflect the May 18 correction: the `Part of` vs `Closes` flag is now a semantic-clarity concern (use `Closes` for single-PR tickets), not an auto-transition concern. Source files: `02-skills/approver-review/prompt.md` (handbook canonical) and `.claude/skills/approver-review/SKILL.md` (in-repo copy). Bundle into next housekeeping PR.

### Added May 18, 2026 (post AIS-11)

- [ ] 🟢 **AIS-15 — Linear API batch 4.** Replaces the stub ticket ID returned by `finalizeToolRequest` with a real Linear `issueCreate` GraphQL mutation + `attachmentCreate` calls. New env var: `LINEAR_API_KEY` (server-only, Sensitive in Vercel). This is the PR that genuinely completes AIS-11's intent. Will close AIS-11 in Linear if it uses `Closes AIS-11` (or auto-transition either way per the corrected mapping behavior).
- [ ] 🟢 **AIS-14 — Install Vitest + backfill tests for AIS-11 helpers.** Foundation-phase tests gap. CLAUDE.md says "always write tests" but no test runner is installed; foundation-phase pragmatism. Targets for the backfill: `emailSlug`, `safeFilename`, `disambiguateFilename`, `validateFileMetadata`, `validateSubmissionPaths`, `fileExtension`, `fileKind`, `formatSize`, `readServerSupabaseConfig`. Backfill before Joseph onboards substantively.
- [ ] 🟢 **AIS-16 — AIS-11 polish (deferred LOW findings).** Captures the LOW-severity items from `/review` triaged as defer during AIS-11: L2 UUID validation in `validateSubmissionPaths`, L3 optional chaining, L4 sniff-window comment, L5 constants dedup across server+client, L6 double-submit guard with `useRef`, L7 error-string consolidation, L9 upload-URL expiry tuning, L10 MAX_FILES UX cap, L11 RLS path alignment with `auth.uid()` once AIS-12 lands, L12 migration on-conflict behavior, L15 `env.example` file. Low priority; bundle into next housekeeping PR.
- [ ] 🟠 **AIS-13 — Install Supabase CLI.** Today, Supabase migrations apply via manual SQL paste in the dashboard SQL editor. AIS-13 installs the Supabase CLI so `supabase/migrations/*.sql` files apply via `bunx supabase db push` against the linked project. Removes the "click SQL editor, paste, run" loop. Should be done before the next Supabase schema change (likely `tool_activity_log` for the first admin view).
- [ ] 🟡 **Bundle size optimization on `/tools/request`.** `@supabase/supabase-js` adds ~60 kB to First Load JS (7.5 → 68.2 kB page bundle; 114 → 175 kB total). Two optimization paths: switch to raw `PUT` requests against the signed URL (bypasses SDK entirely, lightest), or import `@supabase/storage-js` alone (smaller subset of the full SDK). Defer until a second tool needs the same upload pattern and the optimization can be amortized.
- [ ] 🟠 **Subdomain decision still pending — `hub.fitzrovia.ca` vs `aistudio.fitzrovia.ca`.** Cascades into ~6-8 places in this config list + build checklist + DNS setup with Kenny once decided. No further work blocked, but the decision should happen before the non-builder pilot.
- [ ] 🟡 **Mobile spot-checks dropped from the foundation-phase pattern.** Foundation tools are desktop-first staff workflows; mobile remains untested by design until a tool explicitly needs it. Decision recorded May 18, 2026 (Karim preference). Earlier mobile-related deferred items (AIS-9's `SubmitRequestPanel` mobile CTA visibility) remain in the config list but are no longer prioritized for review — they may surface again if a tool's audience actually uses mobile.

---

## Forward-references to docs that don't exist yet

Several handbook docs reference future documents as authoritative for specific topics. Those references are intentional — the docs will exist eventually — but they need to be reviewed for accuracy when the referenced doc is actually created. Track here so they don't get forgotten.

- [ ] 🟠 When `04-standards/ci-configuration.md` is created, verify references in `04-standards/pre-pr-checklist.md` are accurate (currently references it as the source of truth for automation configuration).
- [ ] 🟠 When `04-standards/coderabbit-configuration.md` is created, verify references in `04-standards/pre-pr-checklist.md` are accurate (referenced as the source of CodeRabbit blocking-merge behaviour and configuration).
- [ ] 🟠 When `06-operations/bug-response.md` is created, verify references in `05-policies/incident-response.md` are accurate (referenced as the place where the fuller bug-response process will be captured once we've run the flow enough times).
- [ ] 🟠 When `06-operations/pr-review-process.md` is created, verify references in `04-standards/branching-and-prs.md` are accurate (referenced as the home for the full review workflow including CodeRabbit and the approver-review skill).
- [ ] 🟠 When `04-standards/security-baseline.md` is created, verify references in `04-standards/branching-and-prs.md` are accurate (referenced as the home for what every tool must do for security).
- [x] 🟢 When `02-skills/` is populated with actual skills, update `README.md` "Read in this order" step 4 ✓ EVALUATED May 6, 2026. `02-skills/approver-review/` now exists with real content, so the folder is no longer empty. The onboarding step 4 was previously updated to point at `01-design-system/design-system.md` (more valuable for a new reader's day-1 orientation than a single-skill prompt). Decision: leave onboarding pointing at design-system; the navigation table description for `02-skills/` is now accurate. Revisit if/when 3+ skills exist and the folder warrants its own onboarding step.

---

## Notes

- Items here move *into* `04-standards/ci-configuration.md` and `04-standards/coderabbit-configuration.md` once configured and verified. This list is the working state; those documents are the canonical reference.
- The 🔴 Friday items are genuinely Friday-blocking — without them, Karim cannot start building. Verify all of them complete before the weekend.
- The 🟠 First-foundation-tool items get done as you set up the first repo. Most are mechanical.
- The 🟡 Foundation-phase items can be done iteratively while building the foundation tools — drive them by what's actually breaking, not by trying to set everything up theoretically.
- The 🟢 Post-foundation items are correctly deferred — they need real foundation-tool code to inform their configuration.

---

## Status summary

**As of May 18, 2026 (post AIS-11 merge):**

- Total items: ~310 (Open future migrations section extended with 7 new items from AIS-11; new AIS-11 ship items added under Foundation Tools; new `apps/admin/` section; new Linear plan + members subsection)
- Done: ~205 (AIS-11 closed ~15 items: Submit-a-Tool-Request form, Supabase Storage bucket creation, three Vercel env vars, `@fitzrovia/supabase-client` workspace package, direct-from-client upload architecture, MIME content sniffing with allowlist enforcement, atomic rollback, `SUPABASE.md` operational reference, supabase-setup + vercel-setup doc patches, codebase-organization + branching-and-prs doc patches, Linear plan clarification, `apps/admin/` lock-in)
- Open: ~105 (most are still post-foundation work — Entra wiring, RLS path alignment, Supabase CLI, Vitest backfill, batch 4 Linear API, AIS-11 polish LOW findings, support widget infrastructure, second/third tool builds, `tool_activity_log` schema, `apps/admin/` scaffolding)
- In progress: 0
- **Auto-transition behavior corrected May 18, 2026** — earlier "Closes-keyword convention LOCKED" framing has been retired. Auto-transition fires on any merged PR linked to the ticket, regardless of closing keyword. `Closes AIS-X` remains the recommended convention for semantic clarity (signals to humans that this PR closes the ticket), but it is not what gates the Linear automation. See Linear configuration → PR-event mappings entry for the full corrected behavior.

Done items remain in this list deliberately — they capture what was done, when, and why. New items get added as new configurations surface during build. The list is a living state document, not a project plan.

When a configuration becomes a documented standard (e.g., `04-standards/ci-configuration.md` once that doc exists), the corresponding items move to that doc and are removed from here.
