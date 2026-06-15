# CodeRabbit setup

**Path:** `06-operations/coderabbit-setup.md`

**Last updated:** May 5, 2026
**Owner:** Karim Mourad

---

## What this document is

A record of how CodeRabbit was configured for `fitzrovia-residential` at programme inception (May 4, 2026), and the reasoning behind each setting. Useful for Kenny's review, useful for future-Karim when something needs to change and the rationale isn't obvious.

This is not a step-by-step tutorial — CodeRabbit's own onboarding wizard does that job. It's a decisions-and-state document.

---

## Why CodeRabbit, and how it fits the review model

Per `04-standards/branching-and-prs.md` and the layered review model captured in the build checklist v3.x, every PR at Fitzrovia goes through three review layers before merge:

1. **Builder self-review** — runs `/review` and `/security-review` (Anthropic Claude Code built-ins) before opening the PR; walks the `04-standards/pre-pr-checklist.md`.
2. **CodeRabbit auto-review** — happens automatically when the PR is opened; comments on issues but never approves the PR.
3. **Human approver** — Karim or Kenny in foundation phase, plus Joseph in steady state for `apps/*` and non-IT-critical packages. Runs the Fitzrovia `approver-review` skill in Claude Teams over a plain-English summary of the PR rather than reading code line-by-line.

CodeRabbit's role is the middle layer: catch the obvious issues before a human looks. It is *not* a replacement for human judgment, and it is configured (see "Behavior" section below) so that it cannot accidentally become one.

The choice of CodeRabbit specifically rather than alternatives:
- It integrates natively with GitHub PRs and posts comments inline, which non-technical builders can read without context-switching.
- It supports a "Chill" review profile that reduces nitpicking — important because we don't want non-technical builders trained to skip AI feedback as noise.
- It's at a price point ($30/seat/mo on monthly billing) that scales reasonably.

---

## Plan and billing

- **Plan**: Pro, $30 USD per active user per month, billed monthly
- **Trial**: Pro Plus 14-day free trial active until **May 18, 2026** — auto-converts to Pro on May 19 unless canceled or upgraded
- **Calendar reminder set for May 16** to decide convert/cancel before auto-conversion
- **Active users today**: 1 (Karim). Will scale to 2-3 as Kenny and Joseph become active reviewers
- **Payment**: Fitzrovia corporate Visa ending 8456 (same card as the other four platforms)

**Why monthly billing instead of annual ($24/seat/mo)**: Annual costs $72/year less per seat but commits us before we have any real usage data on whether CodeRabbit's review quality matches what we need. The "monthly preserves optionality" principle from the broader programme applies: small recurring premium is worth the ability to walk away at one month's notice if it doesn't work out.

**What's available during trial that goes away on conversion**: Pro Plus features visible under Settings → Reviews → Finishing touches (Docstrings auto-generation, Unit test generation) and Settings → Pre-merge checks → Custom checks. Both are kept enabled during the trial as an experiment; if they prove valuable enough by May 16, that informs the convert-to-Pro vs. upgrade-to-Pro-Plus decision. Most likely outcome based on programme phase: not enough real PRs by May 16 to evaluate them properly, features quietly disable on conversion, no upgrade triggered.

---

## Scope and access

CodeRabbit's GitHub App is installed on the **`fitzrovia-residential` organization**, not on Karim's personal `kmourad-fitzrovia` GitHub account.

Worth flagging because the install flow defaulted to the personal account during signup and had to be explicitly switched to the org. Future-builder following CodeRabbit's onboarding should expect the same defaulting and watch for it.

**Repository scope**: Originally configured as "All repositories" during the May 4 org-level setup. **Important caveat — this didn't behave as expected.** When `fitzrovia-tools` was created later on May 4, it did *not* auto-appear in CodeRabbit's repository list. The install scope had to be re-saved through the "Add Repositories" flow (CodeRabbit redirects to GitHub, you re-confirm "All repositories," sudo-mode 2FA, return) before `fitzrovia-tools` showed up. The exact root cause wasn't determined — possibly the original install was actually scoped to "Only select repositories" despite the intent, or CodeRabbit's view of the GitHub org had stale state. Either way, **don't assume future repo creations will auto-appear in CodeRabbit**. Verify after each new repo by visiting CodeRabbit's Repositories page; if the new repo isn't listed, click Sync Repositories first, then Add Repositories if Sync doesn't help.

**Members**: All members of `fitzrovia-residential` get CodeRabbit access automatically by virtue of org membership. Today that's Karim and Kenny (Owner, pending acceptance). When a member opens or reviews a PR, they're a CodeRabbit "active user" for that month and contribute to the seat count.

---

## Reviews configuration

### Profile: Chill

Set under Settings → Reviews → Behavior → Profile.

Per the broader programme philosophy, builders are non-technical and rely on CodeRabbit comments for guidance rather than dismissing them as noise. The default "Assertive" profile is more aggressive (more nitpicks, more style suggestions, more flagged-for-the-sake-of-flagging) which trains the very habit we don't want — builders skipping AI feedback.

"Chill" focuses on substantive issues: actual bugs, security concerns, real correctness problems. False-positive rate is lower, signal-to-noise is higher.

If Chill turns out to be *too* lax (e.g., real bugs slip past), the right escalation is Assertive, not custom rules. Re-evaluate after several weeks of real PRs.

### Walkthrough features: all kept on

Under Settings → Reviews → Walkthrough, all seven features are enabled:
- Collapse walkthrough (default ON, kept ON — wraps walkthroughs in collapsible markdown)
- Changed files summary
- Sequence diagrams
- Estimate code review effort
- Related issues
- Related PRs
- Suggested labels

> **Watchlist — likely candidates for revisiting after first real PRs:**
>
> Three of these may turn out to be noise rather than signal: **Sequence diagrams** (auto-generated diagrams from code changes are often low-quality and reviewers learn to skip them), **Related issues / Related PRs** (returns nothing or misleading results in a brand-new monorepo with no PR history), and **Suggested labels** (less useful at Fitzrovia since Linear handles project tracking, not GitHub labels).
>
> Decision today: keep all on, observe what happens on the first 3-5 PRs, then disable any that consistently produce noise. The Behavior page is the single place to flip them off.

### Summary configuration

Under Settings → Reviews → Summary:
- High level summary in PR description: ON
- Custom summary instructions: empty (default behavior is good enough)
- High level summary in walkthrough comment: OFF (would duplicate the description summary)

### Mode: Concise

Visible at the bottom of every Reviews settings page. Concise > Verbose given that non-technical builders need clear takeaways, not exhaustive analysis.

### Path instructions, Path filters, Labeling instructions: empty

All under Settings → Reviews → Behavior. Empty for now because:
- Path instructions (per-folder review guidance) — premature without real PRs to learn from
- Path filters (glob patterns to include/exclude from review) — will be set when the monorepo exists; likely exclude `node_modules/`, build output, generated types
- Labeling instructions — we don't use GitHub labels heavily

All three are good candidates to revisit during foundation phase once `fitzrovia-tools` has a real shape.

---

## Behavior — critical safety toggles

Two settings under Settings → Reviews → Behavior that are deliberately **OFF**:

### Request changes workflow: OFF

If enabled, CodeRabbit auto-approves the PR once its own comments are resolved and pre-merge checks pass.

This is wrong for our model. Per the layered review, **a human approver must review and approve every PR**. CodeRabbit auto-approving short-circuits that. Keeping this OFF preserves the rule: CodeRabbit comments, humans approve.

### Auto assign reviewers: OFF

If enabled, CodeRabbit picks reviewers based on its own judgment.

We have explicit rules for reviewer assignment via `.github/CODEOWNERS` (which gets created during foundation phase). Letting CodeRabbit override CODEOWNERS would create inconsistent assignment. CODEOWNERS handles it; CodeRabbit doesn't.

---

## Pre-merge checks

Under Settings → Pre-merge checks. CodeRabbit ships four built-in checks; we keep them all at "Warning" rather than "Error" — they post comments but don't block merge.

| Check | Status | Rationale |
| --- | --- | --- |
| Custom pre-merge checks | None defined | Premature without real workflows. Revisit during foundation phase. |
| Docstring coverage | Warning, threshold 80% | Default left as-is. **Watchlist:** May produce a "below threshold" warning on most early PRs because non-technical builders + Claude Code don't always generate docstrings. If warnings become noise everyone learns to skip, lower the threshold or disable. |
| Title check | Warning, no requirements | Empty requirements means it's a no-op. **Watchlist:** Either define title requirements (conventional commits format, etc.) or disable. Currently doing nothing. |
| Description check | Warning | Useful — nudges non-technical builders to write clearer PR descriptions, which is critical for human approvers reading plain-English summaries rather than code. |
| Linked issue assessment | Warning | Useful when Linear is connected (see "Pending integrations" below). Nudges builders to link Linear tickets to PRs and write descriptions that actually address them. **Currently checking against nothing** because Linear isn't connected yet. |

The honest read: at this exact moment (May 4, no monorepo yet, no Linear integration yet), three of the four checks are doing nothing useful. Worth scanning these again once PRs are flowing and Linear is connected.

---

## Finishing touches (Pro Plus trial features)

Under Settings → Reviews → Finishing touches. Both features are Pro Plus-tier and **disable when the trial converts to Pro on May 19** unless we upgrade.

- **Docstrings auto-generation**: ON during trial. Builders can trigger it via PR description checkbox or `@coderabbitai generate docstrings` comment.
- **Unit test generation**: ON during trial. Generates test scaffolding for changes in PRs.

Both kept on as a free experiment during the trial. They'll quietly disable post-conversion unless they've demonstrably saved time during the trial. Most likely we won't have used them enough by May 16 to evaluate; that's fine.

---

## Statuses, Fun, and the rest

### Statuses (Settings → Statuses)

- Auto apply labels: OFF (we don't use GitHub labels heavily)
- Auto title instructions: empty (default title generation is fine)

### Fun (Settings → Fun)

All fun features disabled:
- Tone instructions: empty
- Poem in walkthrough: OFF
- "In progress fortune" message: OFF
- ASCII/emoji art: OFF

PRs at Fitzrovia are poetry-free.

---

## Pending integrations

These are integrations CodeRabbit offers under "Optimize Workflow" in the onboarding wizard that we deferred today.

### Linear integration — connected May 4, 2026

Source: CodeRabbit Settings → Integrations → **Issue Tracking** → Linear.

**Important note on the path:** CodeRabbit exposes Linear connection in two places — under **MCP Servers** (general AI context endpoints) and under **Issue Tracking** (purpose-built integration). The Issue Tracking path is the correct one for the workflow described in this document; the MCP path would create a parallel, duplicate connection with less functionality. Initially navigated to the MCP path during setup; corrected mid-stream once the dedicated Issue Tracking integration was located.

**What the integration provides:**
- Linear ticket context (description, comments, status) is available to CodeRabbit when reviewing a PR
- The "Linked issue assessment" pre-merge check (set to Warning) is now meaningful — CodeRabbit warns on PRs that don't link a Linear ticket properly
- Two CodeRabbit features become available: **Knowledge Base** (Linear as a context source for reviews) and **Coding Plan** (CodeRabbit produces implementation plans from Linear tickets via `@coderabbitai plan` comment)

**Configuration applied:**
- **Linear integration toggle**: ON
- **Linear team keys**: `AIS` (restricts CodeRabbit's Linear context to the AI Studio team specifically; protects against scope creep if other Linear teams are added later)
- **Linear (knowledge source)**: Auto (enabled for private repos, which `fitzrovia-tools` is)
- All other Knowledge Base settings left at defaults (Web search ON, Code guidelines enabled with empty file patterns relying on CodeRabbit's auto-detection of well-known guideline files including `**/CLAUDE.md`. Per CodeRabbit's docs, no UI configuration is required for this — the org-level Reviews settings (Summary / Walkthrough / Behavior) confirm there's no Knowledge Base UI surface, and `.coderabbit.yaml` at the repo root is the only override mechanism if defaults need extending. Auto-detection of `CLAUDE.md` (now on `fitzrovia-tools/main` since May 5, 2026 via PR #1) is the documented default but unverified at Fitzrovia's specific setup — verification deferred to next PR observation, tracked in the configuration list. Learnings/Issues/PRs/MCP all on Auto)

**Coding Plan feature**: deferred for evaluation. Empty by default. Worth trying once during the first real PR to see if it fits Fitzrovia's "non-technical operator drives Claude Code" pattern — could either complement Claude Code's own Plan agent or duplicate it. Don't decide today; evaluate in real workflow.

**Why this matters for the dual-approval mechanism:** The CodeRabbit-based dual-approval gating on IT-critical packages (described in `04-standards/branching-and-prs.md`) depends on CodeRabbit being able to recognize PRs touching IT-critical paths. The Linear integration doesn't directly enable that, but it's part of the broader "CodeRabbit understands the work in context" foundation that path-specific gating builds on.

### MCP integrations — skipped entirely

Context7, PostHog, and a Linear-via-MCP option were also offered. All skipped:
- Context7 (library documentation context for reviews) — incremental benefit, not worth the integration overhead
- PostHog (product analytics) — not in use at Fitzrovia
- Linear-via-MCP — would duplicate the direct Linear integration above

Not on the roadmap to add. If review quality turns out to need richer context later, revisit.

### Jira and Circle CI — not applicable

Not used at Fitzrovia.

---

## Watchlist (consolidated)

Things deliberately left at default today that may want adjustment after 3-5 real PRs are reviewed by CodeRabbit:

1. **Walkthrough features**: Sequence diagrams, Related issues, Related PRs, Suggested labels — likely noise rather than signal. Disable any that consistently produce no-value output.
2. **Docstring coverage threshold (80%)**: Likely too high for non-technical builders + AI-generated code. Lower the threshold or disable if warnings become noise.
3. **Title check**: Currently checking against nothing. Either define title requirements or disable.
4. **Path filters**: Empty today; needed once monorepo exists to exclude `node_modules/`, build output, generated types.
5. **Path instructions**: Empty today; revisit once different folders need different review guidance (e.g., stricter on `apps/finance/` than on `apps/dashboard/`).
6. **Pro Plus features (Docstrings, Unit tests)**: Will disable May 19 unless we've found real value during the trial.

The discipline: don't pre-optimize. Use the defaults, observe behavior on real PRs, then prune what's clearly noise.

---

## What's not configured today (intentionally)

- **`fitzrovia-tools` repository was added later on May 4** after the initial org-level setup. The auto-pickup mechanism described in the original v1.0.0 documentation didn't work as expected; the repo had to be added via "Add Repositories" flow despite the intent of "All repositories" scope. See the corrected note in the "Scope and access" section above.
- **No per-repo configuration**: needs the monorepo to exist first. Some settings (e.g., specific path filters per app) are best done at repo level.
- **No `.coderabbit.yaml` config file**: this is the in-repo config file that lets PRs change CodeRabbit behavior per-branch. Not relevant until the monorepo exists.
- **Linear integration**: deferred to Wednesday (see Pending integrations above).
- **Pro Plus conversion decision**: deferred to May 16 calendar reminder.
