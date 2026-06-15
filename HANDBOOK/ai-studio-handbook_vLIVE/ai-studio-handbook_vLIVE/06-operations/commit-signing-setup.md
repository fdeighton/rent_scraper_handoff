# Commit signing setup

**Path:** `06-operations/commit-signing-setup.md`

**Last updated:** May 6, 2026
**Owner:** Karim Mourad

---

## TL;DR

Generate one SSH key (no passphrase), upload to GitHub twice (once as Authentication, once as Signing), update three config files. ~5 minutes.

After setup, every commit signs and pushes silently. No passphrase prompts.

---

## Why commit signing is required

Vercel rejects unsigned Git commits — builds fail and deployments don't happen. Every builder configures commit signing once on their laptop before they can push.

The control prevents pushed commits with spoofed author identities. GitHub usernames can be faked; cryptographic signatures cannot. At Fitzrovia's scale this is one defence layered behind GitHub branch protection, CodeRabbit's required check, and CODEOWNERS approval — not the primary guardrail.

---

## Why no passphrase

Earlier setups used two SSH keys (signing + auth) with passphrases on both. Reality: that produced 4 prompts per commit-and-push cycle and added friction that compounded daily.

The simpler model — one key, no passphrase — works because the actual security comes from layers we already have: BitLocker disk encryption (or equivalent) on the laptop, the Windows password to log in, GitHub branch protection (no direct pushes to `main`), CODEOWNERS approval required before merge, and CodeRabbit's required status check. The SSH passphrase added a small layer on top of all that. The friction cost outweighed the security benefit.

---

## Before you start

You'll need:
- Git ≥ 2.34 (verify with `git --version` in Git Bash)
- A GitHub account that's a member of the `fitzrovia-residential` organisation
- ~5 minutes
- Microsoft Authenticator on your phone (for sudo-mode 2FA when uploading the key to GitHub)
- Git Bash open (it comes with Git for Windows). Use Git Bash for these commands — not PowerShell, CMD, Windows Terminal, or VS Code's integrated terminal.

You'll create one SSH key at `~/.ssh/fitzrovia` (private + public halves), an `allowed_signers` file at `~/.ssh/allowed_signers`, and an SSH config block at `~/.ssh/config`.

---

## Step 1 — Generate the key

In Git Bash:

```
ssh-keygen -t ed25519 -C "yourname@fitzrovia.ca" -f ~/.ssh/fitzrovia -N ""
```

Replace `yourname@fitzrovia.ca` with your Fitzrovia email. The `-N ""` flag means no passphrase. Two files appear: `~/.ssh/fitzrovia` (private, stays on your laptop) and `~/.ssh/fitzrovia.pub` (public, what GitHub gets).

---

## Step 2 — Upload the key to GitHub (twice)

Copy the public key:

```
cat ~/.ssh/fitzrovia.pub | clip
```

Open `https://github.com/settings/keys`. **Verify the avatar in the top-right is your Fitzrovia GitHub account.**

Click **New SSH key**:
- **Title:** `Fitzrovia Laptop — Combined Key`
- **Key type:** **Authentication Key** (default)
- **Key:** paste

Click **Add SSH key**, complete sudo-mode 2FA if prompted.

Click **New SSH key** again to upload the same key as a signing key:
- **Title:** same as above (GitHub allows duplicates across key types)
- **Key type:** **Signing Key** ← change this from the default
- **Key:** paste again

Click **Add SSH key**, complete 2FA if prompted.

You should now see the same fingerprint listed once under "Authentication keys" and once under "Signing keys."

---

## Step 3 — Configure Git to sign with this key

```
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/fitzrovia.pub
git config --global commit.gpgsign true
```

The naming `gpg.format` is a Git historical quirk — Git supported GPG before SSH and kept the same config namespace. We're using SSH despite the name.

Verify:

```
git config --global --list | grep -E "signing|gpg|user\.email|user\.name"
```

You should see five lines: `user.name`, `user.email`, `gpg.format=ssh`, `user.signingkey=...`, `commit.gpgsign=true`. If `user.name` looks weird (system identifier instead of your full name), fix it:

```
git config --global user.name "Your Full Name"
```

---

## Step 4 — Create the allowed_signers file

This file maps email addresses to public keys, so Git can verify signatures locally with `git log --show-signature`. (GitHub verifies them server-side regardless; this is just for local checks.)

```
echo "yourname@fitzrovia.ca $(cat ~/.ssh/fitzrovia.pub | awk '{print $1, $2}')" > ~/.ssh/allowed_signers
```

Replace `yourname@fitzrovia.ca` with your Fitzrovia email — must match what's in your Git config.

Tell Git where the file lives:

```
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

---

## Step 5 — Configure SSH for GitHub

```
cat >> ~/.ssh/config << 'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/fitzrovia
  IdentitiesOnly yes
EOF
```

`IdentitiesOnly yes` matters — without it, SSH tries every key it knows about, which can fail in confusing ways if multiple keys exist.

Verify:

```
cat ~/.ssh/config
```

You should see the github.com block at the bottom.

---

## Step 6 — Verify GitHub CLI is authenticated to the right account

```
gh auth status
```

If logged in to your Fitzrovia GitHub account, you're good. If logged in to a personal account:

```
gh auth logout
gh auth login
```

Selections during `gh auth login`:
1. **Where do you use GitHub?** → GitHub.com
2. **Preferred protocol for Git operations?** → **SSH**
3. **Upload your SSH public key to your GitHub account?** → **Skip** ← any other choice will offer to upload your signing key as an authentication key; we already uploaded both manually in step 2
4. **How would you like to authenticate GitHub CLI?** → **Login with a web browser**

Before pasting the one-time code in the browser, **verify the GitHub avatar at the top is your Fitzrovia account, not a personal one.**

---

## Step 7 — Test it works

```
ssh -T git@github.com
```

Expected: `Hi [your-username]! You've successfully authenticated...`. No passphrase prompt. (First time you connect, you may be asked to verify the host key fingerprint — type `yes`.)

Now a real signed commit:

```
mkdir ~/sign-test && cd ~/sign-test
git init
echo "Test signed commit" > test.txt
git add test.txt && git commit -m "Test signed commit"
git log --show-signature
```

The commit should succeed silently — **no passphrase prompt**. `git log --show-signature` should show `Good "git" signature for [your-email]`.

Push it to verify GitHub-side works:

```
gh repo create [your-username]/signing-test --private --description "Throwaway test" --source=. --push
```

Open the new repo in your browser, click into the commit, look for the green **Verified** badge. That's full success — Vercel's "Require Verified Commits" check will pass on every commit you push from now on.

---

## Cleanup the test

```
gh repo delete [your-username]/signing-test --yes
cd ~ && rm -rf ~/sign-test
```

If `gh repo delete` says you don't have permission, run `gh auth refresh -h github.com -s delete_repo` and try again.

---

## You're done

Every commit you make from this laptop is now signed automatically. Every push goes through silently. Vercel accepts all commits.

---

## Common issues

**"Permission denied (publickey)" when pushing.** SSH can't authenticate. Check that the key is uploaded to GitHub as an Authentication Key (step 2) and that `~/.ssh/config` contains the github.com block (step 5). Run `ssh -T git@github.com` to test the connection independently.

**"No signature" or "gpg.ssh.allowedSignersFile needs to be configured."** Step 4 wasn't completed or the path is wrong. Verify with `git config --global gpg.ssh.allowedSignersFile`.

**Commit shows "Unverified" on GitHub instead of "Verified."** Most common cause: the email in the commit doesn't match a verified email on your GitHub account. Run `git config --global user.email`; check it's listed under your verified emails in GitHub Settings → Emails.

**Multiple GitHub accounts on the same laptop.** SSH config routes github.com to one specific account; `gh` CLI authenticates one at a time. If you need multiple GitHub accounts on the same laptop, ask Karim — there are SSH tricks for it beyond standard setup.

**Lost the key file.** Generate a new one (`ssh-keygen` again with the same filename, accept overwrite), upload to GitHub as both Authentication and Signing, update the allowed_signers file. Old commits stay signed by the old key (which GitHub no longer recognizes); new commits use the new one.
