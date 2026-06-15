# Fitzrovia AI Studio Handbook

The operating system of the Fitzrovia AI Studio. Standards, skills, policies, and processes — all in one place, all versioned, all canonical.

---

## What this is

The Fitzrovia AI Studio is a small, dedicated builder team that creates internal software tools for Fitzrovia Residential using AI as the development assistant. The studio replaces ad-hoc tool building on personal accounts with a governed, company-owned development platform.

This handbook is the source of truth for how the studio operates. It captures the strategic plan that established the studio, the principles that guide day-to-day decisions, the skills and templates that enforce consistency across tools, the policies that keep the work compliant, and the operational playbooks that define how things actually get done.

If a question about the studio can be answered in writing, the answer lives here.

---

## Who this is for

**Builders** — the Studio Lead, Senior Builder, IT Lead, and any future builders. The handbook tells you how to triage intake, how to scope a tool, how reviews work, what standards apply, and how to ship.

**Stakeholders** — leadership, Legal, HR, Finance. The handbook tells you how the studio is governed, what controls exist, what data is handled, and how decisions are made.

**External reviewers** — auditors, regulators, investors. The handbook is the documentation trail for how Fitzrovia governs internal AI tool development.

---

## Where to start

If this is your first time here, read in this order:

1. **`00-foundations/roadmap-v20.md`** — the strategic plan that established the studio. What we're building, why, and how it's structured.
2. **`00-foundations/operating-principles.md`** — the 15 principles that guide day-to-day decisions. Read this even if nothing else.
3. **`00-foundations/glossary.md`** — defined terms used throughout the handbook (Tier 1, RLS, Green/Amber/Red, etc.).
4. **`01-design-system/design-system.md`** — the visual and interaction language every Fitzrovia tool inherits. Voice and tone, error contract, color, typography, layout. Worth reading even if you're not building UI today.
5. **The folder relevant to what you're doing today** — see navigation below.

After this, the handbook works as reference material. Search for what you need, when you need it.

---

## Navigation

| Folder | What lives here |
|---|---|
| `00-foundations/` | Strategic and conceptual baseline — roadmap, operating principles, glossary. Read first. |
| `01-design-system/` | Fitzrovia design tokens, component conventions, voice and tone, Claude Design configuration. |
| `02-skills/` | All Claude skills, versioned individually. Each skill has its own folder with prompt, README, and examples. |
| `03-tool-starter/` | Documentation for the standard Tool Starter template. The actual code lives in a separate repo. |
| `04-standards/` | Engineering and operational standards — code conventions, database conventions, security baseline, deployment checklists. |
| `05-policies/` | Governance documents — Acceptable Use Policy, data classification, access control, incident response, Law 25 / PIPEDA obligations. |
| `06-operations/` | Day-to-day playbooks — intake triage, PR review, deployment, bug response, offboarding, monthly cadence. Also contains setup-experience records (`development-setup.md`, `commit-signing-setup.md`, `coderabbit-setup.md`, etc.). |
| `07-tools-registry/` | Living catalogue of every live tool — owner, users, status, links. |

---

## How to use this handbook

**Reading.** Browse to the folder you need or search the repo. GitHub's search works well across all markdown content (once the handbook is in GitHub — see Status below).

**Proposing changes.** Open a Pull Request against the relevant file. Small changes (typos, clarifications) merge with light review. Substantive changes (new policies, new skills, changes to standards) require review by the Studio Lead and IT Lead — see `CONTRIBUTING.md` for the full process.

**Adding new content.** New skills, policies, and standards are added as the studio grows. The handbook is intentionally a living document — substantive changes go through Pull Request review per `CONTRIBUTING.md`.

**Disagreeing with something.** Read the relevant section, identify what you'd change, and propose a revision via Pull Request. Principles and policies evolve. PR descriptions and Git history capture why decisions were made, which is the right starting point for revisiting them.

---

## Maintenance and authority

This handbook is jointly maintained by the **Director of Operations & AI Strategy** and the **Head of IT**, who together hold Org Owner roles across the studio's infrastructure (GitHub, Vercel, Supabase, Claude Teams, CodeRabbit).

**The handbook is the source of truth.** When this handbook conflicts with a Microsoft Teams message, an email, or someone's recollection of a meeting, the handbook wins. If something is not in the handbook, it is not yet a standard.

**Changes are tracked.** Every commit captures who changed what and when. Git history is the canonical record of how the handbook has evolved (once the handbook is in GitHub).

**Disputes are resolved here.** When studio members disagree on a standard or process, the resolution path is: discuss → propose a Pull Request → merge once aligned. Disagreements that aren't resolved in the handbook aren't resolved at all.

---

## Status

| | |
|---|---|
| **Last updated** | May 6, 2026 |
| **Location** | OneDrive at `Fitzrovia AI Studio/ai-studio-handbook/`. May move to GitHub once the publication path is decided. |
| **License** | Internal — Fitzrovia Residential Inc. confidential |

---

*Welcome to the studio.*
