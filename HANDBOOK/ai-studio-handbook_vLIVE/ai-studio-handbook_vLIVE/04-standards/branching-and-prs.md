# Branching and Pull Requests

**Path in handbook:** `04-standards/branching-and-prs.md`

**Last updated:** May 18, 2026
**Owner:** Karim Mourad

---

## TL;DR

- One branch per ticket: `AIS-XX-short-description`
- Every change goes through a Pull Request — no direct commits to `main`
- Commit messages: `<type>: <summary>` (e.g., `feat: add building filter`)
- Open a PR → fill in the auto-populated template → get one approval → merge
- IT-critical paths (`packages/auth/`, `packages/supabase-client/`, `packages/activity-log/`) need both Karim and Kenny to approve
- Author can never approve their own PR
- Vercel auto-deploys `main` to production within ~60 seconds of merge
- Rollback: revert the merge commit; auto-deploys the previous version

The full rationale, edge cases, foundation-vs-steady-state distinction, and conflict resolution playbook are below.

---

## Purpose

This document defines how multiple builders contribute to the same shared codebase without overwriting each other's work. It covers branching, pull requests, approval rules, and conflict resolution.

It answers the practical questions builders hit on day one:

1. "I want to make a change. How do I do that without breaking what someone else is working on?"
2. "Who approves my work, and how does that approval actually happen?"
3. "Two people edited the same file. Now what?"

The rules are deliberately simple. Trunk-based development with short-lived feature branches, mandatory PR review, branch protection on `main`. No GitFlow, no release branches, no elaborate ceremony. The complexity is in following the rules, not in understanding them.

> **What we're rejecting.** "GitFlow" is a branching strategy from 2010 where teams maintain multiple long-lived branches simultaneously: `main` (production), `develop` (in-progress work), `release/*` (versions being prepared to ship), and `hotfix/*` (emergency fixes). Every change traverses several branches before reaching production. It made sense for software released on schedules. It does not make sense for continuous-deployment teams like ours, where the merge to `main` *is* the release. "Release branches" are the version-staging branches in that model. "Ceremony" means process steps that exist to satisfy the workflow rather than accomplish anything substantive — like merging a feature into `develop`, then into a release branch, then into `main`, three merges to ship one change. We use the simpler trunk-based model instead.

---

## The model in one sentence

Every change goes on a feature branch, every branch becomes a Pull Request, every PR gets reviewed and merged into `main`, and Vercel auto-deploys `main` to production within ~60 seconds.

---

## Why trunk-based development

> **Plain English:** "Trunk-based" means there's one master copy called `main`, and everyone's work eventually merges back into it. We don't have separate "development" branches that live for weeks or "release" branches that hold versions waiting to ship. Every merge to `main` is a release. This sounds risky but is actually safer because it forces small, frequent, reviewed changes instead of giant infrequent ones.

The decision rests on three observations specific to Fitzrovia:

1. **Vercel auto-deploys `main`.** Every merge to `main` becomes the live tool within a minute. This is a deliberate choice — see Operating Principle 11 (Quality over quantity) and the roadmap's Step 12. Trunk-based fits this model. Maintaining a separate `develop` branch (the GitFlow approach defined above) would create extra merge steps that accomplish nothing because there's no manual release step to coordinate.

2. **Small team, low conflict rate.** With 3 builders working in different app folders most of the time, real conflicts are rare. The kind of branching strategy designed to manage 50 engineers stepping on each other's work is unnecessary at our scale and would slow us down.

3. **Short-lived, focused branches force scope discipline.** A branch that's doing too much — bundling unrelated changes, creeping in scope, mixing a refactor with a new feature — is hard to review and risky to merge. Trunk-based pressures every change toward "ship one focused thing, then ship the next focused thing." This matches Operating Principle 11 directly. The relevant question isn't "how long has this branch been alive?" — Fitzrovia's builders are part-time and a real new tool can take weeks of calendar time. The relevant question is "is this branch doing one logical thing?" That's what we mean by scope discipline.

What we explicitly reject:

- **No long-lived `develop` branch.** Adds ceremony, no benefit at our scale.
- **No release branches.** Vercel auto-deploys means the merge *is* the release.
- **No sprawling feature branches.** A branch should do one logical thing. If a single ticket has grown to bundle multiple unrelated changes, the ticket gets broken up — not because of how long it's taking, but because reviewing one logical change is much easier than reviewing three at once.
- **No direct pushes to `main`.** Even Karim can't push directly. Branch protection enforces this — see "Branch protection" below.

---

## Branch naming

> **Plain English:** Every branch you create has a name that follows the same pattern, so anyone can tell at a glance what it's about. The pattern includes the Linear ticket number and a short description.

The pattern: `AIS-XX-short-description`

- `AIS` is the Linear team prefix (the AI Studio team in Linear has prefix `AIS`)
- `XX` is the Linear ticket number (e.g. `42`)
- `short-description` is 2-5 hyphenated words describing what the branch does

Examples:

- `AIS-7-init-intake-portal`
- `AIS-42-add-leasing-filter`
- `AIS-103-fix-tenant-search-pagination`
- `AIS-156-update-building-schema`

This pattern matches Linear's `identifier-title` branch format, which means **builders can copy a ready-made branch name directly from any Linear ticket** (Linear's "Copy git branch name" action, keyboard shortcut Ctrl+Shift+. or via the ticket menu). No need to type or remember the format — the copy-paste produces a correctly-formatted branch name with the right ticket identifier and a slug derived from the ticket title.

The Linear ticket number is required by convention, not by tooling. GitHub doesn't natively validate branch names, so "required" here means "the team agrees to do this and PRs without it get pushed back during review." Without the ticket reference, branches drift loose from the work they're supposed to be doing, and reviewing PRs becomes harder because the context isn't immediately findable. Habit plus review pushback is sufficient enforcement at our scale; we're not setting up automation to enforce branch naming.

For branches that don't map to a single ticket — rare, but they happen — use a descriptive name without the ticket prefix and explain in the PR description why no ticket exists. Example: `chore-update-dependencies`. These should be exceptional; the default is one branch, one ticket.

---

## Branch lifecycle

> **Plain English:** A branch should be focused on one logical change, not bundle several unrelated things together. The right question is about *scope*, not calendar time. A small bug fix takes a few hours; a new tool from scratch takes weeks of calendar time at part-time pace, and that's expected. What matters is that whatever the branch is doing, it's doing one cohesive thing — not three things bundled together.

The lifecycle:

1. **Start from updated `main`.** Always pull the latest `main` before creating a new branch. Stale starting points cause unnecessary merge conflicts.
2. **Create the branch.** Named per the convention above.
3. **Work in small commits.** Each commit should be a meaningful unit, not "WIP" or "stuff." See "Commit messages" below.
4. **Push frequently.** At least once per work session. This makes your work visible and recoverable if your laptop dies.
5. **Open a Pull Request when ready** (or as a Draft PR earlier — see below).
6. **Address review feedback** with additional commits on the same branch.
7. **Merge** once approved.
8. **Delete the branch.** GitHub can be configured to do this automatically; we configure it to do so.

### How long should a branch live?

The honest answer: as long as the focused change takes. Fitzrovia's builders are part-time. A new tool (the intake form, the leasing pipeline) realistically takes 4–8 weeks of calendar time even when only one person is working on it part-time. That's normal and not a problem.

What *is* a problem is scope creep: a branch that started as "build the intake form" and has now also added an admin panel, refactored the auth package, and renamed three shared entities. That branch is doing four things, three of which weren't on the ticket. It needs to be split.

The test is: **can you describe what this PR does in one sentence without using "and"?** If yes, the branch is fine regardless of how long it's been alive. If no, split it.

For very large new tools (the foundation tools fall in this category), an alternative pattern works well: ship the smallest viable version first, then iterate in follow-up PRs. Instead of one branch that lives for six weeks until everything is perfect, you have:

- `ais7-init-intake-portal` — minimum viable form, basic submission
- `ais11-intake-portal-validation` — adds field validation
- `ais14-intake-portal-attachments` — adds attachment support
- `ais19-intake-portal-status-emails` — adds confirmation emails

Each PR is reviewable in its own right. The tool grows incrementally in production rather than appearing fully-formed after a long branch.

### Draft PRs

GitHub supports opening a PR in "Draft" state, signalling that it's not yet ready for review but is open for visibility. Draft PRs are encouraged when:

- A change is large and you want early feedback on direction before completing it
- You want CI checks running while you work
- You want to make your work visible to the team

Convert from Draft to Ready when you genuinely want review. Don't leave PRs in Draft as a way to avoid the approval process.

### Merge strategy: merge commit by default

When merging a PR, GitHub offers three strategies: **squash and merge**, **create a merge commit**, and **rebase and merge**. We use **create a merge commit** by default.

Reasoning, in plain English:

- **Squash and merge** combines all commits in the PR into one single commit on `main`. Looks tidy in `git log`, but loses the per-commit history. If a PR has three batches with meaningful commit messages, squashing collapses them into one and the per-batch reasoning disappears. Squash also breaks Git's "is this branch merged?" detection — `git branch -d feature-branch` fails because the original commits don't exist on `main` (only their squashed replacement does), forcing `-D` (force delete) on every merged branch.
- **Create a merge commit** preserves all PR commits as separate history on `main`, plus adds one merge commit tying them together. `git log` shows the per-batch story. `git branch -d` works cleanly. The trade-off is a slightly noisier `git log` view, which doesn't matter at Fitzrovia's scale.
- **Rebase and merge** is a middle ground we don't use. Adds complexity without enough benefit.

**Default: create a merge commit.** GitHub repo settings are configured to disable squash-merge so the option doesn't appear in the merge dropdown.

**Exceptions** where squash *might* be right (rare; need to be deliberate):

- Trivial single-line PRs (typo fix, dependency bump) where the per-commit story has no value
- PRs where the commit history is genuinely noisy ("WIP", "fix typo", "fix typo again", "actually fix") and squashing genuinely improves readability

If you find yourself wanting to squash regularly, the question to ask isn't "should I squash?" — it's "why are my commits noisy?" Clean commits during the work make squashing unnecessary.

### Rollback

To revert a merged PR, revert the merge commit. GitHub provides a "Revert" button on every merged PR. Click it, GitHub creates a new PR that undoes the changes, you review and merge that. Vercel auto-deploys the previous version within ~60 seconds.

---

## Commit messages

> **Plain English:** When you save (commit) your work to Git, you write a short message explaining what changed. We follow a simple convention so the history is readable later.

The format:

```
<type>: <short summary in present tense>

<optional longer description>
```

Where `<type>` is one of:

- `feat` — a new feature or capability
- `fix` — a bug fix
- `refactor` — code change that neither adds a feature nor fixes a bug
- `docs` — documentation changes only
- `chore` — dependency updates, build config, repo maintenance
- `style` — formatting, whitespace, no logic change
- `test` — adding or updating tests

Examples:

- `feat: add building filter to leasing pipeline`
- `fix: tenant search returns wrong results when name has apostrophe`
- `refactor: extract building query helper to shared-entities`
- `docs: update README for new environment variable`
- `chore: bump Next.js to 15.2`

The summary line should be under 72 characters. The longer description (optional) explains *why* the change was made, not *what* — the diff already shows what.

This convention is loose enforcement. CodeRabbit will flag obvious deviations but won't block merges over format.

---

## Pull Requests

> **Plain English:** A Pull Request is how you ask for your work to be merged into `main`. It's a GitHub feature that shows exactly what you changed, lets reviewers comment on specific lines, and gates the merge until someone approves. Every change goes through a PR — there are no exceptions.

### Opening a PR

When you push a branch and open a PR, the PR template (described below) auto-populates. Fill it in:

1. **Title** — same format as commit messages. Often the same as your most descriptive commit.
2. **Linear ticket reference** — link to the ticket. Convention: `Closes AIS-42` (or `Fixes AIS-42` / `Resolves AIS-42`) in the PR description body. Linear's auto-transition to "Live" on merge fires on any linked PR's merge — see "About the closing keyword" below for the nuance.
3. **Description** — what changed, why. Two or three sentences usually. The description is for the reviewer's context, not for posterity (Git history serves that).
4. **Pre-PR checklist boxes** — see `04-standards/pre-pr-checklist.md`. Every PR's template includes these checkboxes; fill them in honestly.

**About the closing keyword.** The convention is to use `Closes AIS-XX` (or `Fixes AIS-XX` / `Resolves AIS-XX`) in the PR description body. Use it for two reasons: it's a clear semantic signal to humans reading the PR that this is the work that closes the ticket, and it matches GitHub's own "closing keyword" syntax for any future GitHub-Issue-based workflow.

**What does NOT depend on the keyword:** Linear's auto-transition to "Live" on merge. The transition is driven by Linear's team-level workflow automation rule (`On PR or commit merge → Live`), which fires on any merged PR linked to the ticket. The PR-to-ticket link itself is established by the branch name (`AIS-XX-…`), the PR title containing `AIS-XX`, or any reference in the description — closing keyword optional. In practice this means a PR with `Part of AIS-XX` in the body will still auto-transition the ticket to Live on merge, same as one with `Closes AIS-XX`.

**Use `Part of AIS-XX` only when** the ticket genuinely spans multiple PRs and this is one of several. Since the first PR's merge will auto-transition the ticket regardless of keyword, the practical choices are: (a) split into separate tickets per PR (cleanest lifecycle), or (b) manually flip the ticket's status back to In Progress after each intermediate PR's merge until the final one lands.

**Validation history.** The convention has been validated on AIS-8 (PR #4, May 7), AIS-9 (PR #5, May 8), AIS-10 (PR #6, May 8) — all auto-transitioned to Live on merge using `Closes AIS-X`. AIS-11 (PR #7, May 18) used `Part of AIS-11` in the description and also auto-transitioned to Live on merge, confirming that the auto-transition is not keyword-gated. An earlier hypothesis (recorded in v3.7 of the build checklist) that AIS-7's failure to auto-transition was caused by its `Part of AIS-7` keyword has been retired — AIS-7 likely failed for a different reason (the Linear ↔ GitHub integration was being set up that week and may not have been fully wired). AIS-10's pre-merge framing of `Part of AIS-10 (1/N batches)` was caught by the Fitzrovia approver-review skill and corrected to `Closes AIS-10` before merge — the framing remains a should-fix on semantic grounds (single-PR tickets should use `Closes`), but the corrective effect on auto-transition timing was incidental, not necessary.

### The PR template

Every tool repo includes `.github/PULL_REQUEST_TEMPLATE.md`, which auto-populates new PRs with a standard template. The template mirrors `04-standards/pre-pr-checklist.md` — the canonical pre-PR checklist that enforces `/review` and `/security-review` usage and Fitzrovia-specific items.

The Tool Starter ships with this template pre-installed, so every new tool inherits it from day one. For the first three foundation tools (built by hand before the Tool Starter exists), the template is added manually as part of the initial scaffolding.

### Writing the PR description

Most PRs need just 2-3 sentences in the description: what changed, why. Link the Linear ticket with `Closes AIS-XX`. The reviewer reads the diff for the rest. Don't write a novel for a one-line bug fix.

Some PRs warrant more structure. The signal is that a reviewer reading just the diff would otherwise be left wondering "why?" Examples of when a longer description earns its space:

- **Foundation or scaffolding PRs** that set patterns for future work
- **PRs with multiple notable adjustments** that diverged from the original plan, where a reviewer would otherwise wonder "why this choice?"
- **PRs where `/review` or `/security-review` surfaced findings that need visible triage** — list which were fixed, which deferred, with reasoning, so the reviewer doesn't re-litigate them
- **PRs that pre-empt likely CodeRabbit complaints** (e.g., "yes, the empty placeholder folders are intentional per the batch plan")

For these, structured headers help. Use what fits — not all of these every time:

- `## Summary` — what changed, why, broken into batches if multiple commits
- `## Notable adjustments` — real edge cases decided in the moment, with rationale
- `## What this PR does NOT include` — useful for scoped scaffolding work
- `## /review findings — handled` — triage of which findings were fixed, deferred, or skipped, with reasoning
- `## /security-review` — what was checked, what was found
- `## Tests` — what's tested, or why no tests are present
- `## Verification` — how you verified locally

The tone is factual and terse — no marketing language ("powerful", "seamless"), no celebratory bullet points. The reviewer is often non-technical and reads CodeRabbit's summary first; the description is for context they can't get from the diff alone.

For drafting these, the `pr-description` skill at `02-skills/pr-description/` provides a Claude.ai prompt that ingests the diff, the Linear ticket, and the `/review`/`/security-review` output, then produces a description sized appropriately to the PR (short for routine, structured for unusual).

PR #2 (AIS-6 monorepo scaffolding) is a reference example of the structured form, since it had multiple notable adjustments and several `/review` findings to triage.

### Approval rules

The approval rules are defined per path in `04-standards/codebase-organization.md` ("Who can change what"). They differ depending on whether we're in the foundation phase or the steady state.

**Why two phases.** Right now, only Karim and Kenny exist as builders/reviewers. Karim cannot approve his own PRs (per the no-self-approval rule), so Kenny is the only available reviewer for everything Karim writes. Karim is going to be the most prolific builder for the first 1–2 months while building the foundation tools, and Kenny has a 9–5 IT role with other responsibilities. Without a planned change, this becomes a real bottleneck.

The fix: once Joseph is onboarded and has demonstrated competent review judgement on a few of his own PRs (typically 2–3 months in), he becomes a third approver for non-IT-critical paths. This is structural, not a favour — it solves a throughput problem.

**Foundation phase (now until Joseph is onboarded and review-capable):**

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

In both phases: the PR author cannot approve their own PR. When Karim is the author, the approver is Kenny (foundation phase) or Kenny/Joseph (steady state). When Kenny is the author, Karim approves. When Joseph is the author, Karim or Kenny approves.

The IT-critical packages (`auth/`, `supabase-client/`, `activity-log/`) always require both Karim and Kenny — Joseph never approves these even in the steady state. Those carry IT-substantive risk where Kenny's review is the point, not throughput.

### Working with Kenny's bandwidth in the foundation phase

The foundation phase realistically means Karim's PRs wait on Kenny. To keep that from grinding the studio to a halt:

- **Kenny doesn't read code line-by-line.** He reviews CodeRabbit's plain-English summary, checks the Vercel preview link, and runs the `approver-review` skill in Claude.ai. Same workflow we already designed. This is fast — typically under 10 minutes per PR.
- **Batch PRs when possible.** Instead of asking Kenny to context-switch three separate times in a day, push three branches together and ask once. He blocks 30 minutes, reviews all three.
- **Critical-path vs non-critical.** If a PR is blocking a foundation-tool launch, that's urgent. If it's a refactor or polish, it can wait until Kenny's next review session.
- **Initial PRs warrant more attention.** The very first PRs (initial monorepo scaffolding, first foundation tool) are setting patterns. Kenny should look more carefully on those. After patterns are established, his review can be faster.

### When Joseph becomes review-capable

The transition from foundation phase to steady state is a deliberate decision, not automatic. Joseph becomes a third approver for non-IT-critical paths when:

1. He has shipped 2–3 of his own PRs through Karim/Kenny review, and the review process has been smooth (no major conceptual issues caught late).
2. He has demonstrated he can read CodeRabbit summaries critically, run the `approver-review` skill, and form a defensible go/no-go opinion. Not perfectly — competently.
3. Karim and Kenny both agree he's ready. This is a single decision, documented in the decision log when made.

Until then, he's a builder, not a reviewer. The CODEOWNERS file is updated when the transition happens.

### CODEOWNERS

The `.github/CODEOWNERS` file in the monorepo enforces approval routing automatically. When a PR is opened, GitHub reads CODEOWNERS, identifies which paths the PR touches, and auto-requests review from the people listed.

**Foundation phase configuration:**

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

**Steady-state configuration (after Joseph is review-capable):**

```
# Default reviewers for the whole repo
*                                @kmourad-fitzrovia @KMarcanoFITZ @joseph

# Apps - any of the three can approve
/apps/                           @kmourad-fitzrovia @KMarcanoFITZ @joseph

# Most packages - any of the three can approve
/packages/shared-entities/       @kmourad-fitzrovia @KMarcanoFITZ @joseph
/packages/design-system/         @kmourad-fitzrovia @KMarcanoFITZ @joseph

# IT-critical packages - both Karim and Kenny must approve (Joseph not eligible)
/packages/auth/                  @kmourad-fitzrovia @KMarcanoFITZ
/packages/supabase-client/       @kmourad-fitzrovia @KMarcanoFITZ
/packages/activity-log/          @kmourad-fitzrovia @KMarcanoFITZ
```

The dual-approval requirement for IT-critical packages is enforced by a combination of CODEOWNERS routing and CodeRabbit's review gating, not by GitHub branch protection. GitHub's per-path approval count rule is gated behind the Enterprise plan; Fitzrovia is on the Team plan. CODEOWNERS auto-requests review from both Karim and Kenny when a PR touches an IT-critical path; CodeRabbit is configured to withhold its own approval (and therefore block merge, because CodeRabbit's check is required) until both have approved. The detailed mechanism is described in the "Branch protection and the dual-approval mechanism" section below.

The transition from foundation to steady state is a single PR that updates the CODEOWNERS file. That PR itself follows the approval rules — Karim opens it, Kenny approves it, it merges, and from then on Joseph is in the rotation.

---

## Branch protection and the dual-approval mechanism

> **Plain English:** GitHub has a feature called "branch protection" that locks down `main` so nobody — including Karim and Kenny — can push directly to it or skip the review process. Even if you tried to bypass the rules, GitHub physically prevents it. This is the mechanical enforcement layer behind everything in this document.

`main` is configured with these protections:

1. **Require a pull request before merging.** No direct pushes, period.
2. **Require approvals from CODEOWNERS.** A PR cannot merge until the right reviewers (per CODEOWNERS) have approved.
3. **Require status checks to pass.** CodeRabbit must complete, the build must succeed, no failing tests.
4. **Require branches to be up to date with `main`.** PRs that have fallen behind must rebase or merge `main` in before they can be merged.
5. **Require conversation resolution.** All review comments must be marked resolved before merge.
6. **Restrict who can dismiss reviews.** Only Karim and Kenny can dismiss a stale review.
7. **No force-pushes to `main`.** Force-pushing rewrites history; we don't allow it on `main`.
8. **No deletions of `main`.** Should be obvious.
9. **Apply rules to administrators.** Karim and Kenny can't bypass these rules either, in steady state. (A foundation-phase exception puts Karim on the bypass list through foundation infrastructure and the first real tool ship; documented in `! handbook configuration list/handbook-configuration-list.md` with a sunset trigger of "after the intake tool ships to production.")

These settings are configured once during repo setup and rarely changed. When changes are made, they're documented in this file.

### Dual-approval on IT-critical packages — how it's actually enforced

The dual-approval rule for `packages/auth/`, `packages/supabase-client/`, and `packages/activity-log/` is enforced by a two-layer mechanism, not by GitHub branch protection.

**Layer 1 — CODEOWNERS routing.** When a PR touches any of the three IT-critical paths, CODEOWNERS auto-requests review from both Karim and Kenny. They both see the request; they both know the rule; both review. This is the primary enforcement mechanism.

**Layer 2 — CodeRabbit gating.** CodeRabbit reviews every PR on `fitzrovia-tools` and posts a status check; that check became a required check on the `main protection` ruleset on May 5, 2026, after CodeRabbit's first review (PR #1) registered its check name with GitHub. As of May 5, no PR can merge to `main` unless CodeRabbit's check passes — this is now real, not aspirational.

The path-specific gating layer — CodeRabbit recognizing PRs touching IT-critical paths and withholding its own approval until both Karim and Kenny have approved on GitHub — is configured separately in CodeRabbit's path-instructions and pre-merge-check settings. That configuration is pending and tracked as a 🟠 task in `! handbook configuration list/handbook-configuration-list.md`. Until it's in place, the dual-approval rule on IT-critical paths is enforced by Layer 1 (CODEOWNERS routing) plus convention — Karim and Kenny know the rule, both review IT-critical PRs as a matter of practice. The mechanical gate (CodeRabbit holds back approval until two human approvals exist) gets added before any IT-critical PR is opened. Realistically, no IT-critical PRs are expected during the foundation-phase admin bypass exception (Karim is scaffolding configs, not modifying `packages/auth/`), so the gap is small and time-bound.

**Why it isn't enforced by GitHub directly.** GitHub's per-path "Required number of approvals" rule (which would let us say "PRs touching `packages/auth/` need 2 approvals") is gated behind the Enterprise plan. Fitzrovia is on the Team plan, where this rule is unavailable. The path-restriction field in branch rulesets is similarly Enterprise-only. Upgrading to Enterprise solely for this rule is not justified at Fitzrovia's scale; the CodeRabbit-based mechanism above achieves the same outcome.

**Why this is acceptable.** The two-layer mechanism produces the same effective rule — a PR touching IT-critical packages cannot merge without both Karim and Kenny approving. The mechanism is slightly different from native branch protection but the outcome is identical. The honest framing: GitHub's branch protection enforces "1 approval, no force-pushes, signed commits, etc." across the whole branch; CodeRabbit + CODEOWNERS enforces "2 approvals on IT-critical paths" specifically. Together, they cover the full rule set.

**Configuration documentation.** The CodeRabbit dual-approval gating logic (path-specific gating, Layer 2 Part B) is configured per `06-operations/coderabbit-setup.md` and tracked in `! handbook configuration list/handbook-configuration-list.md` as a 🟠 task. The CodeRabbit-as-required-status-check requirement (Layer 2 Part A, the foundation that path-specific gating builds on) is in place as of May 5, 2026.

---

## Concurrent work — multiple builders, no overwriting

> **Plain English:** When two people are working on different things at the same time, Git handles it automatically — each person's branch is independent. Problems only happen when two people edit the same file. Then Git pauses and asks the second person to resolve the differences. For non-technical builders, this sounds scary; in practice, Claude Code handles it.

The default case (no overlap):

Joseph is working on `apps/leasing-pipeline/` on his branch. Karim is working on `apps/intake-portal/` on his branch. Their work doesn't touch the same files. Both PRs can be reviewed and merged in any order without conflict. Git just adds both sets of changes to `main`.

The conflict case (real overlap):

Joseph and Karim both edit `packages/shared-entities/building/types.ts` because they each need a new field on Building. Joseph's PR merges first. Now Karim's PR is "behind" — when Karim tries to merge, GitHub flags a conflict because the file has changed in `main` since he branched off.

The resolution workflow for non-technical builders:

1. Pull the latest `main` into your branch (`git pull origin main` or via Claude Code's interface).
2. Git marks the conflicted files. The file shows both versions side-by-side with conflict markers.
3. Open Claude Code in the repo. Tell Claude: "I have a merge conflict in `packages/shared-entities/building/types.ts`. Help me resolve it."
4. Claude reads both versions, explains in plain English what each side is trying to do, and proposes a merged version that includes both intentions.
5. Review the proposal. Accept it or ask Claude to retry with adjustments.
6. Mark the conflict resolved, commit, and push.

This makes Git conflicts manageable for builders who don't deeply understand Git internals. The builder doesn't need to know the mechanics — Claude does. The builder needs to know *what they intended* and *what to verify in the result*.

---

## Testing before merge

> **Plain English:** Before any tool reaches `hub.fitzrovia.ca`, it gets tested in a working environment that's separate from production. GitHub and Vercel handle most of this automatically — every branch gets its own temporary live URL where you can click through the tool, try it with real data, and have the requester confirm it works. Nothing reaches production without passing through this preview environment.

There are three layers of testing every tool gets:

### 1. Local development

The builder runs the tool on their own laptop while building. The Next.js dev server runs at `localhost:3000`. The builder clicks through it, tries inputs, watches for errors in the browser console and terminal. This is informal and fast — most bugs get caught here, before code is even pushed.

Local development requires the builder's `.env.local` file to be configured with real values for the development environment. See `06-operations/development-setup.md` for how that file is populated.

### 2. Vercel preview deployment

When you push a branch and open a PR, Vercel automatically builds and deploys that branch to a temporary URL — something like `intake-portal-ais-XX-init-intake-portal.vercel.app`. This URL:

- Is fully functional, not a static preview — every interaction works the same as production
- Is connected to the development Supabase instance (or staging, depending on the tool)
- Is accessible via SSO, so only @fitzrovia.ca accounts can reach it
- Updates automatically every time you push a new commit to the branch

This is the real testing environment. The Vercel preview link is what gets attached to the PR for review. The roadmap (Step 10) and the `approver-review` skill both reference this — when Karim or Kenny review a PR, they click the preview link and test the tool in their browser as part of approval. They're not just reading the code; they're using the tool.

The Vercel preview is also what the requester tests. When Joseph builds a tool that someone in Finance requested, he forwards the preview link to that person via Microsoft Teams: "Does this do what you needed?" The requester clicks the link, uses the tool, and replies with confirmation or feedback. That confirmation gets attached to the Linear ticket as part of the Tier 2 launch checklist.

### 3. Production

When the PR merges to `main`, Vercel automatically deploys to production within ~60 seconds. The production tool is live at `hub.fitzrovia.ca/<tool-name>` and accessible to whichever Microsoft 365 group has been granted access (per `04-standards/access-control.md`).

The merge *is* the deployment. There is no separate release step.

### Automated testing

Automated tests (unit tests, integration tests, end-to-end tests) are valuable but are not the primary defence at our scale. The primary defence is `/review` plus `/security-review` plus CodeRabbit plus the Vercel preview plus human eyes — five layers, each catching different problems.

For now, the testing baseline is "the tool has been clicked through on the Vercel preview by the builder, the approver, and the requester." Detailed standards for automated testing live in `04-standards/testing-baseline.md` (currently 🟡 Medium priority — to be drafted as practices mature).

---

## Reverting and rollback

> **Plain English:** Sometimes a change ships and turns out to be broken. We have three ways to undo it, in increasing order of severity.

### Vercel rollback (fastest)

Vercel keeps every previous deployment. To roll back a tool to its previous working version: open the Vercel dashboard for the tool, find the last good deployment, click "Promote to Production." Live within 60 seconds. The code in the repo is unchanged; only the deployed version reverts.

This is the right move when a change broke something in production and you need it fixed *now*. The underlying code stays in `main` and gets fixed properly via a follow-up PR.

### Revert PR (cleanest)

If a merged PR turns out to be wrong and you want to remove it from the codebase entirely, GitHub supports "Revert this pull request" on a merged PR. This creates a new PR that undoes the changes. Review and merge the revert PR through the normal process.

This is the right move when a merge made it into `main` but shouldn't have, and you want the codebase to reflect that.

### Manual rollback (rare)

For everything else — a Git history that needs surgery, a corrupted state, a security issue requiring forensics — Karim and Kenny coordinate. This is rare enough that it doesn't need a documented process; if you find yourself needing this, you're already in conversation with Karim and Kenny.

---

## What this enables, what this prevents

> **Plain English:** A short list of what we get from these rules, and what kinds of mistakes they make impossible.

What this enables:

- A new builder can contribute on day one without breaking anyone else's work.
- Every change has a reviewer, an approver, and a permanent record.
- Production is always one click away from rollback.
- The merge to `main` is the deployment — no separate release coordination.
- CodeRabbit and the pre-PR checklist catch most issues before human review.
- Conflicts get resolved with Claude's help, not by giving up.

What this prevents:

- Anyone (including Karim) accidentally pushing untested code straight to production.
- PRs merging without an approver who isn't the author.
- Stale, multi-week branches that drift far from `main` and create huge conflicts.
- Code reaching `main` without `/review`, `/security-review`, and CodeRabbit having run.
- IT-critical infrastructure (`auth/`, `supabase-client/`, `activity-log/`) being changed by one person alone.
- The "I forgot to make a PR" excuse — branch protection makes it physically impossible.

---

## What's intentionally not in this document

This document is about branching and PRs, not about:

- **The folder structure of the codebase** — see `04-standards/codebase-organization.md`
- **What every builder runs before opening a PR** — see `04-standards/pre-pr-checklist.md`
- **How to set up your laptop to push and pull from this repo** — see `06-operations/development-setup.md`
- **The full review workflow including CodeRabbit and the approver-review skill** — see `06-operations/pr-review-process.md`
- **What every tool must do for security** — see `04-standards/security-baseline.md`

If you're looking for something not covered here, it's almost certainly in one of those documents.
