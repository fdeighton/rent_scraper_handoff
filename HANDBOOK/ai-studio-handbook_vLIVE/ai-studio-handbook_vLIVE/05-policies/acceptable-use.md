# Acceptable Use Policy

**Path in handbook:** `05-policies/acceptable-use.md`

**Last updated:** April 30, 2026
**Owner:** Karim Mourad

---

## Purpose

This policy defines what is and isn't acceptable use of Fitzrovia's AI Studio tools and infrastructure. It applies to every staff member who has access to any AI Studio tool, every builder who works on AI Studio code, and every administrator who manages AI Studio infrastructure.

It is **not** the broader Fitzrovia policy on staff use of AI generally. This policy specifically covers the AI Studio's tools, infrastructure, and the data flowing through them.

---

## Scope

This policy covers:

- All tools deployed under `hub.fitzrovia.ca` (the AI Studio's hub) and any subdomain
- The AI Studio's monorepo (`fitzrovia-residential/fitzrovia-tools`)
- Claude Teams seats issued under the Fitzrovia organisation
- Supporting infrastructure: Vercel, Supabase, CodeRabbit, Linear (Fitzrovia AI Studio workspace)
- The data flowing through any of the above

This policy does **not** cover:

- Personal use of AI tools (Claude Pro on a personal account, ChatGPT, Gemini, etc.) — that is governed by Fitzrovia's broader IT/HR policies
- Use of Microsoft 365 tools (Teams, Outlook, SharePoint) outside the AI Studio context — those are general Fitzrovia infrastructure governed by IT
- Use of Yardi or other Fitzrovia operational systems — those are governed by their respective owners

---

## Acceptable use

> **Plain English:** What we expect staff to do.

### For all staff using AI Studio tools

- **Use sanctioned tools for sanctioned purposes.** AI Studio tools are built for specific Fitzrovia operational needs. Use them for those needs. If a tool would be useful for something it wasn't built for, suggest the change via the intake form rather than working around the tool's intended use.

- **Submit data the tool was designed to handle.** If a tool's interface asks for an address, submit an address. Don't paste in long narratives, screenshots of confidential documents, or data the tool wasn't designed to process.

- **Treat tool outputs as draft, not final, and take responsibility for them.** AI-generated content from AI Studio tools is a starting point. Staff are responsible for reviewing the output before using it externally, sending it to clients or counterparties, or making decisions based on it. **The staff member who uses an AI-generated output is accountable for that output** — its accuracy, its appropriateness, the decisions made from it. "The AI said so" or "the tool produced this" is not a defence. The tool is an assistant; the human is the decision-maker and bears the consequences. This applies equally to outputs that turn out to be wrong, outputs that contain errors the user didn't catch, and outputs that the user pasted into an external communication without reviewing.

- **Report issues.** If a tool produces output that looks wrong, exposes data that shouldn't be visible, or behaves unexpectedly, report it via Microsoft Teams to Karim or Kenny. Don't try to work around it silently.

### For builders working on AI Studio code

- **Follow the standards.** Every builder follows `04-standards/codebase-organization.md`, `04-standards/branching-and-prs.md`, and `04-standards/pre-pr-checklist.md`. These exist to keep the codebase consistent, reviewable, and shippable. Work that bypasses them creates problems for everyone.

- **Use real data during build, but treat it carefully.** Builders need access to real data to verify their tools work. That access comes with the responsibility to handle the data per `05-policies/data-classification.md` — don't copy Red data to personal devices, don't share it via channels the data classification doesn't allow, don't leave it in places it shouldn't persist.

- **Run the pre-PR review tooling before submitting code for approval.** Specifically: `/review` and `/security-review` per `04-standards/pre-pr-checklist.md`. The tooling exists to catch issues before they reach review; using it is non-negotiable.

- **Document data classification when shipping a tool.** Every tool's README documents its data classification per `05-policies/data-classification.md`. Builders set this when they ship the tool; approvers verify it during review.

### For administrators (Karim and Kenny)

- **Use universal admin powers for studio operations only.** Universal admin access exists to support, troubleshoot, and respond to incidents. It is not for personal projects, exploration unrelated to Fitzrovia's operations, or any use disconnected from the AI Studio's mandate.

- **Keep credentials secure.** Don't share credentials in Teams, email, or any unsecured channel. Use the password vault for shared credentials. Rotate credentials when leaving the role or when there's any reason to suspect compromise.

- **Follow the incident response playbook when things break.** Per `05-policies/incident-response.md`. Don't improvise.

---

## Unacceptable use

> **Plain English:** What we don't accept. This list is not exhaustive — anything that obviously violates the spirit of the policy is also unacceptable, even if not specifically listed.

The following are unacceptable and may result in consequences (see "Consequences" below):

- **Submitting confidential information to AI Studio tools that aren't classified to handle it.** A tool classified Green should not receive Red data. If a tool's classification is wrong for what you need to do, request that the tool be re-classified or that a different tool be built — don't submit the data anyway.

- **Sharing tool outputs externally without review.** AI-generated content sent to clients, counterparties, regulators, or the public without human review represents Fitzrovia speaking. Outputs are drafts; staff are responsible for what gets sent.

- **Sharing access credentials or letting others use your account.** Each staff member's access is theirs. Lending credentials, even for "just five minutes," is not acceptable.

- **Attempting to access tools or data outside one's authorisation.** Trying to log in to tools you don't have access to, attempting to bypass M365 group restrictions, querying databases directly when you don't have direct database access — these are not acceptable.

- **Bypassing the pre-PR review process.** For builders: skipping `/review`, `/security-review`, or the pre-PR checklist; merging PRs without approval; pushing directly to `main` (which branch protection prevents anyway, but attempting to is itself a violation).

- **Using AI Studio infrastructure for personal purposes.** Builder accounts, GitHub access, Vercel, Supabase, and Claude Teams seats are issued for Fitzrovia work. Using them for personal projects, side businesses, or anything outside the AI Studio's mandate is not acceptable.

- **Knowingly introducing or distributing malicious code.** This should go without saying but is included for completeness.

- **Disclosing AI Studio tools, data, or infrastructure details to unauthorised external parties.** This includes informal conversations with friends or contacts, public posts, presentations at events, or interviews.

---

## Compliance

This policy operates within Fitzrovia's broader Law 25 (Quebec) and PIPEDA (federal) obligations. Tim Watson is Fitzrovia's Privacy Officer and the authority on what those obligations require.

For tools handling personal data:

- The data classification policy (`05-policies/data-classification.md`) governs what controls apply
- Tim Watson signs off on the first tool the studio handles in a new kind of personal data
- The incident response playbook (`05-policies/incident-response.md`) covers Law 25 breach notification (Tim makes the call on regulatory notification)
- Builders and approvers handling personal data follow the standards as a baseline; Tim's documentation is the authority on legal requirements

For tools handling commercial data of material competitive sensitivity:

- The data classification policy governs controls
- Corey signs off on the first tool the studio handles in a new kind of Red commercial data
- Disclosure of commercial data outside Fitzrovia is governed by employment contracts and NDAs (HR's domain)

This policy does not reproduce the legal text of Law 25, PIPEDA, or any employment-contract obligations. Those exist elsewhere; this policy works within them.

---

## Intellectual property and code ownership

> **Plain English:** Everything built by the AI Studio belongs to Fitzrovia. The code, the tools, the prompts, the configurations, the documentation, the data — all of it is Fitzrovia's intellectual property. This applies regardless of who wrote it, whether AI was used to help write it, or whether the work was done on a Fitzrovia laptop or a personal one.

The principle:

- **All code in the AI Studio's repositories is Fitzrovia's intellectual property.** This includes code committed by Karim, Kenny, Joseph, future builders, and any third parties. It includes code generated with AI assistance (Claude Code, Claude.ai, ChatGPT, Copilot, or any other tool). The use of AI to assist with code does not change ownership — the work product belongs to Fitzrovia regardless of how it was produced.

- **All AI Studio tools, prompts, skills, configurations, and documentation are Fitzrovia's intellectual property.** This includes the contents of `02-skills/`, the prompts pasted into Claude.ai for review tasks, the SKILL.md files in Claude Code, the CLAUDE.md files at the monorepo root, the configurations in CodeRabbit, ESLint, CI workflows, and Vercel — and this handbook itself.

- **The data produced by AI Studio tools is Fitzrovia's intellectual property and / or Fitzrovia's confidential operational data**, depending on what the data is. Staff using the tools have no individual ownership claim over the data that flows through them.

- **Builders may not take AI Studio code, tools, prompts, or configurations with them when they leave Fitzrovia**, nor reuse them at subsequent employers, nor publish them externally. This applies whether the builder authored the work or contributed to it. The work is Fitzrovia's regardless of authorship.

- **Open-source contributions made on Fitzrovia time or using Fitzrovia infrastructure require explicit approval** from Karim or Kenny. Some contributions are valuable to make publicly (bug fixes to libraries we depend on, generic patterns that don't expose Fitzrovia's competitive position); others are not. The default is "don't open-source"; the exception requires approval, not the rule.

This section sits within Fitzrovia's broader employment-contract IP provisions. Where this policy and the employment contract differ, the employment contract is the authority. This policy does not create any IP rights, transfers, or limitations beyond what already exists in employment terms; it makes those terms operationally explicit for AI Studio work.

---

## Consequences of misuse

Violations of this policy may result in consequences proportionate to the severity:

- **Minor violations** (e.g. submitting wrong-format data to a tool, missing the pre-PR checklist on a low-risk PR): a conversation with Karim, a reminder of the policy, and additional review on subsequent work.

- **Material violations** (e.g. sharing credentials, attempting unauthorised access, bypassing the PR review process repeatedly): formal escalation to HR, possible removal of access to AI Studio infrastructure, possible disciplinary action per Fitzrovia's broader employment policies.

- **Severe violations** (e.g. knowingly leaking data, knowingly introducing malicious code, knowingly disclosing confidential information externally): immediate revocation of access, escalation to HR and Corey, possible termination per Fitzrovia's broader employment policies, possible legal action.

The goal of consequences is not punishment — it's to maintain the trust that the AI Studio's universal admin model and lightweight approval processes depend on. The studio's speed comes from trusting builders and operators to act in good faith. Material breaches of that trust have to have consequences or the trust model fails for everyone.

HR is the authority on how this section integrates with Fitzrovia's broader disciplinary and employment policies.

---

## Acknowledgement

Every staff member who is granted access to an AI Studio tool is expected to understand and follow this policy. The mechanism for acknowledgement (signed form, intranet checkbox, or other) is to be defined by HR.

---

## Updates and amendments

This policy is reviewed at least annually by Karim, Kenny, and Tim Watson. Substantive changes require:

- A PR to this document following the standard `04-standards/branching-and-prs.md` workflow
- Review by Karim, Kenny, and Tim
- HR review for any changes affecting consequences or acknowledgement
- A version bump and changelog entry

---

## What this policy does NOT cover

- **The criteria for what data is Red, Amber, or Green** — see `05-policies/data-classification.md`
- **Who has access to what tools** — see `05-policies/access-control.md`
- **What happens when things break** — see `05-policies/incident-response.md`
- **The codebase structure or how to make changes** — see `04-standards/codebase-organization.md` and `04-standards/branching-and-prs.md`
- **Personal use of AI tools (Claude Pro, ChatGPT) on personal accounts** — owned by Fitzrovia IT/HR, not this policy
- **Detailed Law 25 / PIPEDA obligations** — Tim Watson's documentation is the authority
- **Fitzrovia-wide acceptable use of IT infrastructure** — owned by IT/HR
