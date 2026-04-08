# OSS Repository Hygiene

Applies when publishing an open source project or managing a public repository.

---

## 1. Branch Protection [MUST]

- Use GitHub Rulesets (not legacy branch protection) on the default branch
- Block force pushes and branch deletion on main
- Require pull requests — even for solo maintainers (audit trail)
- Require CI status checks to pass before merge

## 2. Tag Protection [MUST]

- Protect `v*` tags with a tag ruleset — restrict deletions and updates
- Once a tag is published, it must never be moved — publish a new patch version instead

## 3. Commit Signing [SHOULD]

- Sign commits with SSH keys (`git config --global gpg.format ssh`)
- Add the key as a Signing Key on GitHub (not just Authentication)
- Use squash-and-merge as default merge method — preserves signature verification

## 4. Governance [MUST for public repos]

- `CONTRIBUTING.md` — how to contribute, development setup, commit convention
- `CODE_OF_CONDUCT.md` — use Contributor Covenant standard text
- `SECURITY.md` — private vulnerability reporting instructions (use GitHub's built-in)
- `LICENSE` — every public repo needs one; if unsure, use MIT

## 5. Automation [SHOULD]

- Enable Dependabot with grouping for minor/patch updates
- Pin GitHub Actions to full commit SHAs, not version tags
- Enable secret scanning and push protection
- Set up stale bot for issues (60 days) and PRs (30 days)

## 6. Repo Settings [SHOULD]

- Disable wikis (spam target unless actively used)
- Disable rebase merging (breaks signature verification)
- Enable auto-delete of head branches after merge
- Set workflow permissions to read-only by default
- Use noreply email for commits: `123456+username@users.noreply.github.com`

## Full Guide

For complete setup with ruleset config, issue/PR templates (YAML forms), CODEOWNERS, label taxonomy, triage workflow, release tagging, and incident response:
`~/.claude/commands/cg-oss-git-hygiene.md`
