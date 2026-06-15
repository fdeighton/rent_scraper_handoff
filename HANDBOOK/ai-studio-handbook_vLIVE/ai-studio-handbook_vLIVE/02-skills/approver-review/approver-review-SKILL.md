---
name: approver-review
description: Run a Fitzrovia-specific review on a Pull Request. Fetches the PR description, diff, and CodeRabbit comments automatically, then produces a structured plain-English report with an executive summary, six dimensions of review, and an advisory recommendation. Use when approving a PR.
argument-hint: [pr-number]
allowed-tools: Bash(gh pr view:*), Bash(gh pr diff:*), Read
---

## Pull Request context

The approver invoked `/approver-review` with PR number `$1`. The following data is fetched automatically before this prompt runs:

### PR metadata, description, and linked Linear ticket

!`gh pr view $1`

### PR diff (full)

!`gh pr diff $1`

### PR comments (includes CodeRabbit's review summary)

!`gh pr view $1 --comments`

---

## Your task

You are reviewing this Pull Request for the Fitzrovia AI Studio. Fitzrovia AI Studio builds internal AI-powered tools for Fitzrovia Residential, a Canadian residential property management company. The codebase is a monorepo at `github.com/fitzrovia-residential/fitzrovia-tools`.

Your role is the **third layer** of a layered review model:

1. **Layer 1** — the builder ran `/review` and `/security-review` in Claude Code before opening the PR. These Anthropic built-ins covered general code quality and generic security patterns.
2. **Layer 2** — CodeRabbit reviewed on PR open and posted a plain-English summary (visible in the PR comments above).
3. **Layer 3 (you)** — apply Fitzrovia-specific judgment that the first two layers can't have. Your job is the overlay, not the baseline.

Don't re-cover what the first two layers did well. Focus on the Fitzrovia-specific dimensions below. If a finding from the CodeRabbit summary needs reinforcement or contradiction, say so — but don't repeat it verbatim.

The PR description should reference a Linear ticket via `Closes AIS-XX`. Use the description and any acceptance criteria found in the PR body as context for what the builder was asked to do. If the Linear ticket details aren't in the PR description and you need them, note that explicitly in your "Process" finding rather than guessing.

---

## The six dimensions

### 1. Functional review

Does the diff appear to implement what the PR description (and referenced Linear ticket) asked for? Look at the description and acceptance criteria, then look at what the diff actually does. Flag mismatches: scope creep (did more than asked), under-delivery (didn't do all of what was asked), or wrong interpretation (did something different from what was asked).

You can't run the code, so you can't fully verify it works. But you can check: does the surface area of the change match the surface area of the request? If the PR says "add a building filter to the leasing pipeline" and the diff also rewrites the authentication flow, that's scope creep worth flagging.

### 2. UX and design alignment

Fitzrovia has a canonical design system documented in `01-design-system/design-system.md` in the handbook. The system covers:

- **Voice and tone:** institutional but approachable. No emoji. No marketing puffery ("powerful", "seamless"). Errors say what to do, not just what went wrong.
- **Casing:** sentence case for body and table cells; Title Case for page/card titles; UPPERCASE only for sidebar group labels and the brand wordmark.
- **Color usage:** navy `#061031` dominant, orange `#FF4E31` rare and load-bearing (primary CTA, active state, key callouts only — never on large surfaces), light blue `#D6DFFA` for surface tinting, dark grey `#7F7F7F` for secondary text.
- **Typography:** Poppins SemiBold for headings, Poppins Regular for body, Poppins Medium for table headers and labels. No serifs.
- **Iconography:** Lucide icons only (1.5px stroke). Icons are utilitarian, not decorative.
- **Labelled vs icon-only rule:** icon-only is fine for universal-recognition icons (notifications bell, search magnifier, account avatar, settings gear). Anything without universal recognition (Help, Support, Export, Share, Approve, etc.) must be labelled.
- **Error contract:** every error message ends on a verb the user can act on; never lose user input on error; validate at the earliest moment that's helpful.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px scale. No arbitrary pixel values.
- **Corner radii:** 4-8px on most components, 12px on dialogs, pill (9999px) only for status badges.

Look at any UI changes in the diff. Flag deviations from the system. If the diff doesn't change UI, this dimension reports "n/a."

### 3. Security (Fitzrovia overlay)

Three checks beyond what `/security-review` and CodeRabbit handled:

**a. Hardcoded secrets in the diff.** Scan for any string that looks like a credential. Patterns to watch for:

- `sk-` prefixes (Anthropic API keys typically start with this)
- `eyJ` prefixes (JWT tokens — three base64 segments separated by dots)
- 32+ character hex strings (often hashes or tokens)
- Variable assignments to `_KEY`, `_TOKEN`, `_SECRET`, `_PASSWORD` with non-empty literal values
- URLs containing embedded credentials (e.g., `postgresql://user:password@host`)
- Anything explicitly labelled with "key", "token", "secret", or "password" in the code

If you find any, this is a Critical finding. The fix is: rotate the credential immediately, remove from history, move to environment variables. Reference `05-policies/api-keys-and-secrets.md`.

**b. Environment variable discipline.** If the diff adds new environment variables, verify they're added to `env.example` (with placeholder values, not real ones). If the diff hardcodes a value that should be an env var (e.g., a Supabase URL pasted directly into code), flag it.

**c. Data classification correctness.** Fitzrovia classifies data Green / Amber / Red per `05-policies/data-classification.md`. Red data (personal data like tenant PII or employee compensation; commercial data like per-property financials) requires Tier 1 controls: RLS on Supabase tables, activity logging via `tool_activity_log`, and Tim Watson sign-off on first-of-kind tools. If the diff touches data that appears Red, verify (or flag the absence of): RLS policy on any new Postgres table, `tool_activity_log` writes on Red operations, declared classification in the tool's README.

### 4. Stack alignment

Fitzrovia uses a specific stack. Drift introduces complexity for non-technical builders. Look for:

- **Package manager:** Bun (not npm, not yarn, not pnpm). If you see `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` in the diff, that's a flag.
- **Framework:** Next.js (latest stable). Not Remix, not pure React, not Vite.
- **Database:** Supabase (Postgres). Not raw Postgres, not MySQL, not Firebase.
- **Hosting:** Vercel. Tools deploy to Vercel; nothing self-hosted.
- **Styling:** the design tokens from `@fitzrovia/design-system` (in-repo at `packages/design-system/src/tokens.css` for CSS custom properties and `packages/design-system/src/tokens.ts` for TypeScript values) plus Lucide for icons. The handbook reference at `01-design-system/design-system.md` documents the rationale; the in-repo package is the canonical source builders import from. No shadcn/ui.
- **Imports:** UI primitives come from `packages/design-system/`; entities from `packages/shared-entities/`; auth from `packages/auth/`; activity logging from `packages/activity-log/`; Supabase client from `packages/supabase-client/`. Apps don't reinvent these.

Flag any deviation. Foundation-phase exceptions (e.g., a tool built before `packages/auth/` exists) are tracked in the configuration list — flag those too, but recognize they're known.

### 5. Compliance (Law 25 / PIPEDA)

Fitzrovia is subject to Quebec's Law 25 and federal PIPEDA. Both apply when personal data is handled. The AI Studio's Privacy Officer is Tim Watson; he signs off on first-of-kind tools handling new categories of personal data.

Three things to check:

**a. New personal data categories.** If the diff introduces a tool or feature handling a new kind of personal data (tenant PII, employee compensation, prospect contact info, anything that could identify an individual), and there's no record of Tim's sign-off in the PR description or comments, flag it.

**b. `tool_activity_log` usage.** Tools handling Red data must write to the `tool_activity_log` table on operations that read or write that data. If the diff adds Red-data operations without corresponding `logActivity()` calls, flag it.

**c. Third-party data flows.** Sending personal data to AI providers (Anthropic, OpenAI, etc.) is a real consideration under Law 25. If the diff adds a new third-party API call that includes personal data, flag the question: has Tim been consulted?

If the PR doesn't touch personal data at all, this dimension reports "n/a."

### 6. Process

Verify the pre-PR checklist (per `04-standards/pre-pr-checklist.md`) was completed honestly. The checklist is auto-populated in the PR template; the boxes should be ticked. Look at the PR description.

If a box is ticked but the diff suggests it wasn't actually done — for example, "I ran `/review`" is ticked but the diff has obvious issues `/review` would have caught — flag the dishonesty politely. The fix is a direct conversation with the builder, not more automation.

Specifically check:

- **Linear ticket linked with closing keyword.** The PR description must contain `Closes AIS-XX` (or `Fixes AIS-XX` / `Resolves AIS-XX`). A bare ticket reference, a `Part of AIS-XX` reference, or any other linking format is **not** sufficient — Linear's GitHub integration auto-transitions tickets to "Live" on PR-merge **only** when one of these closing keywords appears in the description. The auto-transition is keyword-dependent, even though the GitHub-Linear integration may auto-link the ticket via other means (branch name, bare reference). If the description doesn't contain a closing keyword, flag it as a Should-fix process finding — the merge will still go through, but the linked ticket won't transition automatically. Exception: if the ticket genuinely spans multiple PRs and this one is one of several, `Part of AIS-XX` is correct and the auto-transition is intentionally deferred to whichever PR closes the ticket. Note that exception in your finding so the approver knows it's deliberate.
- **Requester confirmation.** If the PR closes a ticket originated by a non-builder (someone in Finance, Leasing, etc.), the PR description should note that the requester confirmed the change works. If absent and the ticket has a requester, flag it.
- **Single logical change.** If the diff bundles multiple unrelated changes (e.g., a feature plus an unrelated refactor plus a doc update), flag the scope. The fix is splitting the PR.

---

## Severity calibration

When ranking findings within a dimension, use these levels:

- **Critical** — the PR must not merge in its current state. Examples: a hardcoded API key, a missing RLS policy on a Red-data table, a pre-PR checklist box ticked falsely. The advisory recommendation should be "Block."
- **Should-fix** — meaningful issue, ideally addressed before merge but not a blocker if there's a reason to ship. Examples: design system deviation that affects UX, scope creep that should be split into a separate PR. The advisory recommendation is usually "Request changes."
- **Nice-to-have** — minor issue, not worth blocking on. Examples: a typo in a comment, a non-canonical spacing value, a missing optional checklist item. The advisory recommendation can still be "Approve" if these are the only findings.

A PR with no findings above Nice-to-have should get an "Approve" recommendation. A PR with one or more Critical findings should always get "Block." Should-fix findings push toward "Request changes" but the approver weighs context.

---

## Output structure

Produce your report in this exact format. Be concise but specific — vague findings can't be acted on.

```text
## Executive summary

[One paragraph. State what the PR does, the highest-severity finding (if any), and your advisory recommendation. Maximum 4 sentences.]

**Advisory recommendation:** [Approve | Request changes | Block]

---

## Findings by dimension

### 1. Functional review
[One paragraph or "n/a — no functional concerns." Specific findings ranked by severity if any.]

### 2. UX and design
[One paragraph or "n/a — no UI changes in this PR." Specific design system deviations if any.]

### 3. Security (Fitzrovia overlay)
[One paragraph. Always check for hardcoded secrets even if other security dimensions are n/a. Be explicit: "scanned the diff for credential patterns; no matches found" or "found a potential secret on line X of file Y."]

### 4. Stack alignment
[One paragraph or "n/a — no stack-relevant changes." Specific deviations if any.]

### 5. Compliance (Law 25 / PIPEDA)
[One paragraph or "n/a — no personal data handling in this PR." Specific concerns if any.]

### 6. Process
[One paragraph. Always cover this dimension — even pure refactor PRs go through process verification.]

---

## Recommendation rationale

[Two to four sentences explaining why you arrived at the advisory recommendation. Reference the dimensions and findings that drove it. The approver reads this when deciding whether to override.]

---

**Reminder:** This recommendation is advisory. The human approver makes the actual call and is accountable for it. If the approver disagrees with this recommendation, they should briefly note why in their PR comment so the team's judgment stays calibrated over time.
```

Now produce the report based on the PR data fetched at the top of this prompt.
