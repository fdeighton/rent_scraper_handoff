# Claude Code conventions — Fitzrovia AI Studio

**Repo:** `fitzrovia-residential/fitzrovia-tools` (private)
**Owner:** Karim Mourad (`kmourad@fitzrovia.ca`)
**Purpose:** Internal AI-powered tools for Fitzrovia Residential Inc.

This file is read by Claude Code at session start. It is the abbreviated reference card; the full source of truth is the Fitzrovia AI Studio Handbook (separate location, not in this repo). When this file and the handbook disagree, the handbook wins — but this file shouldn't disagree.

---

## Stack

- **Runtime:** Bun 1.3.13 (NOT npm, yarn, or pnpm). Use `bun install`, `bun add`, `bun run`. Lockfile is `bun.lockb`.
- **Framework:** Next.js (App Router) for every `apps/*`.
- **Language:** TypeScript. Strict mode enabled per app.
- **Database:** PostgreSQL on Supabase (`fitzrovia-prod` project, `ca-central-1` Toronto region).
- **Hosting:** Vercel (`Fitzrovia` team, Pro plan, region `yul1`).
- **Auth:** Microsoft Entra SSO at the app layer. Supabase Auth used only for service-account flows.

---

## Monorepo structure

```
apps/                  Each subfolder is one Next.js app, deployed as its own Vercel project.
  hub/                 The platform shell — landing page, tool selector, admin views.
  <tool-name>/         Each tool gets its own folder.

packages/              Shared code, imported via @fitzrovia/<package-name> alias.
  shared-entities/     Canonical type definitions for Fitzrovia entities (Building, Unit, Tenant, etc.).
  auth/                Auth helpers — IT-critical, dual-approval required for changes.
  supabase-client/     Supabase client setup — IT-critical, dual-approval required.
  activity-log/        User-action logging — IT-critical, dual-approval required.

.github/               GitHub configuration: CODEOWNERS, PR template, workflows.
```

Apps in `apps/*` cannot import from other apps in `apps/*`. Cross-app code goes in `packages/*`.

---

## Hard rules

These break production or break the audit trail if violated. Never do them.

1. **Sign every commit.** Vercel rejects unsigned commits at the build layer. GitHub also requires signed commits on `main` via the `main protection` ruleset. Set up commit signing per `06-operations/commit-signing-setup.md` (in the handbook) before first push.
2. **Never commit `.env*` files.** All env files are listed in `.gitignore`. Real values live in Vercel's dashboard (Sensitive Environment Variables, write-only). Code should reference env vars via `process.env`, never inline literals.
3. **Never put secrets in code.** No API keys, no DB passwords, no service role keys, no OAuth secrets. If you find one in code being written, stop and use an env var.
4. **Never push directly to `main`.** Branch protection blocks this for non-admins. Even where bypass is allowed (foundation-phase only, Karim only), don't — every change goes through a PR.
5. **Every Supabase table needs an RLS policy.** The `fitzrovia-prod` project has automatic RLS enabled at the database level (Postgres event trigger), so new tables get RLS turned on automatically. But the migration that creates the table must also include the policies — otherwise the table is RLS-enabled with zero policies, which means nobody (not even authenticated users) can query it. Tables holding Red-classified data (PII, financial) need explicitly-scoped policies; tables holding Green-classified data need a permissive policy.
6. **New tables in `public` schema are NOT auto-exposed via the Data API.** This is deliberate. Migrations that create public-facing tables must include explicit `GRANT` statements (e.g. `GRANT SELECT ON table TO authenticated`).

---

## Branching and PRs

- **Branch naming:** `AIS-XX-short-description` where `AIS-XX` is a Linear ticket reference and `short-description` is 2-5 hyphenated words. Example: `AIS-42-add-leasing-filter`. Use Linear's "Copy git branch name" action (Ctrl+Shift+.) to get this for free from any ticket.
- **PR description:** must include `Closes AIS-XX` (or `Fixes AIS-XX`, or `Part of AIS-XX`). The GitHub-Linear integration uses these magic words to auto-link tickets and update statuses.
- **PR template:** auto-populated. Don't delete the checklist items — work through them.
- **Approvals:** every PR needs at least one approval from a non-author. Karim cannot approve his own code (Kenny does it, and vice versa). PRs touching `packages/auth/`, `packages/supabase-client/`, or `packages/activity-log/` require both Karim AND Kenny.
- **CodeRabbit reviews every PR automatically.** Its review is a required check; PRs can't merge until CodeRabbit approves. Don't fight CodeRabbit's feedback — if it flags something, address it or explicitly justify why it's wrong in a PR comment.

---

## How to find context

When you need more than this file provides, look in this order:

1. **The handbook** — the AI Studio Handbook is the source of truth. It lives outside this repo (separate location). Files referenced from here use paths like `04-standards/branching-and-prs.md` — those are paths within the handbook, not within this repo.
2. **`.github/PULL_REQUEST_TEMPLATE.md`** — current PR checklist, mirrors `04-standards/pre-pr-checklist.md` from the handbook.
3. **`.github/CODEOWNERS`** — current ownership routing.
4. **Linear** — `linear.app/fitzrovia-residential` — for ticket context, status, and discussion.
5. **Karim** — for anything ambiguous. Do not invent product names, features, scope, or conventions; ask first.

---

## What this file deliberately does NOT contain

- **Code style preferences** (indentation, quotes, line length, etc.) — handled by `.eslintrc` and `.prettierrc` config files when those exist. As of today (May 5, 2026), neither is set up; they will be added when `apps/hub/` is scaffolded via `create-next-app`.
- **Detailed how-to instructions** — those live in the handbook.
- **Per-app rules** — each `apps/*` may have its own `CLAUDE.md` layered on top of this one if app-specific conventions matter. None exist today.

---

## Forbidden things

- Don't run `npm install` — use `bun install`. Mixing package managers creates inconsistent lockfiles.
- Don't add a dependency without checking if a similar one already exists in the workspace's `package.json` files.
- Don't bypass branch protection. The foundation-phase admin bypass is documented and time-bound (sunset before any tool building begins). It's not a general-purpose escape hatch.
- Don't invent Linear ticket numbers. If a branch name needs `AIS-XX`, it must reference a real ticket. Create the ticket first, then the branch.
- Don't modify `.github/CODEOWNERS` or `.github/workflows/*` casually — these are IT-critical and require dual approval.
- Don't store anything in the database that the user hasn't already provided. No scraping, no enrichment from external sources without explicit instruction.
