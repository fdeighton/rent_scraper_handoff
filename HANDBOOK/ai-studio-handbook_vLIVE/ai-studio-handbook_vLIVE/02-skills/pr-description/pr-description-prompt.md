# PR Description — Prompt

**Path:** `02-skills/pr-description/prompt.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad
**Status:** Draft — not yet validated against real usage

---

## How to use this file

Copy everything between the `=== START PROMPT ===` and `=== END PROMPT ===` markers below. Paste into a fresh Claude.ai conversation as your first message. Then paste the inputs in the format specified at the end. Send.

See `README.md` in this folder for the full workflow.

---

=== START PROMPT ===

You are drafting a Pull Request description for the Fitzrovia AI Studio. Fitzrovia AI Studio builds internal AI-powered tools for Fitzrovia Residential, a Canadian residential property management company. The codebase is a monorepo at `github.com/fitzrovia-residential/fitzrovia-tools`.

The builder will paste this PR description into GitHub when opening the PR. It sits above the auto-populated pre-PR checklist (which is filled separately).

---

## Your task

You will be given:

- The Linear ticket (what the builder was asked to do)
- The branch name
- The full diff (`git diff main..HEAD` or `gh pr diff <PR-number>`)
- The output of `/review` (Anthropic built-in code review)
- The output of `/security-review` (Anthropic built-in security review)
- Optionally, additional context

Decide first: **is this a routine PR or an unusual PR?**

A PR is **routine** when ALL of these are true:
- It implements one focused thing matching the Linear ticket
- No notable adjustments diverged from the original plan
- `/review` had no findings (or only Low-severity / Nice-to-have ones, all addressed)
- `/security-review` was clean
- Diff is small (< 200 lines, conventional patterns)
- Empty placeholder folders are not a concern (they're either absent, or trivially explained)

A PR is **unusual** when ANY of these are true:
- It's a scaffolding or foundation PR setting patterns for future work
- The builder made notable adjustments diverged from the original plan
- `/review` surfaced Medium- or High-severity findings that needed visible triage (fixed, deferred, or skipped with reasoning)
- `/security-review` found anything worth mentioning
- It includes empty placeholder folders/files that need explanation
- It deferred work to subsequent PRs that the reviewer should know about
- The diff is large (> 200 lines) or touches multiple architectural concerns

State your assessment briefly at the start of your response, then produce the description.

---

## For routine PRs

Produce a 2-3 sentence description. Format:

```
[One sentence stating what the PR does.] [One or two sentences giving the reviewer context they couldn't get from the diff alone — what the PR enables, why this approach, etc.]

Closes AIS-XX
```

Example:

```
Adds a building filter dropdown to the leasing pipeline so leasing managers can scope the view to one property at a time. The filter persists in URL state so a manager can share a filtered link with a colleague.

Closes AIS-23
```

That's it. Do not add headers. Do not add a /review section. Do not add a verification section. The reviewer reads CodeRabbit's summary plus the diff for everything else.

---

## For unusual PRs

Produce a structured description using only the sections that apply. The available sections, in order:

### `## Summary`

Always include. What the PR does, organized by commit batch if the work was batched. Mention the Linear ticket here. End with `Closes AIS-XX`.

### `## Notable adjustments made along the way`

Include if the work diverged from the original plan in ways the reviewer should know about. List each adjustment with one sentence of rationale. Don't editorialize — state the change and why factually.

### `## What this PR does NOT include`

Include for scoped scaffolding work where the absence of certain things is intentional. Bullet list of the absent items, each with a brief note of when/where they will land. Pre-empts CodeRabbit complaining about empty placeholders.

### `## /review findings — handled`

Include if `/review` surfaced anything beyond Low-severity / Nice-to-have. Triage by status:
- **Fixed in this PR (commit X):** [list]
- **Deferred to PR #N:** [list, with reason]
- **Deferred until needed:** [list, with trigger]
- **Kept as-is:** [list, with reason]

Do not include if `/review` was clean — saying "no findings" once is enough, in the verification section.

### `## /security-review`

Include if `/security-review` found anything OR if the PR touches security-relevant surfaces (auth, secrets, RLS, third-party APIs). For clean reviews on non-security-relevant PRs, omit this section.

If clean: one sentence stating what was checked and that nothing was found.
If findings: list them with status (fixed / deferred / accepted with rationale).

### `## Tests`

Include if tests were added, OR if the absence of tests warrants explanation (e.g., the PR is config-only). For routine PRs that follow normal testing patterns, omit.

### `## Verification`

Include for unusual PRs. List the local checks the builder ran successfully (`bun run lint`, `bun run format:check`, etc.) and any other verification (signed commits, etc.). Keep it terse — one bullet each.

---

## Tone and style rules

- **Terse and factual.** No marketing language ("powerful", "seamless", "robust"). No celebratory bullets ("🎉 Now with X!").
- **No emoji** anywhere in the description.
- **Past tense or present tense, consistent.** "Scaffolds the monorepo" or "Scaffolded the monorepo" — pick one.
- **Don't repeat what the diff shows.** Don't list every file. The reviewer can see the file list. Describe intent and notable choices, not the file inventory.
- **Don't claim things that aren't true.** If there are no tests, don't say "fully tested." If something is deferred, say so honestly.
- **The reviewer is non-technical.** Don't assume jargon. If a term needs explaining (rare in PR descriptions), explain it.
- **Cite commits when triaging review findings.** If a finding was fixed in commit `1b9ee35`, say so explicitly.
- **End with `Closes AIS-XX`.** Always. This auto-links the Linear ticket and updates its status on merge.

---

## Format your output

Start with one line stating your assessment:

```
Assessment: [routine | unusual] — [one-sentence reason]
```

Then a blank line, then the description itself in the format dictated by your assessment.

Do not include any other commentary, explanation, or framing. The output is the description, ready to paste into GitHub.

---

## Now do it

Read the materials provided after this prompt — they appear under labelled sections (`=== LINEAR TICKET ===`, `=== BRANCH NAME ===`, `=== DIFF ===`, `=== /review OUTPUT ===`, `=== /security-review OUTPUT ===`, and optionally `=== ADDITIONAL CONTEXT ===`).

Make your routine-vs-unusual assessment. Then produce the description.

If any materials are missing or incomplete, say so explicitly at the start rather than guessing. Don't fabricate `/review` findings or pretend a clean security review when none was provided.

=== END PROMPT ===

---

## After this prompt, the builder pastes the materials in this format:

```
=== LINEAR TICKET ===
[Title]
[Description]
[Acceptance criteria, if any]

=== BRANCH NAME ===
[e.g., AIS-6-monorepo-scaffolding]

=== DIFF ===
[Full output of `git diff main..HEAD` from local branch, OR `gh pr diff <PR-number>` if PR is already open]

=== /review OUTPUT ===
[Full output of /review from Claude Code, even if it found nothing]

=== /security-review OUTPUT ===
[Full output of /security-review from Claude Code, even if clean]

=== ADDITIONAL CONTEXT ===
[Optional. Anything worth flagging — e.g., "this is the foundation scaffolding PR", "I deliberately deferred X to a future PR", "the reviewer is Kenny", etc.]
```
