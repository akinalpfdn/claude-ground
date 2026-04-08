---
name: cg-oss-git-hygiene
description: Set up an open source repository for healthy long-term maintenance — branch protection, commit signing, tag immutability, issue and PR templates, CODEOWNERS, CONTRIBUTING.md, SECURITY.md, Dependabot, stale bot, and triage workflow. Use when the user is publishing an open source project, mentions branch protection, rulesets, signed commits, tag protection, issue templates, PR templates, CODEOWNERS, CONTRIBUTING, code of conduct, SECURITY.md, vulnerability disclosure, Dependabot, stale issues, triage, "how do I prevent my repo from being hijacked", or "how do I manage contributors". NOT for code-level security (use cg-security-hardening), CI/CD pipeline construction, or paid GitHub Enterprise features.
---

# cg-oss-git-hygiene

Set up a public repository so it can survive its own success: protected from accidental damage, accidental compromise, and contributor chaos. Targets indie developers and small teams shipping open source projects who do not want to wake up to a hijacked main branch, a thousand spam issues, or a year-old stale PR backlog.

## Scope

**This skill covers:**
- Branch protection and rulesets (main branch is sacred)
- Tag protection (releases must be immutable)
- Commit signing (SSH or GPG verification)
- CODEOWNERS for review routing
- Issue templates (bug, feature, question, security)
- Pull request templates with checklists
- Label taxonomy for triage
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Vulnerability disclosure policy
- Dependabot / Renovate setup for security updates
- Stale issue and PR management
- Triage workflow for solo or small-team maintainers
- Release tagging and changelog conventions
- Repo settings hardening (force push, deletion, etc.)

**This skill does NOT cover:**
- Application-level security (use `cg-security-hardening`)
- CI/CD pipeline construction itself (a separate concern; this skill assumes CI exists)
- GitHub Enterprise-only features (rulesets are GA but some advanced controls are paid)
- Self-hosted Git platforms (Gitea, Forgejo, GitLab self-managed) — the principles apply but the UI differs
- Monorepo governance with multiple sub-projects
- Maintainer succession planning, project foundations, governance models

If the user runs a hosted Git platform other than GitHub.com, the underlying principles still apply but commands and screenshots will differ.

## Required context — gather before generating anything

MUST have answers to these before producing files or settings. Ask the user directly if unclear.

1. **Solo maintainer or small team?** — affects review requirements:
   - Solo → cannot require external approvals (you'd block yourself); use other gates (CI, signed commits, ruleset bypass list)
   - 2-5 people → require 1 approval, dismiss stale reviews on new commits
   - Larger team → require 2 approvals, CODEOWNERS routing

2. **Public or private repo?**
   - Public → full hardening matters; spam and drive-by attacks are real
   - Private → still set up branch protection, but issue templates and stale bots matter less

3. **Will the project accept external contributions?**
   - Yes → CONTRIBUTING.md is mandatory, issue templates are mandatory
   - No (read-only OSS) → reduce contribution surface, add a banner explaining this

4. **Does the project have releases?**
   - Yes → tag protection is critical, signed tags strongly recommended, changelog convention needed
   - No → tag protection still valuable, but lighter setup

5. **Is there sensitive code (security tools, crypto, auth libraries)?**
   - Yes → require signed commits, enable secret scanning, write a thorough SECURITY.md, consider private vulnerability reporting
   - No → standard hardening is enough

6. **Does the user already have an existing repo with damage?** — affects approach:
   - Fresh repo → set everything up at once, no existing PRs/issues to migrate
   - Existing repo with mess → incremental cleanup, do not break existing workflows abruptly

## The seven pillars of OSS repo hygiene

Ordered by impact-to-effort ratio. Start from pillar 1.

### Pillar 1 — Branch protection and rulesets (highest priority)

**Why first**: This is the single setting that prevents the worst outcomes (force-push erasing history, accidental direct commits to main, hijacked main branch via leaked credentials). Set this up before the project gets its first star.

**Use Rulesets, not the legacy "Branch protection rules"** — Rulesets are GitHub's current recommendation, more powerful and composable. Legacy rules still work but are being phased out for new repos.

**Essential ruleset for the default branch (`main` / `master`)**:

| Setting | Recommended value | Why |
|---|---|---|
| Restrict deletions | ✅ enabled | Nobody accidentally deletes main |
| Block force pushes | ✅ enabled | Prevent history rewriting attacks |
| Require linear history | ✅ enabled (optional) | Cleaner history, easier to audit |
| Require pull request before merging | ✅ enabled | Even solo maintainers benefit from PR audit trail |
| Required approvals | 1 (small team), 0 (solo with bypass) | Forces review checkpoint |
| Dismiss stale approvals on new commits | ✅ enabled | Prevents approval-then-rewrite attack |
| Require review from CODEOWNERS | ✅ enabled (if CODEOWNERS exists) | Subject matter experts review their areas |
| Require conversation resolution | ✅ enabled | Forces actual discussion completion before merge |
| Require status checks to pass | ✅ enabled (list specific checks) | CI must pass, no broken main |
| Require branches to be up to date before merging | ✅ enabled | Catches integration bugs before merge |
| Require signed commits | ✅ enabled | See pillar 3 |
| Require deployments to succeed | ⚠️ only if you have a staging deploy | Prevents broken prod releases |
| Lock branch | ❌ disabled (only for archived branches) | Read-only branches can't be merged into |
| Restrict who can push | Solo: bypass list of yourself; Team: empty (PRs only) | Avoids direct push as escape hatch |

**Solo maintainer pattern**: You cannot be the one approving your own PR (GitHub doesn't allow this). Two options:
1. **Bypass list**: Add yourself to the ruleset's bypass list. PRs are still required for everyone else; you can push directly when needed but should still use PRs for the audit trail.
2. **Zero required approvals**: Require a PR but require zero approvals. CI checks become the only gate. This is fine for solo dev when CI is thorough.

**Setting up via UI**:
1. Repository → Settings → Rules → Rulesets → New ruleset → New branch ruleset
2. Name it `main-protection` or similar
3. Enforcement status: **Active** (not Evaluate, which is dry-run only)
4. Target branches: Include default branch (or explicit `main`)
5. Bypass list: empty for teams, your username only for solo
6. Branch rules: enable everything from the table above
7. Save

**Setting up via API/CLI** (for repeatable setup across multiple repos):
```bash
# Using gh CLI
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/{owner}/{repo}/rulesets \
  -f name='main-protection' \
  -f target='branch' \
  -f enforcement='active' \
  -f 'conditions[ref_name][include][]=~DEFAULT_BRANCH' \
  -f 'rules[][type]=deletion' \
  -f 'rules[][type]=non_fast_forward' \
  -f 'rules[][type]=pull_request' \
  -f 'rules[][type]=required_signatures'
```

**Verification**:
- Try to push directly to main → should be rejected
- Try to force push to main → should be rejected
- Try to delete main from the GitHub UI → should be rejected
- Open a PR with failing CI → merge button should be disabled

### Pillar 2 — Tag protection (releases must be immutable)

**Why this matters**: A common supply chain attack is to publish a release tag, get users to depend on it, then quietly retag the same version with malicious code. Once package managers and users have downloaded the original, they continue trusting the tag name. Tag protection prevents this.

**Setup**:
1. Settings → Rules → Rulesets → New ruleset → New tag ruleset
2. Name: `release-tag-protection`
3. Target tags: Include by pattern → `v*` (covers `v1.0.0`, `v2.3.4-beta` etc.)
4. Rules:
   - **Restrict deletions**: ✅ enabled (no deleting published tags)
   - **Restrict updates**: ✅ enabled (no moving tags to point at different commits)
   - **Require signed commits**: ✅ enabled (if commit signing is enforced)
5. Bypass list: empty (no exceptions)
6. Save

**Effect**: Once a tag is created, nobody can move or delete it — not even repo admins. If you make a mistake and need to fix a release, you publish a new patch version (`v1.0.1`), never retag.

**Verification**:
```bash
git tag v1.0.0 abc1234
git push origin v1.0.0
# Now try to move it
git tag -f v1.0.0 def5678
git push --force origin v1.0.0
# Should be rejected
```

### Pillar 3 — Commit signing (verify the author is who they claim to be)

**Why this matters**: Without signing, anyone can push a commit with any author name and email. `git commit --author="Linus Torvalds <torvalds@linux-foundation.org>"` works for anyone. Signed commits cryptographically prove the commit was created by someone holding a specific key.

**Two options**: GPG or SSH. SSH is simpler and recommended for indie scale because most developers already have an SSH key for GitHub authentication.

**SSH commit signing setup** (per developer):
```bash
# Use existing SSH key or generate a new one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Configure git to sign with SSH
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Verify it works
git commit --allow-empty -m "test signed commit"
git log --show-signature -1
```

**Add the key as a signing key on GitHub**:
1. GitHub → Settings → SSH and GPG keys → New SSH key
2. **Important**: set "Key type" to **Signing Key** (not Authentication Key — same key text, different purpose)
3. Paste the public key
4. Save

GitHub will now show "Verified" next to your commits.

**Enforce signing on the repository** (in the ruleset from Pillar 1):
- Enable "Require signed commits"
- All future commits to the protected branch must be signed and verified

**Edge case — merge methods and signing**:
- **Squash and merge**: GitHub creates the squash commit and signs it as `web-flow` (its own bot). Verified.
- **Rebase and merge**: Original commits are added without re-signing. May break verification. Workaround: rebase locally, then push.
- **Merge commit**: Original commits are preserved with their original signatures. The merge commit itself is signed by `web-flow`. Verified.

For most indie OSS projects, **squash and merge** is the recommended default — it gives clean history and preserves verification.

### Pillar 4 — Repository hardening settings

A few non-obvious repo settings that should be tightened on every public repo.

**Settings → General**:
- ❌ Wikis: disable unless you actually use them (spam target)
- ✅ Issues: enabled (with templates — see pillar 5)
- ✅ Discussions: enable if community is active
- ❌ Allow merge commits: disable (use squash for cleaner history)
- ✅ Allow squash merging: enable (default)
- ❌ Allow rebase merging: disable (signature verification issues)
- ✅ Always suggest updating pull request branches
- ✅ Allow auto-merge (for bots, after all checks pass)
- ✅ Automatically delete head branches (cleans up after merged PRs)

**Settings → Code security**:
- ✅ Dependency graph: enabled (free, required for Dependabot)
- ✅ Dependabot alerts: enabled
- ✅ Dependabot security updates: enabled (auto-PRs for known CVEs)
- ✅ Secret scanning: enabled (free for public repos)
- ✅ Push protection (block commits containing secrets): enabled
- ✅ Private vulnerability reporting: enabled (lets researchers report issues privately)

**Settings → Actions → General**:
- Workflow permissions: **Read repository contents and packages permissions** (least privilege default; PRs that need write must request it explicitly)
- Allow GitHub Actions to create and approve pull requests: ❌ disabled unless you have a specific automation that needs it
- Fork pull request workflows: **Require approval for first-time contributors** at minimum

**Settings → Actions → Security (third-party actions)**:
- Pin third-party actions to full commit SHAs, not version tags. Tags can be moved (same retag attack as Pillar 2):
  ```yaml
  # ❌ Tag can be moved to point at malicious code
  uses: actions/checkout@v4

  # ✅ SHA is immutable
  uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
  ```
- Dependabot's `github-actions` ecosystem will automatically PR SHA updates when new versions are released — this is why it's in the dependabot.yml config.

### Pillar 5 — Issue and PR templates

**Why templates matter**: Without templates, you get issues like "it doesn't work" with no version, no repro, no logs. Templates force the reporter to provide what you need before they can submit, saving hours of back-and-forth.

**Folder structure**:
```
.github/
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml
│   ├── feature_request.yml
│   ├── question.yml
│   └── config.yml
├── pull_request_template.md
├── CODEOWNERS
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── dependabot.yml
```

**`bug_report.yml`** — use the YAML form syntax (better UX than markdown):
```yaml
name: Bug Report
description: Report something that isn't working
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to file a bug report. Please search existing issues first.

  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear and concise description of the bug.
      placeholder: When I do X, Y happens instead of Z.
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: Minimum steps needed to reproduce the issue.
      placeholder: |
        1. Run `command`
        2. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: What version of the project are you using?
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - macOS
        - Linux
        - Windows
        - Other
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: Paste any relevant log output.
      render: shell
```

**`feature_request.yml`**:
```yaml
name: Feature Request
description: Suggest a new feature or enhancement
labels: ["enhancement", "triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: What problem does this solve?
      description: Describe the problem you're trying to solve, not the solution you have in mind.
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: How would you like this to work?
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: What other approaches have you thought about?

  - type: checkboxes
    id: contribution
    attributes:
      label: Contribution
      options:
        - label: I'd be willing to submit a PR for this feature
```

**`config.yml`** — disables blank issues and adds external links:
```yaml
blank_issues_enabled: false
contact_links:
  - name: Question or discussion
    url: https://github.com/OWNER/REPO/discussions
    about: Ask questions and discuss ideas in Discussions
  - name: Security vulnerability
    url: https://github.com/OWNER/REPO/security/advisories/new
    about: Report security issues privately, never in public issues
```

**`pull_request_template.md`**:
```markdown
## What does this change?

<!-- Brief description of the change. -->

## Why is it needed?

<!-- Link to the issue or describe the problem. -->

Closes #

## How was it tested?

<!-- Describe how you verified the change works. -->

## Checklist

- [ ] I have read CONTRIBUTING.md
- [ ] Tests added or updated
- [ ] Documentation updated if behavior changed
- [ ] Commits are signed
- [ ] CI passes locally
```

### Pillar 6 — Governance documents

The three files every public repo should have. Each takes 30 minutes to write or copy from a template.

**`CONTRIBUTING.md`** — what contributors need to know:
```markdown
# Contributing to <Project>

Thanks for your interest in contributing! This document explains how to get started.

## Before you start

- Search [existing issues](../../issues) to make sure your bug or feature isn't already tracked.
- For significant changes, open an issue first to discuss the approach. PRs that don't match the project's direction may be closed.
- Make sure you've read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/REPO.git`
3. Install dependencies: `<command>`
4. Run tests: `<command>`
5. Create a branch: `git checkout -b your-feature-name`

## Making changes

- Follow the existing code style. We use `<formatter>` and `<linter>`.
- Write tests for new functionality.
- Keep PRs focused — one logical change per PR.
- Sign your commits (see [signed commits guide](#signed-commits)).

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add new export format`
- `fix: handle empty input in parser`
- `docs: clarify installation steps`
- `chore: update dependencies`

## Submitting a pull request

1. Push your branch to your fork
2. Open a PR against `main`
3. Fill in the PR template completely
4. Wait for CI to pass
5. Respond to review feedback

## What to expect

- I review PRs within ~7 days. Sometimes faster, sometimes slower.
- Not every PR will be merged. If it doesn't fit the project direction, I'll explain why.
- Contributors are credited in release notes.

## Reporting security issues

Do NOT open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).
```

**`CODE_OF_CONDUCT.md`** — use the [Contributor Covenant](https://www.contributor-covenant.org/) standard text. Don't write your own. Copy verbatim from `https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md`, replace the contact email, commit.

**`SECURITY.md`** — vulnerability disclosure policy:
```markdown
# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this project, please report it privately. **Do not open a public issue.**

### How to report

Use GitHub's private vulnerability reporting:
1. Go to the [Security tab](../../security)
2. Click "Report a vulnerability"
3. Fill in the form with as much detail as possible

Alternatively, email: security@example.com

### What to include

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Any suggested fix (optional)

### What to expect

- I will acknowledge receipt within 7 days.
- I will provide an initial assessment within 14 days.
- I aim to release a fix within 90 days for critical issues.
- I will credit you in the release notes (unless you prefer to remain anonymous).

## Supported versions

Only the latest minor version receives security updates.

| Version | Supported |
|---|---|
| 2.x     | ✅ |
| 1.x     | ❌ |
| < 1.0   | ❌ |
```

### Pillar 7 — CODEOWNERS and review routing

`CODEOWNERS` automatically requests reviews from the right people based on which files a PR touches. Even for solo maintainers, this is useful as a documentation of who is responsible for what.

**`.github/CODEOWNERS`**:
```
# Default owner for everything not matched below
* @your-username

# Documentation
*.md @your-username @docs-contributor

# Critical security paths
/auth/ @your-username
/crypto/ @your-username
.github/ @your-username

# Frontend
/web/ @frontend-contributor

# Database migrations need extra eyes
/migrations/ @your-username @db-contributor
```

**Combined with the branch protection ruleset**: enable "Require review from CODEOWNERS" so PRs touching protected paths must be approved by the listed owners.

**Solo maintainer note**: Even with just yourself in CODEOWNERS, this acts as documentation for future contributors and prevents drive-by approvals from random outside reviewers being treated as authoritative.

## Dependency automation

**Dependabot** is the recommended choice — free, GitHub-native, no setup beyond a config file.

**`.github/dependabot.yml`**:
```yaml
version: 2
updates:
  # Application dependencies — adjust ecosystem to your stack
  - package-ecosystem: "npm"  # or "pip", "gomod", "cargo", "maven", "nuget", etc.
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    commit-message:
      prefix: "chore"
      include: "scope"
    groups:
      # Group all minor and patch updates into one PR per week
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  # GitHub Actions versions — pin to commit SHAs, get notified of updates
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "ci"

  # Docker base images
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Why grouping matters**: without grouping, Dependabot can open 30 PRs per week, each with one dependency update. Nobody reviews 30 PRs. Grouping gives you 1-2 PRs per week that are still reviewable.

**Auto-merge for safe updates**: combine Dependabot with auto-merge for patch updates that pass CI. Add a workflow:
```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Get Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2

      - name: Auto-merge patch updates
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Renovate** is the alternative for projects that need more control (custom schedules, complex grouping rules, support for more package ecosystems). Use Renovate if Dependabot's grouping isn't flexible enough.

## Triage workflow for solo and small-team maintainers

**Why this matters**: Without a triage process, the issue tracker becomes an unsearchable graveyard within 6 months. Maintainers burn out. New users see "47 open issues, oldest 2 years" and assume the project is dead.

**Label taxonomy** — start small, grow as needed:

| Label | Color | Purpose |
|---|---|---|
| `bug` | red | Confirmed bug |
| `enhancement` | blue | New feature or improvement |
| `documentation` | gray | Docs change |
| `question` | purple | User question, not actionable |
| `triage` | yellow | Needs maintainer attention |
| `needs-info` | orange | Waiting on reporter for more info |
| `good first issue` | green | Beginner-friendly, fully scoped |
| `help wanted` | green | Contributions welcome |
| `wontfix` | gray | Will not be addressed (with explanation) |
| `duplicate` | gray | Closed as duplicate of another |
| `stale` | gray | Auto-applied by stalebot |
| `priority: high` | dark red | Drop other work for this |
| `priority: low` | light blue | Nice to have |

**Triage workflow** (10-30 minutes per week for small projects):

1. **Filter to untriaged**: `is:open is:issue label:triage` (or `no:label`)
2. **For each issue**, decide:
   - **Duplicate?** → Close, link to original, thank reporter
   - **Question?** → Add `question` label, redirect to Discussions if applicable
   - **Insufficient info?** → Add `needs-info`, ask specific questions, set a 14-day reminder
   - **Confirmed bug or feature request?** → Add appropriate labels, remove `triage`, optionally assign milestone
   - **Out of scope?** → Add `wontfix`, explain politely, close
   - **Beginner-friendly?** → Add `good first issue` and `help wanted`, write a clear scope
3. **Periodically review old issues** with `needs-info` for 14+ days → close as stale

**Stale bot** — auto-handle dormant issues. `.github/workflows/stale.yml`:
```yaml
name: Mark stale issues and PRs

on:
  schedule:
    - cron: '0 0 * * *'  # daily at midnight UTC
  workflow_dispatch:

permissions:
  issues: write
  pull-requests: write

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v9
        with:
          # Issues
          stale-issue-message: |
            This issue has been automatically marked as stale because it has had no activity for 60 days.
            It will be closed in 14 days if no further activity occurs. If this is still relevant,
            please add a comment to keep it open.
          close-issue-message: |
            This issue has been automatically closed due to inactivity. Feel free to reopen if it's still relevant.
          days-before-issue-stale: 60
          days-before-issue-close: 14
          stale-issue-label: 'stale'
          exempt-issue-labels: 'priority: high,pinned,security'

          # PRs (more lenient)
          stale-pr-message: |
            This PR has been automatically marked as stale because it has had no activity for 30 days.
            It will be closed in 14 days if no further activity occurs.
          close-pr-message: |
            This PR has been automatically closed due to inactivity. Feel free to reopen with rebased commits.
          days-before-pr-stale: 30
          days-before-pr-close: 14
          stale-pr-label: 'stale'
          exempt-pr-labels: 'work-in-progress,blocked'
```

**Set realistic response time expectations** — write them in CONTRIBUTING.md. "I aim to triage within 7 days" is honest. Don't promise 24-hour response times if you can't deliver.

## Release tagging conventions

**Semantic Versioning (SemVer)** is the de facto standard for OSS releases. `MAJOR.MINOR.PATCH`:
- `MAJOR` — breaking changes (1.0 → 2.0)
- `MINOR` — new features, backward compatible (1.0 → 1.1)
- `PATCH` — bug fixes, backward compatible (1.0.0 → 1.0.1)

**Tag format**: prefix with `v` (`v1.2.3`, not `1.2.3`). This is convention and many tools assume it.

**Release workflow**:
```bash
# Tag locally with signing
git tag -s v1.2.3 -m "Release v1.2.3"

# Push the tag (will be protected — see Pillar 2)
git push origin v1.2.3

# Create GitHub release with notes
gh release create v1.2.3 --generate-notes
```

**Changelog convention**: Use [Keep a Changelog](https://keepachangelog.com/) format in `CHANGELOG.md`:
```markdown
# Changelog

## [Unreleased]

### Added
- New feature description

## [1.2.3] - 2026-04-15

### Added
- Feature X

### Changed
- Behavior Y now does Z

### Fixed
- Bug in component A

### Security
- Patched CVE-XXXX-YYYY

[Unreleased]: https://github.com/OWNER/REPO/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/OWNER/REPO/releases/tag/v1.2.3
```

**Auto-generate from commits** if you use Conventional Commits — tools like `release-please` (Google), `changesets` (npm ecosystem), `git-cliff` (language-agnostic) can produce changelogs automatically.

## Validation checklist

After setting up a repo, verify every item:

**Branch protection**
- [ ] Direct push to `main` is rejected
- [ ] Force push to `main` is rejected
- [ ] Deletion of `main` is rejected
- [ ] PR with failing CI cannot be merged
- [ ] PR without required approval cannot be merged (if applicable)

**Tag protection**
- [ ] Pushing a `v*` tag works
- [ ] Force-pushing the same tag with `--force` is rejected
- [ ] Deleting a `v*` tag is rejected

**Commit signing**
- [ ] New commits show "Verified" badge on GitHub
- [ ] Pushing an unsigned commit to `main` is rejected (if enforced)

**Templates**
- [ ] Opening a new issue shows the issue type chooser (no blank issues)
- [ ] Each template requires the right fields
- [ ] Opening a new PR pre-fills the PR template

**Governance docs**
- [ ] `CONTRIBUTING.md` exists at repo root or `.github/`
- [ ] `CODE_OF_CONDUCT.md` exists with valid contact email
- [ ] `SECURITY.md` exists with reporting instructions
- [ ] First-time contributor opening an issue sees a banner linking to CONTRIBUTING.md

**Automation**
- [ ] Dependabot is creating PRs for outdated dependencies
- [ ] Stale bot is configured (verify with `workflow_dispatch` test run)
- [ ] Secret scanning is enabled and push protection is on
- [ ] Private vulnerability reporting is enabled

**Repo hardening**
- [ ] Wikis disabled (unless used)
- [ ] Merge commits and rebase merging disabled (squash only)
- [ ] Auto-delete head branches enabled
- [ ] Workflow permissions set to read-only by default
- [ ] First-time contributor PR workflows require approval

## Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| No branch protection on a public repo | First leaked credential = hijacked main | Enable rulesets immediately, even before publicizing the project |
| Allowing rebase merge with required signatures | Signatures lost on merge | Use squash merge instead |
| Tag protection disabled | Supply chain attack via retag | Enable tag rulesets with `v*` pattern |
| `Allow GitHub Actions to create and approve PRs` enabled | Bot can self-approve PRs and bypass review | Disable unless specifically needed |
| Workflow permissions default to write-all | Compromised action has full repo access | Change default to read-only, escalate per workflow |
| No `dependabot.yml` | Known CVEs sit unpatched in production | Add config, enable Dependabot security updates |
| 30 dependabot PRs per week | Nobody reviews them, all merge dirty or rot | Use grouping to bundle minor/patch updates |
| Stalebot too aggressive (7 days) | Real bug reports closed before maintainer responds | 60 days for issues, 30 days for PRs is reasonable |
| `SECURITY.md` says "email security@..." but the email isn't monitored | Reports go into the void | Use GitHub's private vulnerability reporting instead |
| Commits show real email address | Spam target, harassment vector | Use GitHub's `noreply` email (see setup below) |
| Force-push allowed on `main` for "convenience" | History rewritten, signatures invalidated, contributors confused | Never. Branches with rewriting needed should be feature branches. |
| `CONTRIBUTING.md` is a wall of text nobody reads | Contributors don't follow it | Keep it short, scannable, with concrete commands |
| First-time contributor has to ask 3 questions before they can submit | Friction kills contributions | Issue templates that pre-fill the questions you'd ask |

## Noreply email setup

Commits in public repos expose your email in `git log`. Use GitHub's noreply address to prevent spam and harassment:

```bash
# Find your noreply address: GitHub → Settings → Emails → look for "123456+username@users.noreply.github.com"
git config --global user.email "123456+username@users.noreply.github.com"
```

Also enable these in GitHub → Settings → Emails:
- ✅ **Keep my email addresses private**
- ✅ **Block command line pushes that expose my email**

This rejects any push where your real email appears in a commit, preventing accidental exposure.

## License selection

Every public repo needs a LICENSE file. Without one, the code is technically "all rights reserved" regardless of being on a public platform.

**Quick decision tree for indie developers:**

| License | When to use | What it allows |
|---|---|---|
| **MIT** | Default for most projects. Maximum adoption, minimum friction. | Anything, with attribution |
| **Apache 2.0** | When you want patent protection in addition to copyright | Same as MIT + explicit patent grant |
| **GPL-3.0** | When you want derivatives to remain open source | Must share modifications under same license |
| **AGPL-3.0** | SaaS/server apps where GPL's "distribution" trigger doesn't apply | Even network use requires source sharing |
| **Unlicense / CC0** | When you truly don't care — public domain equivalent | Anything, no attribution needed |

**If unsure, use MIT.** It's the most common, most understood, and least likely to scare away contributors or corporate users. Add the file at project creation — not after the first contribution (retroactive licensing is messy).

```bash
# Quick setup
gh repo edit --add-license mit
# Or just create LICENSE file with the MIT text and your name + year
```

This skill does not provide legal advice. For complex licensing decisions (dual licensing, commercial + open source, contributor license agreements), consult a lawyer.

## What to do when something goes wrong

**Force push happened on main despite protection**: Should be impossible if rulesets are configured correctly. If it happened, an admin bypassed protection. Audit log will show who. Restore from a clone, rotate credentials of the bypasser if compromised.

**Tag was deleted/moved**: Should also be impossible. Same audit process. Republish the tag from the original commit if you have it locally; warn users that the original tag may have been compromised.

**Spam wave on issues**: Enable issue creation rate limiting (Settings → General → "Limit how often new accounts can post issues"). Use `actions/stale` more aggressively temporarily. Block specific users from the repo.

**Compromised dependency**: Run dependency audit (`npm audit`, `cargo audit`, etc.). Update or remove the package. Issue a security advisory via GitHub's private vulnerability reporting. Notify affected users via release notes.

**Maintainer account compromised**: Revoke all sessions in GitHub Settings → Sessions. Rotate SSH/GPG keys. Audit recent commits and revert anything suspicious. Re-enable 2FA if it was somehow disabled. Audit collaborator list and remove anything unfamiliar.

## Principles

- **The repo is a fortress, not a clubhouse.** Default to deny: nobody can push to main, nobody can move tags, nobody can delete history. Open up exceptions only when needed.
- **Templates pay for themselves in the first week.** Five minutes to write an issue template saves hours of "what version are you on?" round-trips.
- **Automation is a force multiplier for solo maintainers.** Dependabot, stale bot, auto-merge for patches, CI gates — these are the difference between "I maintain this" and "I am owned by this".
- **Set expectations honestly.** "I look at PRs once a week" is fine. "Response within 24 hours" is a lie that creates resentment.
- **Tag immutability is non-negotiable for libraries.** Other people depend on your version numbers staying the same.
- **Squash and merge gives you cleanest history.** It also preserves signature verification on the merge commit. Use it as the default.
- **Code of conduct is not optional.** It's not about expecting bad behavior — it's about having a clear answer when bad behavior happens.
- **Solo doesn't mean unhardened.** Most of the rules in this skill apply equally to a one-person project. The threats (credential leak, malicious PR, supply chain attack) don't care how many maintainers you have.
- **Triage is a habit, not a project.** 15 minutes a week beats 8 hours a quarter. Stale issues compound like debt.
