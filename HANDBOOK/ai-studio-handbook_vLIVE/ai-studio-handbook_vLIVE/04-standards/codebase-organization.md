# Codebase Organization

**Path in handbook:** `04-standards/codebase-organization.md`

**Last updated:** May 18, 2026
**Owner:** Karim Mourad

---

## TL;DR

One monorepo (`fitzrovia-tools`) with two top-level folders:

- **`apps/`** — every internal tool is a folder here. Apps are independent — nothing in one app folder is imported by another.
- **`packages/`** — shared code that more than one app uses. Currently: `shared-entities/` (Building, Unit, Tenant types), `design-system/`, `auth/`, `activity-log/`, `supabase-client/`.

Three rules:

- **Shared entities (Building, Unit, Tenant, Employee, Vendor, Property) are defined exactly once** in `packages/shared-entities/`. Every tool imports from there. Don't redefine.
- **Approval depends on path.** `apps/*` and most packages: one approver. IT-critical packages (`auth/`, `supabase-client/`, `activity-log/`): two approvers (Karim AND Kenny).
- **Tool Starter generates new apps** with the right scaffolding pre-wired. Don't hand-roll a new app folder.

The full folder structure, "what goes in apps/ vs packages/" rules, the shared-entity decision logic, and the approval matrix are below.

---

## Purpose

This document defines how the Fitzrovia AI Studio codebase is structured: where each tool's code lives, how shared concepts (buildings, units, tenants) are defined exactly once across all tools, and the rules every builder follows when adding a new tool or a new shared entity.

It answers two practical questions builders will have on day one:

1. "I'm building a new tool. Where does my code go?"
2. "Buildings (or units, or tenants) show up in five different tools. Do I define a Building in each tool, or is there a canonical version somewhere?"

The answers shape every line of code Fitzrovia writes from here forward. Getting this wrong early creates years of cleanup work; getting it right means each tool stays clean and consistent without anyone having to think about it.

---

## The decision in one sentence

Fitzrovia uses a **monorepo** structure: one GitHub repository called `fitzrovia-tools` that contains every internal tool as a folder under `apps/`, plus a `packages/` directory holding shared code that every tool imports.

---

## Why monorepo

> **Plain English:** Instead of giving each tool its own separate GitHub repository (a "polyrepo" approach), all tools live together in one big repo. This sounds messier but is actually cleaner because shared code — like the definition of what a "Building" is — lives in one place that every tool reads from. When something changes about buildings, we change it once and every tool gets the update.

The monorepo decision rests on three observations specific to Fitzrovia:

1. **Shared entities dominate the codebase.** Buildings, units, tenants, employees, vendors, and properties appear in nearly every tool we'll build. In a polyrepo, each tool would either duplicate these definitions (creating drift) or depend on a shared package published to a private registry (creating versioning overhead). The monorepo lets every tool import from a single canonical source with no version management.

2. **Refactoring shared code is a single PR.** When Yardi adds a new field to buildings, we update the canonical Building type once and every tool sees the change in the same commit. In a polyrepo, the same change requires publishing a new package version, then opening a separate PR in every tool's repo to bump the dependency. For a 3-builder team, this is pure overhead with no governance benefit.

3. **Builders navigate the whole codebase in one place.** Joseph works in `apps/leasing-pipeline/`. Karim works in `apps/investor-reporting/`. They each see only their own work day-to-day, but the rare times they need to cross-reference each other's tools — or look at a shared entity — they don't have to clone a different repo. Cognitive load matters when builders are non-technical.

The trade-off is that a monorepo can grow large over time. At Fitzrovia's scale (3-5 builders, 5-15 tools projected for the first year), this is not a real concern. Companies operating monorepos with 10,000+ engineers and millions of files have proven the pattern scales. What we're doing is the simple end of it.

---

## The folder structure

> **Plain English:** Every tool gets its own folder under `apps/`. Code that's shared between tools lives under `packages/`. There are also a few top-level files for repo-wide configuration. That's it.

```
fitzrovia-tools/
│
├── apps/                          # Every internal tool, one folder per tool
│   ├── leasing-pipeline/
│   ├── investor-reporting/
│   ├── tenant-screening/
│   ├── intake-portal/             # The hub.fitzrovia.ca/intake form
│   └── hub/                       # The hub.fitzrovia.ca tool selector itself
│
├── packages/                      # Shared code, used by every app
│   ├── shared-entities/           # Building, Unit, Tenant, Employee, Vendor types + queries
│   ├── design-system/             # Design tokens, components, layouts (mirrors `01-design-system/`)
│   ├── auth/                      # SSO, M365 group checks, role helpers
│   ├── activity-log/              # tool_activity_log writes — every tool uses this
│   └── supabase-client/           # Configured Supabase client with RLS, error handling
│
├── .github/                       # Repo-wide GitHub configuration
│   ├── PULL_REQUEST_TEMPLATE.md   # Mirrors 04-standards/pre-pr-checklist.md
│   ├── CODEOWNERS                 # Auto-request Karim/Kenny on relevant PRs
│   └── workflows/                 # GitHub Actions (CI checks, build, deploy hooks)
│
├── package.json                   # Repo-wide dependencies, workspace config
├── README.md                      # Repo overview, links to handbook
└── .gitignore                     # Excludes .env*, node_modules, build artefacts
```

### What goes in `apps/`

Every internal tool is a folder under `apps/`. The folder name matches the tool name in lowercase, hyphenated (e.g. `leasing-pipeline`, not `LeasingPipeline` or `leasing_pipeline`).

Each app folder contains everything specific to that one tool: its UI, its API routes, its tool-specific database schemas (if any), its README, its environment variable template (`env.example`), and its tests. Nothing in an app folder should be imported by any other app folder. Apps are independent.

When the **Tool Starter** generates a new app, it creates the folder structure here, pre-wired with imports from `packages/` for the standard concerns (auth, activity logging, shared entities, design system). The builder fills in the tool-specific logic and rarely touches the wired-in pieces.

> **What the Tool Starter is.** A small command-line generator that scaffolds a new app folder with all the standard wiring already in place — SSO, Supabase client, activity logging, design system imports, an `env.example` template, and a README skeleton. The Tool Starter lives in a separate repo (`fitzrovia-residential/tool-starter`) and is invoked from the monorepo root. It is the mechanism that makes "consistency by design, not by audit" (Operating Principle 12) real: every new tool starts in the right shape because the generator produced it that way. See the glossary for the formal definition.

### What goes in `packages/`

Anything that more than one app would otherwise duplicate. The current packages are:

- **`shared-entities/`** — TypeScript types and database query functions for every Fitzrovia entity that appears in multiple tools. Currently includes Building, Unit, Tenant, Employee, Vendor, and Property. Sourced from Yardi via the existing data pipeline; this package is the canonical TypeScript representation. Detailed rules for what belongs here are in the next section.

- **`design-system/`** — Code-side mirror of the canonical design system documented in `01-design-system/`. Contains Fitzrovia design tokens (colors, type, spacing — sourced from `01-design-system/colors_and_type.css`), Lucide icon imports, and the standard component library. Every app imports its UI primitives from here so visual consistency is automatic, not audited.

- **`auth/`** — Single Sign-On integration, Microsoft 365 group membership checks, and role helpers (e.g. `isUniversalAdmin(user)`, `inGroup(user, 'finance-team')`). Every app uses these so the access control model from Operating Principle 9 is enforced uniformly.

- **`activity-log/`** — A single function `logActivity(toolName, action, input, output)` that every tool calls when something meaningful happens. Centralising this guarantees the `tool_activity_log` table is populated consistently, which the audit and compliance work depends on.

- **`supabase-client/`** — A pre-configured Supabase client with the right RLS settings, error handling, and connection pooling. Apps import this rather than configuring Supabase themselves, which prevents the kind of mistake that accidentally bypasses RLS.

New packages are added when something earns a place — see "How to add a shared package" below.

### What goes at the root

Only repo-wide configuration: package management (`package.json`), GitHub configuration (`.github/`), the README, and `.gitignore`. Anything tool-specific belongs in `apps/`. Anything shared belongs in `packages/`. The root stays small.

---

## The shared-entities discipline

> **Plain English:** This is the most important rule in the entire document. Anything that represents a real Fitzrovia thing — a building, a unit, a tenant — has exactly one definition that every tool reads from. Tools never invent their own version of a Building. If a tool needs Building plus extra fields, it extends the canonical version rather than redefining it. This rule is what keeps the codebase coherent over years.

### What qualifies as a shared entity

A concept earns a place in `packages/shared-entities/` if all three are true:

1. **It represents a real-world Fitzrovia thing**, not a tool-specific construct. Building, Unit, Tenant, Employee, Vendor, Property all qualify. `LeasingPipelineFilter` does not — that's a UI concept inside one tool.

2. **It appears in two or more apps** (or is reasonably expected to). If only one tool needs it, leave it in that tool's folder. Promote it to `shared-entities/` when the second tool needs it.

3. **It has a single source of truth elsewhere** — typically Yardi, M365, or another system Fitzrovia already operates. The shared entity is the canonical TypeScript representation of that source-of-truth concept, not an independent definition.

### How shared entities are defined

Each entity lives in its own file inside `packages/shared-entities/`:

```
packages/shared-entities/
├── building/
│   ├── types.ts              # Building TypeScript type
│   ├── queries.ts            # Functions for reading Buildings from Supabase
│   ├── relations.ts          # Helper functions for Building → Unit, Building → Tenant
│   └── index.ts              # Re-exports the public surface
├── unit/
├── tenant/
├── employee/
├── vendor/
├── property/
└── index.ts                  # Re-exports every entity's public surface
```

Apps import from the top-level index:

```typescript
import { Building, getBuildingById } from '@fitzrovia/shared-entities'
```

Never from internal paths. This keeps the package's internal structure refactorable without breaking apps.

### The "extend, don't redefine" rule

When a tool needs a Building with extra fields specific to that tool, the rule is to extend the canonical type, not redefine it. For example, the leasing pipeline tool might need a `BuildingWithVacancies` that adds vacancy data to the canonical Building:

```typescript
// In apps/leasing-pipeline/types.ts
import { Building } from '@fitzrovia/shared-entities'

export type BuildingWithVacancies = Building & {
  currentVacancies: number
  projectedVacancies30Days: number
}
```

This guarantees that anywhere `BuildingWithVacancies` is used, the canonical Building shape is preserved. If a new field is added to Building upstream, `BuildingWithVacancies` automatically inherits it. No drift.

The opposite — a tool defining its own Building with only the fields it cares about — is explicitly forbidden, because it creates the cup-versus-cup problem at scale: five tools, five subtly different Building shapes, no way to reconcile them later.

### Code review enforcement

The `approver-review` skill explicitly checks for this pattern. PRs that introduce a new entity definition outside of `packages/shared-entities/` get flagged with a recommendation to either (a) move it to shared-entities if it qualifies, or (b) confirm in writing that it's genuinely tool-specific. The pre-PR checklist also includes this as a builder self-check.

---

## How to add a new app

> **Plain English:** When you start building a new tool, you don't manually create a folder and figure out what goes in it. You run the Tool Starter, which generates a properly-structured app folder with all the standard wiring already in place. You then fill in the tool-specific logic. There is one exception: the first three foundation tools (landing page, tool selection page, intake form) are built by hand, because the Tool Starter is extracted from those three rather than written before them.

The standard process (from the fourth tool onward):

1. **Linear ticket exists** — the new tool is approved, prioritised, and assigned. The ticket has a tool name (e.g. `leasing-pipeline`).
2. **Branch off `main`** — name the branch `aisXX-init-leasing-pipeline` where `XX` is the Linear ticket number.
3. **Run the Tool Starter** — from the repo root: `bun run new-app leasing-pipeline`. This creates `apps/leasing-pipeline/` with the full standard structure (auth wired in, activity log wired in, shared-entities imported, design system imported, env.example template, README skeleton).
4. **Fill in the tool-specific logic** — the builder writes the actual feature code inside the new folder.
5. **Open a PR** — when ready, follow the standard branching and PR workflow described in `04-standards/branching-and-prs.md`.
6. **Tier 2 launch checklist** — apply the launch checklist from the roadmap (Section 10) before going live.

The Tool Starter ensures every new app starts in the right shape. From the fourth tool onward, builders should not be creating app folders by hand.

### The first three tools are an exception

Karim builds the first three foundation tools — the landing page at `hub.fitzrovia.ca`, the tool selection page that staff see after SSO, and the intake form at `hub.fitzrovia.ca/intake` — by hand, before the Tool Starter exists. The reason is sequencing: a starter template only encodes patterns that have proven themselves, so building it before any real tool exists is guessing. The right pattern is to build the first tools properly, then extract the Tool Starter from what worked.

For these three tools, the process is:

1. **Linear ticket exists** — same as standard process.
2. **Branch off `main`** — same as standard process.
3. **Create the app folder manually** — `apps/<tool-name>/`, following the conventions described in the "What goes in `apps/`" section above. Set up imports from `packages/` for the standard concerns (auth, activity logging, shared-entities, design system) directly.
4. **Build the tool** — same as standard process.
5. **Open a PR** — same as standard process. Kenny is the required approver because Karim is the author and cannot approve his own PRs.
6. **Tier 2 launch checklist** — same as standard process.

After the third foundation tool ships and the patterns have stabilised, the Tool Starter is extracted into its separate repo (`fitzrovia-residential/tool-starter`) and the standard process becomes the default. From that point, every new tool — including Joseph's first build — uses the generator.

This also means Joseph's first day starts with the Tool Starter already proven. He doesn't pioneer; he follows well-worn patterns. That's deliberate.

---

## How to add a shared package

> **Plain English:** New shared packages are rare. We only add one when something has been duplicated in two apps and we've decided it should be unified. This isn't something a builder does on their own — it's a deliberate decision documented in the handbook.

The standard process:

1. **Identify duplication** — the same code, type, or pattern exists in two apps and is starting to drift.
2. **Open a Linear ticket** for the shared package extraction. Tag Karim and Kenny.
3. **Discussion** — does this pattern genuinely belong shared, or is it coincidentally similar? Sometimes the answer is "leave it alone for now."
4. **Extract** — if approved, create `packages/<package-name>/`, move the code, update the two apps to import from the new package, and open a single PR for all of it.
5. **Document** — add a one-line entry in this document's "What goes in `packages/`" section explaining what the new package is for. This is the only place new packages are listed.

A new package is a structural change to the codebase. It should always be visible in this document, never hidden in app code.

---

## How shared entities relate to Yardi and Supabase

> **Plain English:** Yardi is the master record for Fitzrovia's real-world data — what buildings exist, who lives in them, what they pay. Supabase is where that data is mirrored so our tools can read it quickly. The shared-entities package provides the TypeScript types and query functions that match what Supabase holds, which in turn matches what Yardi knows.

The data flow:

```
Yardi (source of truth)
   ↓ existing data pipeline
Supabase tables (mirror)
   ↓ packages/shared-entities/ query functions
Apps (read entities, never write to Yardi tables directly)
```

Three principles fall out of this:

1. **Apps never write to entity tables.** Buildings, units, tenants are sourced from Yardi. If a tool needs to record something derived (e.g. "this building has been flagged for review"), that's a tool-specific table, not a modification of the Building entity.

2. **Schema changes start in Yardi**, propagate through the data pipeline, then update Supabase, then update `shared-entities`. Builders don't change entity types unilaterally. If a tool needs a field that doesn't exist, that's a conversation with Karim and Kenny first.

3. **Tool-specific tables live alongside their tool**, not in `shared-entities`. A `leasing_pipeline_filters` table that only one tool uses lives in that tool's Supabase schema and is referenced from `apps/leasing-pipeline/`, not from `packages/shared-entities/`.

Detailed schema patterns and RLS rules are in `04-standards/database-conventions.md`.

---

## Imports and module boundaries

> **Plain English:** This section lists the rules for what's allowed to import from what. The short version: apps can import from packages, packages can import from each other carefully, but apps never import from each other.

The rules:

1. **Apps can import from any package.** This is the whole point of having packages — they're for app consumption.

2. **Apps never import from other apps.** `apps/leasing-pipeline/` cannot import anything from `apps/investor-reporting/`. If two apps need the same code, that code belongs in a package. Without this rule, the monorepo collapses into a tangled web within months.

3. **Packages can import from other packages**, but with discipline. `auth/` can import from `shared-entities/` (it might need User types). `shared-entities/` should not import from `auth/` (entities are pure data, not authenticated operations). The rule of thumb: lower-level packages don't depend on higher-level ones. When unsure, ask Karim or Kenny.

4. **Nothing imports from `node_modules` directly except top-level dependencies.** Standard practice. Imports are either from `@fitzrovia/<package>` or from public npm packages declared in the relevant `package.json`.

5. **Top-level imports use the workspace alias.** Every shared package is imported as `@fitzrovia/<name>`, never as `../../packages/<name>/...`. This is enforced by the workspace configuration in the root `package.json` and is what allows packages to be reorganised without breaking apps.

6. **Packages don't read `process.env` directly.** Environment variables are read in the consuming app (`apps/<app>/src/**`) and passed into package factory functions as explicit arguments. This is because Next.js's `NEXT_PUBLIC_*` build-time inlining doesn't reliably reach workspace package source — even with `transpilePackages` set in `next.config.ts`, runtime reads of `process.env.NEXT_PUBLIC_…` inside package code can resolve to `undefined`. The pattern: package exposes `createClient({ url, anonKey })` rather than reading env vars itself; the app reads env vars where Next.js definitely inlines them and passes values in. This applies to server-only secrets too — Server Actions in `apps/` read `process.env.SUPABASE_SERVICE_ROLE_KEY` and pass to the package factory, never inside the package. Discovered during AIS-11; the alternative is hours of debugging "missing env var" errors that look like config issues but are actually scoping issues.

---

## Who can change what

> **Plain English:** Builders can propose changes anywhere in the codebase by opening a Pull Request. What differs is who approves the merge. The rules also differ based on which phase we're in. Right now (foundation phase), only Karim and Kenny are approvers. Once Joseph is onboarded and has shown he can review competently, he becomes a third approver for non-IT-critical paths — this solves the bottleneck where Karim's PRs would otherwise pile up waiting for Kenny.

The principle: **review depth scales with the type of risk the code carries, not with how "shared" it is.** Adding two approvers everywhere would slow the studio without adding real safety. Adding two approvers where IT and domain expertise both matter catches real problems.

The full operational rules — including the foundation phase versus steady-state distinction, when Joseph becomes review-capable, and how to manage Kenny's bandwidth in the foundation phase — live in `04-standards/branching-and-prs.md`. The summary below captures who approves what.

**Foundation phase (now until Joseph is review-capable, ~2–3 months):**

| Path | Who must approve |
|---|---|
| `apps/*` | Karim or Kenny |
| `packages/shared-entities/`, `packages/design-system/` | Karim or Kenny |
| `packages/auth/`, `packages/supabase-client/`, `packages/activity-log/` | Karim **and** Kenny |

**Steady state (after Joseph is review-capable):**

| Path | Who must approve |
|---|---|
| `apps/*` | Karim, Kenny, or Joseph |
| `packages/shared-entities/`, `packages/design-system/` | Karim, Kenny, or Joseph |
| `packages/auth/`, `packages/supabase-client/`, `packages/activity-log/` | Karim **and** Kenny |

In both phases, the no-self-approval rule applies: the PR author cannot approve their own PR.

The dual-approval rule applies to `auth/`, `supabase-client/`, and `activity-log/` because:

- **`auth/`** governs Single Sign-On, Microsoft 365 group membership checks, and the universal admin model. A subtle change here can silently weaken access control across every tool. Kenny owns Entra and the access control architecture; his review catches problems Karim wouldn't see.

- **`supabase-client/`** configures Row-Level Security, connection handling, and the patterns that prevent tools from accidentally bypassing RLS. Database security is Kenny's beat.

- **`activity-log/`** writes the audit trail that supports Law 25 and PIPEDA compliance. Weakening or breaking activity logging compromises Fitzrovia's ability to demonstrate compliance. Kenny ensures the log keeps doing its job.

Joseph never approves IT-critical packages, even in the steady state — those carry IT-substantive risk where Kenny's review is the point, not throughput.

For everything else in `packages/` — Building schema changes, new design tokens, query helpers — single approval is sufficient. In the steady state, that approval can come from Karim, Kenny, or Joseph. Kenny's substantive review on these would be rubber-stamping; he doesn't have the domain context to evaluate whether a Building should have a `heritageDesignation` field, and requiring him as a reviewer would just slow merges and train him to nod through changes he can't meaningfully evaluate.

The mechanical implementation lives in `.github/CODEOWNERS` in the monorepo, which automatically requests the right reviewers when a PR touches files in each path. Builders don't have to remember the rules — GitHub enforces them. The CODEOWNERS file syntax for both phases is detailed in `04-standards/branching-and-prs.md`.

---

## What this enables, what this prevents

> **Plain English:** A short list of what we get from this structure, and what kinds of mistakes it makes impossible.

What this enables:

- A new builder can find any tool's code in 30 seconds (`apps/<tool-name>/`).
- A schema change to Building updates every tool simultaneously, in one PR.
- The Tool Starter can generate a new app that's structurally identical to every existing one, with no per-tool variation.
- Reading any tool's code, you can tell at a glance which parts are tool-specific (in `apps/`) and which are shared (in `packages/`).
- Code review is faster because reviewers know where to look for what.

What this prevents:

- Five different definitions of Building scattered across five apps.
- Drift between tools that handle the same entity differently.
- The "I copied this auth code from another tool and modified it" pattern, which is how subtle security bugs spread.
- Tools accidentally depending on each other in ways that break when one is changed.
- Confusion about where new code should go.

---

## What's intentionally not in this document

This document is about codebase structure, not about:

- **How to write code within a file** — see `04-standards/code-conventions.md`
- **How branches and PRs work** — see `04-standards/branching-and-prs.md`
- **How to set up your laptop to run the code** — see `06-operations/development-setup.md`
- **What every tool must do for security** — see `04-standards/security-baseline.md`
- **How to design a database schema** — see `04-standards/database-conventions.md`

If you're looking for something not covered here, it's almost certainly in one of those documents.
