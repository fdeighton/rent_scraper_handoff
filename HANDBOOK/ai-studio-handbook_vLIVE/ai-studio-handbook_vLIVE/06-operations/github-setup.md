# GitHub setup

**Path:** `06-operations/github-setup.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

## What this document is

A record of how the `fitzrovia-residential` GitHub organisation was configured at programme inception (May 1, 2026) and how the `fitzrovia-tools` monorepo was created and protected on May 4, 2026, plus the reasoning behind each setting. Useful for Kenny's review, useful for future-Karim when something needs to change and the rationale isn't obvious.

This is not a step-by-step tutorial — GitHub's own docs do that job. It's a decisions-and-state document.

---

## Why GitHub, and how it fits the platform

GitHub is the source-of-truth host for every line of code Fitzrovia builds. It is:

- The remote where all signed commits land — every Vercel deployment, every CodeRabbit review, every reviewer approval references the GitHub repo.
- The identity layer that ties `@fitzrovia.ca` accounts (via SSO when configured) to commit authorship and PR approvals.
- The enforcement point for the layered review model in `04-standards/branching-and-prs.md` — branch protection rules on `main` make the review workflow mechanically real, not aspirational.

The choice of GitHub over GitLab or Bitbucket: deepest integration ecosystem (Vercel, CodeRabbit, Linear, and Claude Code all integrate first-class with GitHub), Microsoft 365 SSO via Entra works cleanly, and Kenny is already familiar with GitHub from prior IT work. Switching costs would outweigh any feature gains from alternatives.

---

## Plan and billing

- **Plan**: Team — $4 USD per active user per month
- **Active users today**: 2 (Karim Owner, Kenny Owner). Will scale to 3 when Joseph onboards
- **Billing**: Monthly. No annual commitment, consistent with the broader programme principle of preserving optionality on AI-and-AI-adjacent tooling
- **Payment**: Fitzrovia corporate Visa ending 8456 (same card as the other four platforms)
- **Org-level billing email**: `kmourad@fitzrovia.ca` (private; not the public profile email)
- **Tax region**: Canada

**Why Team and not Enterprise**: Enterprise is roughly 5–6× the per-user cost and adds features Fitzrovia does not need at this scale — SAML SSO at the org level (Microsoft Entra integration is on the roadmap but Team-tier covers the access control we need today), audit log API, IP allow lists for org access, custom security policies. The Enterprise-only branch protection feature for per-path approval counts is a real loss (we discovered this on May 4 — see `04-standards/branching-and-prs.md` for how dual-approval was solved differently), but the workaround via CODEOWNERS + CodeRabbit gating achieves the same outcome at a fraction of the cost.

**Why monthly billing instead of annual**: Annual saves about 16% but commits us before Fitzrovia's tooling stack stabilises. The "monthly preserves optionality" principle from the broader programme applies here.

---

## Org-level configuration

### Identity and profile

- **Org slug**: `fitzrovia-residential`
- **Display name**: `Fitzrovia Residential`
- **Description**: `Fitzrovia Residential's internal AI development platform.`
- **Public profile email**: deliberately not set (we don't run a public-facing org)
- **URL, social accounts, location, profile picture, Gravatar/Sponsors emails**: deliberately blank. The org has no public face to maintain; less surface to manage and update.

### Member privileges (locked down)

The default posture is read-only members with explicit grants for write access. Every privilege that could let a member accidentally expose, destroy, or escalate something is restricted to org owners.

The full list, all configured under `Settings → Member privileges`:

| Setting | Value | Why |
|---|---|---|
| Base permissions | **Read** | Members can clone and read; push access requires explicit team membership or per-repo grant |
| Repository creation | **Private only** (Public disabled) | Public repo creation is greyed out at the plan level on Team; we lock it down explicitly |
| Repository forking | **Disabled** for private repos | No accidental forks of internal IP |
| Projects base permissions | **Read** | We use Linear for project tracking, not GitHub Projects |
| Pages creation (Public) | **Disabled** | Vercel handles all deployment; GitHub Pages is not in our stack |
| Pages creation (Private) | **Disabled** | Same |
| App access requests | **Members only** | Outside collaborators cannot request third-party app installs |
| GitHub Apps | **Repo admins cannot install Apps without org owner approval** | Prevents drive-by app installations that grant data access |
| Repository visibility change | **Owners only** | Members cannot accidentally make a private repo public |
| Repository deletion and transfer | **Owners only** | Deletion is irreversible (90-day recovery aside); transfer moves a repo out of the org entirely |
| Issue deletion | **Owners only** | Audit trail integrity |
| Team creation | **Owners only** | Prevents members spinning up unmanaged teams |

### Authentication security

Both settings under `Settings → Authentication security` are enabled:

- **Require two-factor authentication for everyone in the org**: ON. Members without 2FA cannot access org resources. Outside collaborators without 2FA are removed automatically.
- **Only allow secure 2FA methods**: ON. Authenticator apps, passkeys, security keys, GitHub mobile app — but **not SMS**. SMS-based 2FA is vulnerable to SIM-swap attacks; the cost of disallowing it is zero because all current and planned org members can use authenticator apps.

Karim uses Microsoft Authenticator (TOTP) for both. Kenny's 2FA is **currently disabled** as of May 4, 2026 — flagged for the next nudge to him via Microsoft Teams. He cannot effectively use his Owner role until 2FA is enabled.

### People

| Member | Role | Status | Notes |
|---|---|---|---|
| Karim Mourad (`kmourad-fitzrovia`) | Owner | Active | Primary admin, signed commits configured |
| Kenny Marcano (`KMarcanoFITZ`) | Owner | Accepted, 2FA pending | Universal admin model from `05-policies/access-control.md`; second pair of hands for the no-self-approval rule |
| Joseph Agozzino | — | Deferred | Adding when he onboards into a working environment after Tool Starter exists |

The two-Owner model is deliberate — it implements the universal admin model from `05-policies/access-control.md`. Either Owner can administer everything, but the no-self-approval rule from `04-standards/branching-and-prs.md` means neither can push their own code through review alone. The asymmetry between admin power and review authority is the whole point.

---

## The `fitzrovia-tools` monorepo

### Creation

Created May 4, 2026 as a private repo at `github.com/fitzrovia-residential/fitzrovia-tools`. Initial structure follows `04-standards/codebase-organization.md` — `apps/`, `packages/`, `.github/workflows/`, plus root `package.json`, `.gitignore`, `README.md`.

First two commits, both Verified (signed):
- `008460a` — Initialize monorepo: package.json, .gitignore, README.md
- `09a34c3` — chore: add CODEOWNERS and PR template

Workspace runtime: **Bun 1.3.13**. Chosen over npm/pnpm/yarn for performance and the all-in-one nature (package manager + JS runtime + bundler + test runner). Workspaces are managed via `package.json` `workspaces` field.

### `.github/` configuration files

Two files committed in `09a34c3`, generated by Claude Code from the handbook standards:

- **`CODEOWNERS`** — foundation-phase configuration. Karim and Kenny route to all paths. Steady-state config (with Joseph added to non-IT-critical paths) is documented in `04-standards/branching-and-prs.md` and applied via PR when Joseph is review-capable.
- **`PULL_REQUEST_TEMPLATE.md`** — mirrors the seven items in `04-standards/pre-pr-checklist.md` as checkboxes. Auto-populates every PR description.

### Branch protection — `main protection` ruleset

Configured via GitHub Rulesets (not the older "Branch protection rules" UI), Active as of May 4, 2026.

Ruleset name: `main protection`. Targets the default branch (`main`).

**Rules enforced:**

| Rule | Configuration | Why |
|---|---|---|
| Require pull request before merging | 1 required approval | No direct pushes; every change goes through a PR with at least one human approver besides the author |
| Require Code Owners review | ON | CODEOWNERS routing is enforced, not advisory |
| Dismiss stale approvals on new commits | ON | Closes the "approved 3 days ago, now totally different code" failure mode |
| Require approval of most recent reviewable push | ON | Author can't approve their own subsequent push |
| Require conversation resolution before merging | ON | Review comments must be marked resolved |
| Require branches to be up to date with `main` | ON | Forces rebase or merge before merge — also enforced socially via pre-PR checklist item 6 |
| Block force pushes | ON | History rewrites on `main` would break the audit trail |
| Restrict deletions | ON | `main` cannot be deleted by anyone except via explicit rule change |
| Require signed commits | ON | Belt-and-suspenders with Vercel's "Require Verified Commits" — same enforcement at GitHub layer |
| Require status checks to pass | ON, with `CodeRabbit` (provider `coderabbitai`) as a required check | Added May 5, 2026 after PR #1 (CLAUDE.md addition) registered CodeRabbit's check name with GitHub. PRs cannot merge unless CodeRabbit's review check passes. Build/lint/typecheck checks will be added alongside CodeRabbit when those CI jobs are created |

**Rules deliberately NOT configured today:**

- **Restrict who can dismiss reviews**: This option exists in classic Branch Protection but is not exposed as a separate rule in GitHub Rulesets. Effectively superseded by "Dismiss stale approvals on new commits" plus the Owner role being limited to Karim and Kenny anyway.

**Foundation-phase bypass exception:**

`Repository admin` role is on the bypass list with "Always allow." This includes both Karim and Kenny but in practice only Karim is pushing during foundation phase. **Sunset trigger: before any tool building begins, including the landing page.** Karim removes the bypass entry from the ruleset himself when foundation infrastructure is complete.

This is the only documented exception to the no-self-approval rule, and it's deliberately time-bound. Without it, every config-and-scaffolding PR during foundation would route through Kenny — a real bottleneck given Kenny's 9–5 IT role and the high PR volume during foundation phase.

### Dual-approval on IT-critical packages — how it's actually enforced

The dual-approval rule for `packages/auth/`, `packages/supabase-client/`, and `packages/activity-log/` is **not enforced by GitHub branch protection**. The original plan was to use a second ruleset with per-path approval count, but that rule is gated behind the GitHub Enterprise plan; Fitzrovia is on Team. Discovered during actual ruleset configuration on May 4.

The replacement mechanism is two-layered:

1. **CODEOWNERS routing** — PRs touching IT-critical paths auto-request review from both Karim and Kenny (configured in `.github/CODEOWNERS`)
2. **CodeRabbit gating** — CodeRabbit reviews every PR and posts a status check; that check is required to pass before merge (configured May 5, 2026). The path-specific dimension — CodeRabbit recognizing PRs touching IT-critical paths and withholding its own approval until both reviewers have approved — is configured separately in CodeRabbit's path-instructions and pre-merge-check settings, and is still pending. See `04-standards/branching-and-prs.md` "Branch protection and the dual-approval mechanism" section for the architectural detail and the configuration list for the pending Part B task.

Outcome is identical to the Enterprise-native rule once Part B is configured. Mechanism is different.

### General repo settings

Configured under `Settings → General` on `fitzrovia-tools`:

- **Automatically delete head branches** on merge: ON. Keeps the branch list clean post-merge.
- **Always suggest updating pull request branches**: ON. Surfaces the "Update branch" button on PR pages when behind `main` — makes pre-PR checklist item 6 visible to builders.
- **Allow auto-merge**: OFF (deliberate). The approver clicks Merge as a final sanity step; auto-merge would short-circuit that.
- **Allowed merge methods**: **Merge commit only** (squash and rebase both disabled, May 6, 2026). Reasoning in `04-standards/branching-and-prs.md` "Merge strategy: merge commit by default" section. Short version: preserves per-batch commit history (matters for non-technical builders reading PR archaeology), and `git branch -d` works cleanly on merged branches (squash breaks safe-delete because original commits don't exist on `main`).
- **Default merge commit message**: "Pull request title" (cleaner subject lines than GitHub's default `Merge pull request #N from <branch>` format).

### What's NOT enabled (deliberately)

- **GitHub Advanced Security / Secret Protection / Code Security**: deferred via proportionate-governance decision (May 6, 2026). At Fitzrovia's scale (private repo, 1-3 trusted committers, layered review with `/review` + `/security-review` + CodeRabbit + the Approver Code Review Skill including explicit secret scanning), the marginal value over the existing layers is modest. Decision and re-evaluation triggers documented in `! handbook configuration list/handbook-configuration-list.md`.
- **GitHub Pages**: no use case in our stack. Vercel handles all deployment.
- **Discussions**: unused; Linear holds product/intake discussion.
- **Wikis**: unused; the handbook itself is the documentation.
- **Codespaces**: unused; builders develop locally on their Windows laptops per `06-operations/development-setup.md`.
- **Org-level SAML SSO via Microsoft Entra**: pending. Will be configured once Kenny's broader Entra rollout for the AI Studio platforms is ready. Today, identity is managed via individual `@fitzrovia.ca` accounts with mandatory 2FA.

---

## Connected integrations on `fitzrovia-tools`

| Integration | Status | Configured via | Notes |
|---|---|---|---|
| Vercel ↔ GitHub | Verified May 4, 2026 | `vercel.com/new` import flow | Connection is at the org level; per-app project imports happen when each `apps/*` exists |
| CodeRabbit ↔ GitHub | Verified May 4, 2026 | CodeRabbit `Add Repositories` flow | Required a re-install — the original "All repositories" scope from May 1 didn't auto-pick up the repo. See `06-operations/coderabbit-setup.md` for the operational lesson |
| Linear ↔ GitHub | Connected May 4, 2026 | Linear → Settings → Integrations → GitHub | Scope: GitHub linking & Code access. Branch format: `identifier-title`. Magic words ON. Repository access scoped to `fitzrovia-tools` only |

---

## Watchlist (consolidated)

Things deliberately left at default or deferred today that may want adjustment as the studio matures:

1. **Status checks on `main protection`**: CodeRabbit added as a required check May 5, 2026. Build/lint/typecheck checks will be added when those CI jobs exist (post-foundation). Tracked in the configuration list.
2. **Foundation-phase bypass on `Repository admin` role**: remove before any tool building begins, including the landing page. Tracked in the configuration list with sunset trigger.
3. **GHAS Secret Protection**: deferred via proportionate-governance decision (May 6, 2026), not pending budget approval. The layered review model (`/review` + `/security-review` + CodeRabbit + Approver Code Review Skill including explicit secret scanning) covers the gap at Fitzrovia's current scale. Re-evaluation triggers documented in the configuration list.
4. **SAML SSO**: pending Kenny's broader Entra rollout. Today's identity story is `@fitzrovia.ca` accounts with mandatory 2FA, which is sufficient at 2-person scale.
5. **Org-level audit log**: Enterprise-only feature. At Team-plan scale and 2-person ops, the audit need is met by commit history + branch protection logs + CodeRabbit's review history. Revisit if a real audit need surfaces that those don't cover.

The discipline is the same as the CodeRabbit doc: don't pre-configure for hypothetical scale; observe behaviour and tighten where real friction surfaces.

---

## What's not configured today (intentionally)

- **`builders` GitHub team**: deferred until Joseph onboards. With only Karim and Kenny as Owners today, a separate team for non-Owner builders would have one slot to fill and zero members. Created when Joseph joins.
- **Org-level `CLAUDE.md` or org-level instructions**: Claude Code reads `CLAUDE.md` at the repo root, not org-level. The repo-root `CLAUDE.md` was shipped to `fitzrovia-tools/main` on May 5, 2026 (PR #1). No org-level instructions configured.
- **GitHub Actions / CI workflows**: `.github/workflows/` exists as an empty folder. CI jobs (build, lint, typecheck) will be added when there's actual code to run them against. Each new check will be added to the `Require status checks to pass` rule on `main protection` alongside the existing `CodeRabbit` requirement.
- **Webhooks**: none configured. CodeRabbit, Vercel, and Linear all manage their own webhook subscriptions through the GitHub App they install.
