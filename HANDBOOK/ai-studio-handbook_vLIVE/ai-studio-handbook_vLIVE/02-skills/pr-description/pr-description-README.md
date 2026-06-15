# PR Description Skill

**Path:** `02-skills/pr-description/README.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad
**Status:** Draft — not yet validated against real usage

---

## TL;DR

Before opening a PR, paste `prompt.md` into a fresh Claude.ai conversation along with the Linear ticket, the diff, and the `/review` + `/security-review` outputs. Claude returns a PR description sized appropriately to the change — 2-3 sentences for routine work, structured sections with headers for unusual PRs.

The skill is **for the builder**, before opening the PR. The companion approver-side skill is `02-skills/approver-review/`.

---

## Why this skill exists

The handbook says PR descriptions should be 2-3 sentences for routine PRs and structured (with headers like `## Summary`, `## Notable adjustments`, `## /review findings — handled`) for unusual PRs (foundation/scaffolding work, multiple adjustments, deferred review findings). Builders need to decide which mode the PR is in and write accordingly.

For non-technical builders, that's a real cognitive lift. This skill removes it: paste the inputs, get a description that's appropriately sized.

---

## When to use it

Use it before opening any PR where the description matters more than 2-3 sentences would convey. If you're truly only writing a one-line fix, the prompt is overkill — just type "Closes AIS-XX. Fixes typo in heading." and ship.

Use it especially when:

- This is a scaffolding or foundation PR setting patterns
- You made notable adjustments during the work that diverged from the original plan
- `/review` or `/security-review` surfaced findings you triaged (some fixed, some deferred)
- You want to pre-empt likely CodeRabbit complaints (intentional empty placeholders, etc.)
- You're not sure how much description is "right" and want Claude to size it

---

## How to use it

### Step 1 — Open a fresh Claude.ai conversation

Use Claude.ai (your Claude Teams seat). Click "New chat" — fresh context.

### Step 2 — Paste the prompt

Open `prompt.md` in this folder. Copy everything between `=== START PROMPT ===` and `=== END PROMPT ===`. Paste into Claude.ai as your first message. Don't send yet.

### Step 3 — Add the materials

Below the prompt, in the same message, add these labelled sections:

```
=== LINEAR TICKET ===
[paste the ticket title, description, acceptance criteria]

=== BRANCH NAME ===
[e.g., AIS-6-monorepo-scaffolding]

=== DIFF ===
[paste output of `git diff main..HEAD` from your local branch, OR `gh pr diff <PR-number>` if PR is already open]

=== /review OUTPUT ===
[paste the full output of /review from Claude Code, even if it found nothing]

=== /security-review OUTPUT ===
[paste the full output of /security-review from Claude Code, even if it found nothing]

=== ADDITIONAL CONTEXT (optional) ===
[anything worth flagging — e.g., "this is the foundation scaffolding PR", "I deliberately deferred X to a future PR"]
```

Send.

### Step 4 — Read and adjust

Claude returns a PR description. Read it critically before pasting into GitHub. Three things to check:

1. **Sized right?** Is it the appropriate weight for the change? If Claude wrote 600 words for a 5-line bug fix, push back: "make this 2-3 sentences."
2. **Honest?** Does it claim things that aren't true? (E.g., "fully tested" when there are no tests.) Edit anything inaccurate.
3. **Tone?** No marketing language, no celebratory bullets, terse and factual. If the output reads like a release announcement, push back.

Edit freely — the output is a draft, not a finished artifact.

### Step 5 — Open the PR with the description

Paste into the GitHub PR-open form above the auto-populated checklist. Walk through the checklist honestly. Click "Create pull request."

---

## What this skill does NOT do

- It doesn't decide whether to open the PR. You do that.
- It doesn't tick the pre-PR checklist boxes. The checklist is the builder's responsibility — the skill assumes those are already truthful.
- It doesn't run `/review` or `/security-review` for you. Those are upstream of this skill; their output is input.
- It doesn't have memory between PRs. Each invocation is fresh.

---

## Status: Draft

This skill is a draft as of May 6, 2026. It hasn't been validated against real usage yet. The structure follows the same pattern as the validated `approver-review` skill (which has been used) but the prompt itself is unproven.

**First real test:** the next PR Karim opens after PR #2. If the output is good, mark validated. If it needs prompt revision, revise here.

**Maintenance triggers:**
- New section in handbook PR-description guidance → reflect in the prompt
- New /review or /security-review output format → adjust how the prompt parses them
- Common revisions Karim makes after generation → fold into the prompt to reduce future revision

---

## Related documents

- `04-standards/branching-and-prs.md` — the "Writing the PR description" section that codified the short-vs-structured rule this skill applies
- `04-standards/pre-pr-checklist.md` — the checklist this skill assumes is already filled honestly
- `02-skills/approver-review/` — the companion skill on the approver side
