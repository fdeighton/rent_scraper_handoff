# Pre-PR Checklist

**Path in handbook:** `04-standards/pre-pr-checklist.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

## TL;DR

Before opening a PR, confirm these 7 things:

1. Ran `/review` and `/security-review` in Claude Code
2. Linked the Linear ticket (`Closes AIS-XX` in the PR description)
3. If a requester asked for the change, they confirmed it works on the Vercel preview
4. New environment variables are in `env.example`
5. New tables have RLS policies (or aren't Red-classified)
6. Tested the preview deployment myself
7. PR is one logical thing, not three

These appear as auto-populated checkboxes on every PR. Tick them honestly. CodeRabbit blocks merge on empty boxes.

The full reasoning — three-layer review model, what's enforced vs cultural, why the checklist stays short — is below.

---

## Purpose

This is the short list of things every builder confirms before opening a Pull Request. Every item on this list is something a non-technical operator can genuinely answer without reading code. Anything that *would* require code-reading lives in automation, not on this checklist.

The checklist is intentionally short. Long checklists get rubber-stamped; short ones get read.

This document is the canonical source. The PR template in every repo (`/.github/PULL_REQUEST_TEMPLATE.md`) mirrors this checklist as a checkbox list builders complete when opening a PR.

---

## How verification actually works at Fitzrovia

> **Plain English:** Fitzrovia's builders and approvers are non-technical. We don't pretend to read code. The verification work happens in three layers — automation does the heavy lifting, Claude translates everything into plain English, and the human checklist is short and non-code. The list below is layer 3.

The three layers:

**Layer 1 — Automation enforces what can be mechanically verified.** CodeRabbit reviews every PR and flags issues, including credential-shaped patterns. Branch protection rules prevent direct pushes to `main`. ESLint and CI checks catch import violations, entity definitions in wrong places, missing required patterns. The Tool Starter generates apps that pass these checks by default, so most violations only happen if someone deliberately works around the conventions.

> **Note on push-time secret scanning (May 6, 2026 decision):** GitHub Secret Protection (the paid push-time secret scanning product) is deliberately not enabled at Fitzrovia's current scale. The proportionate-governance call: at 1-3 trusted committers in a private repo with layered review, the marginal value over the existing layers is modest. Defence against secret leaks is now: (1) the builder runs `/review` and `/security-review` before pushing (Layer 2), (2) CodeRabbit flags credential-shaped patterns on PR open (Layer 1), and (3) the Approver Code Review Skill at `02-skills/approver-review/` includes an explicit secret-scanning instruction with patterns to watch for (`sk-` prefixes, JWTs, 32+ character hex, `_KEY`/`_TOKEN`/`_SECRET` assignments, embedded URL credentials). Re-evaluation triggers in `! handbook configuration list/handbook-configuration-list.md`.

The full automation configuration lives in `04-standards/ci-configuration.md` and `04-standards/coderabbit-configuration.md` (both post-foundation documents). When those documents exist, this checklist points to them.

**Layer 2 — Claude translates technical reality into plain English.** `/review` and `/security-review` are the Anthropic built-in commands the builder runs locally — they're free, they cost nothing extra beyond the Claude Code session you're already in, and they produce plain-English findings the builder can address. CodeRabbit posts a plain-English summary on the PR. The `approver-review` skill produces a plain-English go/no-go report when the approver runs it. None of this requires reading code; it requires reading what Claude wrote about the code.

**Layer 3 — The human checklist is short and non-code.** The seven items below are things only the builder knows or has done — judgement and intent, not code analysis. This is the only manual layer, and it's deliberately small.

---

## When to use the checklist

Before you open a Pull Request. Not before every commit. Not before every push. Right before you click "Open Pull Request" or convert a Draft PR to Ready for review.

The flow:

1. Finish the work on your branch
2. Run through this checklist (3–5 minutes)
3. Open the PR with the checkboxes filled in honestly

The PR template appears automatically when you open the PR. Tick the boxes you've done. If you couldn't do something, leave the box unchecked and explain why in the PR description.

---

## Is this enforced?

> **Plain English:** Partially enforced by tooling, mostly by culture. The PR template auto-appears on every PR — you have to deliberately delete it to avoid it. CodeRabbit blocks merge if the checkboxes are unchecked. Branch protection won't let anything reach `main` without CodeRabbit's approval. So skipping the checklist requires deliberate effort. What automation *can't* check is whether you ticked honestly — that's on the team to maintain.

The enforcement layers:

1. **GitHub auto-populates the template.** When you open a PR, GitHub fills the description box with the contents of `.github/PULL_REQUEST_TEMPLATE.md`. Skipping the checklist requires deliberately deleting it before opening — not accidentally forgetting.

2. **CodeRabbit blocks merge on empty checkboxes** (once configured per `04-standards/coderabbit-configuration.md`). If the boxes aren't completed, CodeRabbit comments on the PR and refuses to give its approval. Without CodeRabbit's approval, the PR can't merge.

3. **Branch protection requires CodeRabbit to pass** before merge. This is configured on `main` per `04-standards/branching-and-prs.md`. No CodeRabbit approval, no merge.

4. **The approver verifies the boxes during review.** If checkboxes are ticked but the PR has obvious problems the checklist should have caught, that's a signal of dishonest ticking. The right response is a direct conversation with the builder, not more automation.

What automation **can't** check:

- Whether `/review` and `/security-review` were *actually run*, not just that the box was ticked
- Whether the builder *engaged* with the findings rather than glancing past them
- Whether the requester *actually confirmed* the change works, or the builder just claimed they did

These are trust-and-verify gaps. The checklist works because the team treats it seriously and calls out dishonest ticking when noticed. If "I ran `/review`" is ticked on a PR that clearly has problems `/review` would have caught, the approver asks the builder to walk through what `/review` flagged. That conversation is what makes the checklist mean something.

In short: **skipping the checklist is hard. Lying to it is technically possible but socially costly.** That's the right design.

---

## The checklist

### 1. I ran `/review` and `/security-review` in Claude Code

Both are Anthropic built-ins. They're free — no extra cost beyond the Claude Code session you're already running. They produce plain-English findings.

If `/review` or `/security-review` flagged something Critical or High, I addressed it (or asked Claude to explain it in plain English and made an informed decision). Lower-severity items (Medium, Low, Nit) can be left for follow-up if there's a reason; explain in the PR description if so.

### 2. I linked the Linear ticket

The PR description includes `Closes AIS-XX` where `XX` is the Linear ticket number. This auto-links the ticket and updates its status when the PR merges.

If this PR doesn't map to a Linear ticket (rare — usually a chore or refactor), I explained why in the PR description.

### 3. If this closes a requester's ticket, the requester confirmed it works

Applies when the PR closes a Linear ticket where the requester is a non-builder staff member (e.g. someone in Finance asked for a tool feature). I sent them the Vercel preview link and got their confirmation, via Microsoft Teams or email, that the change does what they asked.

Skip this if the PR is internal infrastructure, a refactor, a bug fix follow-up, or anything else where the requester has nothing to verify.

### 4. If I added a new environment variable, I added it to `env.example`

`env.example` is the template file in every app folder that lists what environment variables the tool needs, with placeholder values. When a new builder onboards or sets up a new machine, they copy `env.example` to `.env.local` and fill in real values from the password vault.

If this PR introduces a new env var, the placeholder line is in `env.example`. Real values are never in `env.example`, never in code, never anywhere outside `.env.local` (local) or Vercel's dashboard (production). See `06-operations/development-setup.md`.

### 5. The data classification is documented in the tool's README

Every tool's README includes its data classification: Green, Amber, or Red. Criteria are in `05-policies/data-classification.md`.

If this is the first PR for a new tool, set the classification in the README. If it's a change to an existing tool, verify the classification is still correct after the change. If the change moved the tool from one classification to another (e.g. it now handles personal data when it didn't before), update the README and flag this in the PR description — the approver needs to know.

### 6. The branch is up to date with `main`

GitHub will tell you if your branch is behind `main`. The PR page shows a banner like "This branch is X commits behind main" if it is.

If behind, click GitHub's "Update branch" button on the PR page, or ask Claude Code to update the branch. If the update creates merge conflicts, ask Claude Code to help resolve them — see the conflict resolution workflow in `04-standards/branching-and-prs.md`.

### 7. The PR title and description are meaningful

The title follows the commit message convention (`feat: short summary`, `fix: short summary`, etc. — see `04-standards/branching-and-prs.md`).

The description explains *why* the change exists and any context the approver needs. Two or three sentences usually. The diff already shows what changed; the description is for the human reading the PR.

---

## What's NOT on this list (and why)

> **Plain English:** A bunch of things you might expect to be on a pre-PR checklist aren't. They're not on this list because automation handles them better than humans can. The handbook would rather have automated enforcement that catches every PR than a manual check that gets rubber-stamped half the time.

What's enforced by automation, not the human checklist:

- **Hardcoded credentials in code.** Defence is layered: CodeRabbit flags credential-shaped patterns on PR open (Layer 1); the builder runs `/review` and `/security-review` before pushing (Layer 2); the Approver Code Review Skill at `02-skills/approver-review/` includes explicit secret-scanning in its security dimension (Layer 3). The env-var discipline in checklist item #4 is the upstream defence — real values never go in `env.example` or anywhere outside `.env.local` and Vercel's dashboard. If something custom (a non-standard token format) might evade automated detection, flag it in the PR description so the approver looks specifically for it.

- **Import violations** (no cross-app imports, alias imports, no entity definitions outside `shared-entities/`). Enforced by ESLint rules in the repo. PRs that violate these patterns fail CI and cannot merge until fixed.

- **Row-Level Security on Red-classified tables.** Enforced by automated checks in CI for any PR touching the Supabase migrations folder. If RLS is missing on a table that the data classification policy requires, CI fails.

- **`tool_activity_log` writes.** The Tool Starter wires activity logging in by default. PRs that touch user-action paths and *don't* call the activity-log function get flagged by ESLint or CodeRabbit.

- **Code style and formatting.** Prettier runs automatically on every commit. CodeRabbit flags non-stylistic issues.

What's enforced by the approver, not the human checklist:

- **Whether the change is the right design.** The approver-review skill produces a plain-English go/no-go report covering this. The builder doesn't self-grade their own design.

- **Whether the implementation matches the spec.** Same — the approver evaluates this with Claude's help.

- **UX quality.** The `ux-review` skill (Tier 2, drafted before first tool ships) handles this.

The principle: the human checklist is for **things only the builder knows** — did I link the ticket, did I get the requester's confirmation, did I document the classification. Everything else is either automated or evaluated by the approver with Claude's help. We don't ask non-technical operators to do code-reading work.

---

## How this checklist is used

### By the builder

Run through it before opening the PR. Take the 3–5 minutes seriously. If an item is unclear, ask Claude or Karim — don't tick a box you don't understand.

### By the approver

When reviewing the PR, the checkboxes are a quick signal. If any are unchecked, the description should explain why. If all are checked but the PR still has obvious problems, that's not the checklist's failure — that's why the approver still reviews CodeRabbit's summary, runs the `approver-review` skill, and clicks the Vercel preview link.

### By CodeRabbit

CodeRabbit can be configured to flag PRs where the template checkboxes aren't completed. This is enabled in the foundation tools' repo and inherited by every tool generated from the Tool Starter.

---

## How this checklist evolves

Items are added when something has bitten us — a real bug, a real near-miss, a real compliance question — and the right response is a manual check rather than automation. If automation can do it, automation does it.

Items are removed when they've been mechanically enforced elsewhere. The rule of thumb: every checklist item should be something only the builder knows, where automation can't help. If automation could help, the item should move there.

The checklist is reviewed quarterly. Changes are made via PR to this document, following the standard `04-standards/branching-and-prs.md` workflow.

---

## What's intentionally not in this document

This document is the pre-PR checklist itself. It is not:

- **The full PR review process** — see `06-operations/pr-review-process.md`
- **The branching workflow** — see `04-standards/branching-and-prs.md`
- **The codebase structure** — see `04-standards/codebase-organization.md`
- **The data classification policy** — see `05-policies/data-classification.md`
- **The local development setup** — see `06-operations/development-setup.md`
- **The CI configuration that enforces most of what's not on this list** — see `04-standards/ci-configuration.md` (post-foundation)
- **The CodeRabbit configuration that catches the rest** — see `04-standards/coderabbit-configuration.md` (post-foundation)

If you're looking for something not covered here, it's almost certainly in one of those documents.
