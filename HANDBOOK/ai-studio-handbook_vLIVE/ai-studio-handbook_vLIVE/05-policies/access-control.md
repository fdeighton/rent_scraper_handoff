# Access Control

**Path in handbook:** `05-policies/access-control.md`

**Last updated:** May 1, 2026
**Owner:** Karim Mourad

---

## Purpose

This policy defines how access to AI Studio tools and infrastructure is granted, managed, and revoked. It captures the operational rules — who's an admin, what groups exist, how someone gets access to a tool, what happens when they leave — that other handbook documents reference but don't define in one place.

It exists because access control mistakes have real consequences. Too restrictive and the studio can't ship; too permissive and we leak data we shouldn't. This policy sets the defaults so individual decisions don't get reinvented per tool.

---

## The model in one sentence

Karim and Kenny are universal admins on every AI Studio tool by design; everyone else's access is gated by Microsoft 365 groups, granted per tool, and revoked automatically when employment ends.

---

## Universal admin model

> **Plain English:** Karim and Kenny have admin access on every AI Studio tool — every database, every dashboard, every deployed app. This is intentional. It means they can fix problems, support users, and respond to incidents without bureaucratic delays. The trade-off is real: two people have very broad access, and we accept that trade-off because the studio is small enough that it's manageable.

The principle: **two universal admins, no exceptions.**

Karim and Kenny hold admin or owner permissions on:

- The `fitzrovia-residential` GitHub organisation
- The Fitzrovia Vercel team
- The Fitzrovia Supabase organisation
- Claude Teams
- CodeRabbit
- Linear (Fitzrovia AI Studio workspace)
- Microsoft Entra — both hold the **Groups Administrator role** scoped to AI Studio groups, so either can add or remove group members without bottlenecking on the other. Kenny holds broader Entra admin roles relevant to his IT remit; Karim's Entra access is scoped specifically to group management.
- Every tool deployed under `hub.fitzrovia.ca`, including direct database access and SSO bypass for support purposes

This is a deliberate choice driven by Operating Principle 9. The alternative — multiple admins per tool, role-based admin tiers, separation of duties between IT and operations — adds bureaucracy that small teams can't sustain. The two-admin model trades a degree of access concentration for the ability to actually operate the studio.

### Why two and not one

A single admin is a single point of failure. If Karim is on vacation and a tool breaks, Kenny needs to be able to act. If Kenny is unavailable when an HR-related access change is required, Karim handles it. The redundancy is intentional.

### Why not more than two

Each additional universal admin doubles the surface area for credential compromise, accidental misconfiguration, and offboarding gaps. At Fitzrovia's current scale, two is enough. If the studio grows materially — Builders 4 and 5 join, the team handles tools across more business units — this is a decision to revisit.

### When Karim or Kenny needs to lose universal admin

If either leaves Fitzrovia, transfers out of these roles, or is otherwise unable to perform the role, the other revokes the departing person's access on the same day, across every system in the universal admin list above. There is no "transition period" with both holding access. Same-day revocation is the rule.

The replacement is named explicitly via this policy being updated and a PR-merged change to the relevant CODEOWNERS files, Vercel team, Supabase organisation, etc.

---

## Microsoft 365 groups

> **Plain English:** Microsoft 365 groups are how Fitzrovia decides who can use which AI Studio tools. Adding a person to the right group grants access; removing them revokes it. This avoids managing per-tool access lists separately, and it ties access to whatever HR already does when someone joins or leaves.

Every AI Studio tool gates access via a Microsoft 365 group. Authentication via SSO (Microsoft Entra) determines which groups a user is in; the tool checks group membership before showing data.

### Group naming convention

Groups follow this pattern:

```
ai-studio-<scope>
```

Where `<scope>` is one of:

- `builders` — has access to the AI Studio's internal builder tools (Tool Starter docs, internal dashboards). Members: Karim, Kenny, Joseph, future builders.
- `staff` — has access to general AI Studio tools available to all Fitzrovia staff (the hub, intake form). Members: all Fitzrovia employees with @fitzrovia.ca accounts.
- `<tool-name>` — for tools restricted to a specific audience. Examples: `ai-studio-leasing-team`, `ai-studio-finance`, `ai-studio-hr`, `ai-studio-investor-relations`.

For tools restricted by department or function, the group name reflects the audience, not the tool. The leasing pipeline tool is gated by `ai-studio-leasing-team`, not `ai-studio-leasing-pipeline-tool`. This means one group can govern multiple related tools and is easier to maintain.

### Who creates and manages groups

Both Karim and Kenny hold the Groups Administrator role in Entra, scoped to AI Studio groups. Either can add or remove group members directly. Day-to-day membership changes are routine — they don't require a multi-step approval flow.

The division of labour is light:

- **Group creation** (a new group is needed for a new tool or audience) is typically Karim's call — he's the one designing the tool and knows what audience it should have. He creates the group himself or asks Kenny to.
- **Group naming conventions and structural decisions** (how groups relate to broader Fitzrovia Entra structure, naming patterns) remain Kenny's domain — he ensures the AI Studio's groups don't fork or break Fitzrovia's broader Entra setup.
- **Day-to-day membership changes** (adding a new staff member to the leasing team's group, removing someone whose role changed) can be done by either Karim or Kenny.

This avoids a bottleneck on Kenny while keeping IT-side authority over how groups fit into the broader Fitzrovia identity infrastructure. The trade-off is real: Karim has a power he could misuse. The check is the same as for the rest of the universal admin model — the studio is small enough that misuse would be visible, and the productivity cost of bottlenecking on Kenny outweighs the marginal risk.

Group membership changes propagate via SSO on the next login. There's no manual sync step.

This is intentionally manual rather than automated. Pulling group memberships from Yardi or HR systems would be nice but adds infrastructure complexity that isn't justified at our scale. Manual changes are slower but simpler and harder to misconfigure.

---

## Per-tool access patterns

> **Plain English:** Different tools need different access rules. A general staff hub is open to everyone with a @fitzrovia.ca account; a tool that displays per-property financials is open only to a small group. This section captures the standard patterns so tool builders don't have to invent access rules per tool.

The standard patterns:

### Hub-level tools (open to all staff)

Tools that any Fitzrovia staff member can use without restriction. The intake form, the AI Studio status page, the tool selection page itself.

- Gated by: `ai-studio-staff` (effectively all @fitzrovia.ca accounts)
- SSO required: yes
- Activity logging: standard
- Data classification: typically Green or Amber; Red tools are never hub-level

### Department or team tools (restricted to a function)

Tools used by a specific business function. Most AI Studio tools fall here.

- Gated by: `ai-studio-<team-name>` (e.g. `ai-studio-leasing-team`, `ai-studio-finance`)
- SSO required: yes
- Activity logging: standard for Amber, detailed for Red
- Group membership: managed by Kenny, requested by Karim or the department lead

### Tier 1 / Red-classified tools

Tools handling data whose leak would cause material harm.

- Gated by: a narrowly-scoped group (e.g. `ai-studio-hr-compensation` for the Compensation Modeller, not just `ai-studio-hr`)
- SSO required: yes
- RLS enforced at the database layer (per `05-policies/data-classification.md`)
- Activity logging: detailed, with quarterly review
- Group membership: principle of least privilege; access granted only to people whose role requires it; reviewed quarterly

### Builder-internal tools

Tools used only by the AI Studio team itself — internal dashboards, the tools registry, monitoring tools.

- Gated by: `ai-studio-builders`
- SSO required: yes
- Activity logging: standard
- Members: Karim, Kenny, Joseph, future builders

---

## Tool visibility on the hub

> **Plain English:** If you don't have access to a tool, you don't see it. The hub only shows you the tools you can actually use. No "locked" tiles, no greyed-out cards, no "request access" buttons. Tools you can't access don't appear at all.

The rule:

**A tool's listing on `hub.fitzrovia.ca` is gated by the same group membership that controls access to the tool itself.** If a user isn't in the tool's access group, the tool is filtered out of their hub listing server-side. They have no way to know the tool exists from the hub.

The reason: **the existence of some tools is itself sensitive information.** A tool that evaluates leasing associate performance shouldn't be visible to leasing associates — even if they can't open it. Seeing the listing tells them they're being evaluated by it, lets them guess what it does, and creates anxiety they can't resolve without escalating. The same logic applies to the Compensation Modeller, performance review compilers, anything that takes individual people as inputs. Visible-but-locked is worse than hidden because it leaks the fact-of-evaluation while withholding the substance.

The trade-off is real: discoverability suffers. Staff who would benefit from a tool may not know it exists if they're not already in the access group. The mitigation: when a new tool launches, the people whose roles fit are informed directly (via Teams or email by Karim or the relevant department lead), not by browsing the hub. The hub is for tools you already use, not a catalogue to discover from.

There are no per-tool exceptions. Hidden is the default everywhere. This keeps the rule simple to apply, simple to implement, and consistent across the studio.

---

## Access request workflow

> **Plain English:** When someone needs access to an AI Studio tool, they ping Karim or Kenny on Teams. We add them. Done. We don't route through department heads because group membership reflects role, not individual case-by-case judgement — once a tool's audience is set when it's built, adding people whose role obviously fits the audience doesn't need a separate approval.

> **A note on how people learn tools exist:** because tools are hidden from people without access, requests don't typically come from "I saw it on the hub and want to try it." They come from internal communication — a colleague mentioning it, a Teams announcement when a tool launches, a department lead pointing someone at it, or the requester remembering they asked for the tool to be built. This is fine; the hub is for tools you already use, not for browsing.

The standard flow:

1. **The person requests access.** Via Microsoft Teams to Karim or Kenny. Message includes which tool they need and (briefly) why if it's not obvious from their role.
2. **Karim or Kenny adds them to the group.** No multi-step approval. The request itself, paired with the requester's role, is enough.
3. **Group change propagates via SSO on next login.**

For tools that ship to wide audiences (`ai-studio-staff` — everyone with @fitzrovia.ca), no individual access request is needed. Staff get access automatically by being in the group.

### The exception: Tier 1 / Red tools

For tools handling Red data, access isn't granted by default just because someone is in the broad team group. The narrow access groups (e.g. `ai-studio-finance-compensation`) require a deliberate addition.

For these tools:

1. Person requests access via Teams.
2. Karim or Kenny **verifies the role requires it** before adding. This isn't a "department head approves" step — it's a "yes, their job actually involves this data" check, which Karim and Kenny can both make.
3. If the role doesn't obviously require it, Karim or Kenny escalates — typically a quick Teams message to whoever owns the underlying business process (e.g. for compensation data, the relevant HR or Finance lead) to confirm. This isn't routine; it's the rare case where access doesn't follow obviously from role.
4. Once verified, add to the group.

The principle: **approval scales with consequence.** Adding someone to `ai-studio-staff` (everyone) needs no thought. Adding someone to `ai-studio-finance-compensation` (HR data) needs a moment of "yes, their role genuinely requires this." Both are within Karim and Kenny's authority; neither requires routing through additional approvers as a default.

---

## Offboarding

> **Plain English:** When someone leaves Fitzrovia, their access to AI Studio tools is revoked the same day, automatically, by virtue of HR's standard offboarding process — for every platform except Supabase, which requires a manual extra step. This works as long as HR's offboarding process actually disables the @fitzrovia.ca account on the same day, and as long as the universal admins remember the Supabase step.

When someone leaves Fitzrovia:

1. **HR disables the @fitzrovia.ca account** as part of their standard offboarding process. This is the critical step — everything else flows from it.
2. **SSO authentication fails for that account immediately** on platforms that have SSO configured. The person can no longer log in to those tools, regardless of group membership.
3. **Microsoft 365 group memberships become moot** because the account can no longer authenticate. Kenny removes the account from groups within a few days for hygiene, but access is already gone.
4. **GitHub, Vercel, Linear, Claude Teams, and CodeRabbit accounts** tied to the @fitzrovia.ca account lose access through SSO. Kenny verifies this within a week of departure.
5. **Supabase requires a manual step.** Supabase SSO is gated behind their Team plan ($599/mo), which Fitzrovia is not on — Supabase access is managed via individual Supabase accounts with MFA, not via Microsoft Entra. When someone leaves, the universal admin (Karim or Kenny) **must manually remove that person's membership** from the Fitzrovia Supabase organization. This is a known caveat of staying on the Pro plan; the trade-off is $574/mo saved versus a manual offboarding step that affects two people total at current scale. Re-evaluate if/when team grows or compliance pressure changes.
6. **For builders specifically:** the departing builder's GitHub seat is removed from the `fitzrovia-residential` org, and their CodeRabbit seat is reassigned. Their `.env.local` files on their personal laptop are no longer a concern because the credentials they reference no longer authenticate them — but their laptop should be returned to Fitzrovia for standard IT decommissioning.

### Credential rotation on builder offboarding

When a builder leaves, certain shared credentials should be rotated as a precaution:

- Any production API keys the departing builder configured (e.g. the Linear API key for the intake portal, if they were the one who set it up)
- Any Supabase service keys they had access to via the development environment
- Any third-party API keys stored in Vercel that they may have viewed

This is Kenny's call on which keys are worth rotating; not every credential needs rotation just because someone left. The standard is "if they configured it, rotate it." If they only used a key that someone else configured, no rotation needed.

For Karim's offboarding (or Kenny's): the departing person doesn't decide what to rotate; the remaining universal admin does, with Corey's awareness given the scope.

---

## Compliance reference

This policy operates within Fitzrovia's broader Law 25 and PIPEDA obligations. Fitzrovia-wide privacy and access policies are owned by Tim Watson; this policy describes how AI Studio tools satisfy those obligations operationally.

For tools handling personal data (Red — personal sub-category per `05-policies/data-classification.md`), the access control patterns above apply alongside the Privacy Impact Assessment and other Law 25 requirements that Tim's documentation covers.

---

## What this policy does NOT cover

- **The criteria for what data is Red, Amber, or Green** — see `05-policies/data-classification.md`
- **The approval rules for code changes** — see `04-standards/codebase-organization.md` and `04-standards/branching-and-prs.md`
- **The Acceptable Use Policy** — see `05-policies/acceptable-use.md`
- **What happens when something breaks** — see `05-policies/incident-response.md`
- **Fitzrovia-wide IT and HR policies** — those are not in this handbook; they're maintained by IT and HR
