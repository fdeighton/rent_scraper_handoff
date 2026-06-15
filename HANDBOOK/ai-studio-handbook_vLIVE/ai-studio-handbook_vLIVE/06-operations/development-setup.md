# Development Setup

**Path in handbook:** `06-operations/development-setup.md`

**Last updated:** May 1, 2026
**Owner:** Karim Mourad

---

## How this document is used

> **Plain English:** Fitzrovia's builders are non-technical. The expected workflow is: the builder asks Claude Chat to help them set up their laptop, Claude Chat reads this document, and Claude Chat walks the builder through one milestone at a time — translating each milestone into specific prompts the builder pastes into Claude Code, asking for screenshots when something looks off, troubleshooting based on what's on screen.

This document is the script Claude Chat follows. It is not a step-by-step manual the builder reads alone. It captures the Fitzrovia-specific decisions Claude wouldn't otherwise know — what tools, what versions, what paths, what conventions — and trusts Claude to fill in the standard install and configuration knowledge it already has.

If a builder is going through this without Claude Chat for some reason, the document is still readable end-to-end. But the natural mode is Claude-Chat-led.

---

## Platform note

Fitzrovia is a Windows-only environment using Microsoft 365 (Teams, Outlook, SharePoint). This runbook covers Windows-native development tool setup. The runbook does not cover macOS or Linux. If circumstances ever change, instructions for those platforms can be added then.

---

## Prerequisites

The builder must have:

- A working `@fitzrovia.ca` email account with Microsoft 365 access
- An active Claude Teams seat under the Fitzrovia organisation
- GitHub access to the `fitzrovia-residential` org with at least Write permissions on the monorepo
- A Windows laptop they own or are issued by Fitzrovia

If any of these are missing, resolve them first. Don't proceed without them.

---

## Fitzrovia-specific context

Things Claude Chat needs to know to walk a builder through setup correctly. Each item includes the *why* so the builder understands what they're doing.

- **Monorepo location:** `github.com/fitzrovia-residential/fitzrovia-tools`. One repo holds every Fitzrovia internal tool plus the shared code those tools rely on. The structure is documented in `04-standards/codebase-organization.md`.

- **Recommended local path:** `C:\code\fitzrovia-tools`. **Never** inside OneDrive, SharePoint, or any other synced folder. Git creates thousands of small tracking files in a hidden `.git` folder, and the monorepo's `node_modules` directory contains tens of thousands of dependency files. OneDrive's background sync constantly tries to upload all of them, which corrupts the repo and slows the laptop to a crawl. Keeping code in a dedicated `C:\code\` folder outside any sync scope avoids this entirely.

- **Node version:** 20. Node is the runtime that runs JavaScript and TypeScript code. Different Node versions can behave subtly differently — pinning everyone to Node 20 ensures the code works the same on every laptop. The monorepo's `.nvmrc` file is the source of truth; if it specifies a different version later, follow that.

- **Package manager:** Bun, not npm or yarn. Bun is a faster modern package manager — installing dependencies takes seconds rather than minutes, which matters more than it sounds when you're doing it twenty times a week. The monorepo's scripts assume Bun is what's running them.

- **Editor:** VS Code with the Claude Code extension. Karim runs Claude Code via the VS Code extension, not the standalone command-line tool. The extension lets the builder have Claude Code as a panel inside VS Code rather than a separate terminal — easier to follow, easier to take screenshots from. This is the recommended setup for Fitzrovia builders.

- **GitHub authentication:** GitHub CLI (`gh`). When the builder pushes code to GitHub, GitHub needs to know who they are and that they're allowed. The CLI handles this via the browser — sign in once, the CLI remembers. Simpler than managing tokens or SSH keys. Fitzrovia uses the CLI exclusively.

- **Identity:** Git config uses the builder's `@fitzrovia.ca` email, never a personal email. Every commit gets tagged with this identity permanently. We want commits attributed to Fitzrovia identities, not personal ones.

- **Environment variables:** Stored in `.env.local` per app folder, gitignored so they never reach GitHub. Real values come from Fitzrovia's password vault — Karim or Kenny provides them. Production values live only in Vercel's dashboard, never on builder laptops. The reason for this separation: API keys and database passwords are sensitive enough that they can't be in code (anyone with repo access would see them) and can't be in builders' laptops (laptops get lost, stolen, replaced). Vercel's dashboard is the secure store for production; `.env.local` is the local-only copy a builder uses to run the tool on their machine. For paid-API keys (Anthropic, OpenAI, Yardi, Google Maps, etc.), the full provisioning, approval, and storage policy lives in `05-policies/api-keys-and-secrets.md`.

---

## Milestones

Claude Chat walks the builder through these in order. Each milestone is "complete" when the verify line works.

1. **Git installed.** Git is the version control system that talks to GitHub — every other tool depends on it. Source: `https://git-scm.com/download/win`. Includes Git Bash, the recommended terminal. Verify: `git --version` returns a version.

2. **Node.js installed via nvm-windows.** Node runs the JavaScript/TypeScript code that powers every tool. nvm-windows lets the laptop have multiple Node versions side-by-side and switch between them, so this builder is always on the same version as everyone else. Source: `https://github.com/coreybutler/nvm-windows/releases`. Install Node 20 via `nvm install 20` then `nvm use 20`. Verify: `node --version` returns `v20.x`.

3. **Bun installed.** Bun installs the libraries each tool depends on and runs the scripts that start each tool. The monorepo's commands all assume Bun is what's running them. Install via the official installer per `https://bun.sh/docs/installation` for Windows. Verify: `bun --version` returns a version.

4. **VS Code installed.** VS Code is the editor for writing and reviewing code. Source: `https://code.visualstudio.com/`. Install with default options. Verify: VS Code launches and `code --version` works from Git Bash.

5. **Claude Code VS Code extension installed.** The extension makes Claude Code available as a panel inside VS Code, where most of the builder's actual coding work happens. Install from the VS Code marketplace. Sign in with the builder's `@fitzrovia.ca` Claude Teams account, not a personal account — this matters because the Fitzrovia account is paid for and has access to the right models. Verify: the extension shows the Fitzrovia workspace as active.

6. **Git identity configured.** Tells Git who is making each commit. Set `user.name` to the builder's full name and `user.email` to their `@fitzrovia.ca` address. Verify: `git config --global --list` shows both correctly.

7. **Commit signing configured.** Vercel rejects unsigned commits — pushes from this laptop won't deploy unless commits are cryptographically signed. The setup is involved enough to deserve its own guide; follow `06-operations/commit-signing-setup.md` end to end before continuing. Verify: a test commit shows as "Verified" on GitHub.

8. **GitHub CLI installed and authenticated.** Lets the builder push code to GitHub from the laptop. The CLI's browser auth is simpler than other authentication methods. Source: `https://cli.github.com/`, Windows MSI installer. Run `gh auth login` and follow the browser flow. Verify: `gh repo list fitzrovia-residential` lists the org's repos including `fitzrovia-tools`.

9. **Monorepo cloned.** Pulls the code down to the laptop where the builder can work on it. Clone to `C:\code\fitzrovia-tools` (create the `C:\code` folder first if it doesn't exist). Use `gh repo clone fitzrovia-residential/fitzrovia-tools` or the equivalent `git clone` command. Verify: the folder exists and contains `apps/`, `packages/`, `package.json`.

10. **Dependencies installed.** Downloads the libraries each tool relies on into the `node_modules/` folder. The libraries aren't included in the repo itself; each builder regenerates them locally. From the monorepo root, run `bun install`. Verify: completes without errors and a `node_modules/` folder is created.

11. **Environment variables configured for the apps the builder will work on.** Real secrets (API keys, database URLs) need to be on the laptop for the tool to run, but they can't be in the code itself. `.env.local` is the local-only file that holds them. For each app under `apps/`, copy `env.example` to `.env.local` and fill in real values from Karim or Kenny (the password vault). Verify: `.env.local` exists in the relevant app folders, real values are in place, and the file is gitignored (it should not appear in `git status`).

12. **Tool runs locally.** Confirms the laptop can actually run the tool — the proof that all previous steps worked. From the monorepo root, run the app's dev command (typically `bun run dev:<app-name>` — the exact command is in the monorepo's root `package.json`). Verify: the terminal shows the dev server started, `http://localhost:3000` (or the specified port) loads the tool in a browser, and basic interaction works.

13. **Push test completed.** Confirms the laptop can push code back to GitHub — the proof that authentication and access are working end-to-end. Create a throwaway branch, make a trivial change, commit, and push. The commit should appear as "Verified" on GitHub (proof that signing is working). Then delete the branch locally and on GitHub. Do not open a PR.

---

## How Claude Chat should handle this

Suggested approach for Claude Chat when a builder asks for help with setup:

- **Take it one milestone at a time.** Don't dump all 13 milestones at once. Confirm each is verified before moving to the next.
- **Translate to Claude Code prompts where useful.** When a milestone involves running commands, give the builder the specific prompt to paste into Claude Code rather than expecting them to type the commands themselves.
- **Ask for screenshots when something looks off.** Windows quirks are real. A screenshot of the error message is faster than guessing.
- **Don't assume builder knowledge of terminal conventions.** Things like "open Git Bash," "press Enter after each command," or "the `$` is the prompt, don't type it" sometimes need to be said.
- **For environment variable values, route the builder to Karim or Kenny.** Don't generate placeholder values; don't suggest they "make something up." Real values come from the password vault.
- **If the builder hits something genuinely unfamiliar to Claude** (a Fitzrovia-specific network restriction, an Entra quirk), tell the builder to flag it to Karim or Kenny directly — that's a setup detail to capture in this document for next time.

---

## After setup

The builder is now ready to work on the codebase. They should skim these documents before starting their first real change:

- `04-standards/codebase-organization.md` — where things go in the monorepo
- `04-standards/branching-and-prs.md` — how to make a change
- `04-standards/pre-pr-checklist.md` — what to verify before opening a PR
- `00-foundations/operating-principles.md` — how the studio operates

These are reread at the moment of action, not memorised.

---

## What this document does NOT cover

- The infrastructure setup (GitHub repo creation, Vercel/Supabase/CodeRabbit configuration) — see `! handbook configuration list/handbook-configuration-list.md`
- The codebase structure — see `04-standards/codebase-organization.md`
- The branching and PR workflow — see `04-standards/branching-and-prs.md`
- Where production secrets live — they live in Vercel's dashboard, managed by Karim and Kenny
