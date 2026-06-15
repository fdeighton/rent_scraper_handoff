# Approver Code Review Skill

**Path:** `02-skills/approver-review/README.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

## TL;DR

When you're approving a Pull Request, run **`/approver-review <pr-number>`** in Claude Code. It fetches the PR, the diff, and the comments automatically, then produces a structured plain-English report with an executive summary, six dimensions of review, and an advisory recommendation. ~30-60 seconds end to end.

If for some reason you can't use Claude Code (working from a different laptop, etc.), there's a fallback: paste the contents of `prompt.md` into Claude.ai with the materials manually copied in. ~5-10 minutes end to end.

---

## Why this skill exists

Fitzrovia's approvers (Karim, Kenny, Joseph in steady state) are non-technical. We don't pretend to read code line-by-line. Instead, we rely on a layered review model:

1. **Builder runs `/review` and `/security-review`** in Claude Code before opening the PR (Anthropic built-ins, free, baseline coverage).
2. **CodeRabbit reviews on PR open** — automated, posts a plain-English summary on the PR.
3. **Approver runs this skill** — adds Fitzrovia-specific judgment on top of the first two layers.
4. **Approver decides** — approve, request changes, or block.

This skill is layer 3. It assumes layers 1 and 2 already happened. Don't run it as a substitute for reading the CodeRabbit summary — it complements that, doesn't replace it.

---

## What this skill covers

Six dimensions, in one unified review pass:

1. **Functional review** — does this do what the PR description (and Linear ticket) asked for?
2. **UX and design** — does it follow the Fitzrovia design system (voice, error contract, labelled-vs-icon-only rule, Lucide icons, Poppins)?
3. **Security (Fitzrovia overlay)** — hardcoded secrets in the diff, env-var discipline, data classification correctness, RLS on Red tables.
4. **Stack alignment** — Bun (not npm/yarn), Next.js, Supabase, Vercel, design system imports. No drift.
5. **Compliance** — Law 25 / PIPEDA red flags, `tool_activity_log` usage where required.
6. **Process** — pre-PR checklist completed honestly, requester confirmed when applicable, PR scope is one logical change.

Output is a single layered report:

- **Executive summary** at the top — one paragraph, includes the advisory recommendation
- **Findings by dimension** below — concerns ranked by severity (Critical / Should-fix / Nice-to-have)
- **Recommendation** at the bottom — Approve / Request changes / Block, with rationale

The recommendation is **advisory**. The approver makes the actual decision and is accountable for it.

---

## When to use it

Run this skill on every PR you're approving. There's no PR small enough to skip it — even a one-line typo fix gets a quick run-through, because the cost is small (~1 minute with the slash command) and the value is in not making exceptions ("I trust this PR" is exactly when mistakes slip through).

The skill is **not** for the PR author. Authors run `/review` and `/security-review` (the Anthropic built-ins). This skill is for whoever is *approving* their work.

---

## When NOT to use it

- **Documentation-only PRs** (changes to handbook markdown, README updates, no code) — quick visual review is sufficient. The skill would mostly find nothing.
- **PRs to test/example code** — if the PR is purely scaffolding test fixtures or example data, full skill review is overkill.
- **PRs you authored** — you can't approve your own PRs (per `04-standards/branching-and-prs.md`). If you've authored, route to the other approver.

For everything else, run the skill.

---

## Two ways to run the skill

The skill exists in two forms because Fitzrovia uses both Claude Code and Claude.ai:

| Form | Where it lives | When to use |
|---|---|---|
| **Claude Code slash command** | `claude-code/SKILL.md` (this folder) → installed in `fitzrovia-tools/.claude/skills/approver-review/` | **Default.** ~30-60 seconds per review. PR data fetched automatically. |
| **Claude.ai paste-in prompt** | `prompt.md` (this folder) | Fallback when Claude Code isn't available. ~5-10 minutes per review. Manual copy-paste. |

The Claude Code version is the default because it's faster and removes copy-paste friction. The Claude.ai version is a fallback for moments when you don't have Claude Code available (e.g., reviewing on a phone, on a different laptop without the repo cloned).

---

## How to use it — Claude Code (default)

### One-time setup (per laptop)

The skill needs to be installed in the `fitzrovia-tools` repo at `.claude/skills/approver-review/`. This is a one-time setup that happens when the repo is created. Once it's there, every developer who clones the repo gets the skill automatically.

If you're setting up the skill for the first time:

1. Make sure you've cloned `fitzrovia-tools` to your laptop
2. Inside the repo, create the directory: `mkdir -p .claude/skills/approver-review`
3. Copy `claude-code/SKILL.md` from this folder into `.claude/skills/approver-review/SKILL.md` in the repo
4. Commit and push to make it available to other developers

You also need the GitHub CLI (`gh`) installed and authenticated. It already is if you followed `06-operations/development-setup.md`.

### Running the skill

In Claude Code, with `fitzrovia-tools` open:

```
/approver-review 14
```

(Replace `14` with the actual PR number you're reviewing.)

That's it. Claude Code:

1. Detects the slash command
2. Runs `gh pr view 14`, `gh pr diff 14`, and `gh pr view 14 --comments` automatically
3. Inserts the output into the prompt
4. Applies the six-dimension review
5. Outputs the structured report

You read the report. You decide. You go to GitHub and click Approve / Request changes.

### Verifying the skill is loaded

Type `/` in Claude Code. You should see `/approver-review` in the dropdown alongside built-in commands like `/review` and `/security-review`. If you don't see it, the skill isn't installed in `.claude/skills/approver-review/SKILL.md` — re-check the setup steps above.

---

## How to use it — Claude.ai (fallback)

When Claude Code isn't available, the same skill can be run in Claude.ai with manual copy-paste. The prompt is in `prompt.md` in this folder.

### Step 1 — Open a fresh Claude.ai conversation

Use Claude.ai (your Claude Teams seat). Click "New chat" — fresh context.

### Step 2 — Paste the prompt

Open `prompt.md` in this folder. Copy everything between `=== START PROMPT ===` and `=== END PROMPT ===`. Paste into Claude.ai as your first message. Don't send yet.

### Step 3 — Add the materials

Below the prompt, in the same message, add:

```
=== LINEAR TICKET ===
[paste the ticket title, description, acceptance criteria from Linear]

=== PR DIFF ===
[paste the full git diff — see "Getting the diff" below]

=== CODERABBIT SUMMARY ===
[paste CodeRabbit's review comment from the PR conversation]

=== ADDITIONAL CONTEXT (optional) ===
[anything else worth flagging]
```

**Getting the diff in Claude.ai mode:** append `.diff` to the PR URL in your browser. For example, `github.com/fitzrovia-residential/fitzrovia-tools/pull/14.diff` gives you the raw diff. Select all, copy.

**Getting CodeRabbit's summary:** find CodeRabbit's review comment in the PR conversation, select all, copy.

### Step 4 — Send

Claude returns the report in the same structure as the Claude Code version.

---

## Reading the report

Read top-down:

- **Executive summary first.** This tells you the highest-severity finding (if any) and the advisory recommendation (Approve / Request changes / Block).
- **If recommendation is "Approve" with no Critical findings:** skim the six dimensions to verify nothing surprising. Move to step "Apply your judgment" below.
- **If recommendation is "Request changes" or "Block":** read the relevant dimensions in detail. Note specifically what needs changing.

---

## Apply your judgment

The skill's recommendation is **advisory**. You make the actual call.

Most of the time, you'll agree with the skill — it's been calibrated to Fitzrovia's standards and it's reading the same materials you would. But you can override.

Reasons to override:

- **Override toward "Approve"** when the skill flagged something that you have context to dismiss. E.g., skill flags a missing requester confirmation, but you know the requester confirmed it on Teams (just not in the PR description).
- **Override toward "Request changes"** when the skill missed something you noticed. E.g., skill missed a UX issue you spotted because you happened to know what the existing flow looks like.
- **Override toward "Block"** when the skill didn't catch a serious issue. Rare but possible.

If you override, briefly note why in your PR comment. Two reasons: (1) the PR author understands your reasoning, (2) over time, the team can see when overrides happen consistently in the same direction — that's a signal the skill prompt needs an update.

---

## Comment and act on the PR

Back to GitHub. Click "Review changes" (top-right of the Files changed view).

Three options:

- **Approve** — comment field can be brief. Something like *"Approving. Skill review found no Critical issues. One Should-fix on stack alignment (using `npm` instead of `bun` in the new script) — flagging for follow-up but not blocking this PR."*
- **Request changes** — list the specific changes needed. Reference the skill's findings if helpful: *"Skill flagged hardcoded Supabase URL in `apps/leasing/src/db.ts`. Move to env var. Otherwise looks good."*
- **Comment** (no approval/blocking) — only if you have questions before deciding. Rare.

Submit the review. GitHub notifies the PR author.

---

## What the skill does NOT do

- **It doesn't read the code line-by-line.** It works from the PR description, the diff, and CodeRabbit's summary. If a subtle bug needs deep code analysis, the skill won't catch it. That's what `/review` and CodeRabbit are for.
- **It doesn't replace `/review` or `/security-review`.** Those are baseline. This skill assumes they already ran.
- **It doesn't replace CodeRabbit.** CodeRabbit catches automated patterns; this skill adds Fitzrovia-specific judgment.
- **It doesn't grant approval automatically.** A "recommend Approve" output from the skill still requires a human to click Approve on GitHub.
- **It doesn't have memory between PRs.** Each review is a fresh execution. The skill doesn't remember "we already discussed this pattern in PR #14."

---

## Realistic time per PR

**Claude Code (slash command):** ~30-60 seconds for the skill to run, ~2-3 minutes for the human to read the report and act. Total: ~3-4 minutes.

**Claude.ai (paste-in fallback):** ~5-10 minutes including all the copy-paste.

Faster on small PRs, slower on PRs that require careful reading of findings.

---

## Common edge cases

**Multiple PRs in a row.** In Claude Code, each `/approver-review` call is a fresh execution — no cross-contamination. In Claude.ai, run a fresh conversation for each.

**The skill says "Approve" but you have a bad feeling.** Trust the bad feeling. Look at the diff yourself, ask the builder a question, run `/security-review` on the diff. The skill is a tool, not the authority.

**The skill flags something you don't understand.** Ask Claude a follow-up: *"What does it mean that there's no RLS policy on the new `support_submissions` table? Why does this matter?"* In Claude Code, just send another message. In Claude.ai, same.

**The PR is huge (50+ files).** Run the skill anyway. The slash command handles arbitrary diff size — `gh pr diff` will return whatever's there. If the diff is genuinely too big to review, that's a signal to push back on the builder to split the PR, not a signal to skip the skill.

**You author a tiny one-line PR (typo fix in a doc).** Don't run the skill. Self-merge with a comment explaining why this is exception-acceptable. (Self-approval is technically against the rule, but for typo-only doc PRs, the no-self-approval rule has informal flexibility — at the team's discretion. Don't make this a habit.)

**You disagree with the skill repeatedly.** Update the prompt. The skill is a living document; if it consistently makes a wrong call (e.g., always flags Bun usage as unusual when Bun is the standard), that's a prompt bug. Edit `claude-code/SKILL.md` (and/or `prompt.md` if you also use the Claude.ai version) to fix.

---

## Maintenance

The skill content (`claude-code/SKILL.md` for the Claude Code version, `prompt.md` for the Claude.ai version) is a living document. Update it when:

- A new dimension of review surfaces from real PR experience (e.g., "we keep missing X — add it to the prompt")
- A handbook standard changes (new design system rule, new policy) — the prompt should reflect current standards
- The stack changes (e.g., if Fitzrovia ever moves off Bun, the prompt's stack-alignment section needs updating)

Keep the two versions in sync. When you edit one, edit the other. The content is essentially identical; only the data-fetching mechanism differs.

Don't update the skill mid-review. If you notice something missing during a review, finish the review with judgment, then propose a prompt update afterward.

---

## File contents of this skill

- `README.md` — this file. Orientation.
- `prompt.md` — Claude.ai paste-in version of the skill. Fallback for when Claude Code isn't available.
- `claude-code/SKILL.md` — Claude Code slash command version. Default. Install at `fitzrovia-tools/.claude/skills/approver-review/SKILL.md` in the repo.

---

## Related documents

- `04-standards/pre-pr-checklist.md` — what builders do before opening a PR (this skill assumes that's been done honestly)
- `04-standards/branching-and-prs.md` — the broader PR review workflow
- `01-design-system/design-system.md` — the design system this skill checks alignment against
- `05-policies/data-classification.md` — the Green/Amber/Red model the skill applies
- `05-policies/api-keys-and-secrets.md` — the secrets-handling rules the skill enforces in its security dimension
- `06-operations/coderabbit-setup.md` — context on what CodeRabbit catches before this skill runs
