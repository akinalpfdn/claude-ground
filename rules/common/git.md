# Git Rules

Applies to every project regardless of team size.

---

## 1. Branch Strategy

**Team projects [MUST]:** Never commit directly to `main`. Every change goes through a branch and a PR.

**Solo projects [SHOULD]:** Use feature branches for non-trivial work. During early prototyping or single-session MVP work, committing directly to `main` is acceptable — but once the project has real users or production deployments, treat it as a team project.

Branch naming — lowercase, hyphen-separated, max 50 characters:
```
feature/user-auth
feature/screen-sharing-input
fix/goroutine-leak-in-session
chore/update-livekit-sdk
refactor/split-user-service
```

One branch = one concern. If a branch is doing two things, it should be two branches.

Delete branches after merge — remote and local:
```bash
git push origin --delete feature/user-auth
git branch -d feature/user-auth
```

---

## 2. Commit Messages — Conventional Commits [MUST]

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Types:
| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `chore` | Dependencies, build, tooling |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |
| `style` | Formatting, no logic change |

Examples:
```
feat(auth): add JWT refresh token rotation
fix(session): prevent goroutine leak on disconnect
refactor(user): split UserService into Reader and Writer
chore(deps): upgrade livekit-server-sdk to v1.4.0
test(api): add table-driven tests for user handler
```

Rules:
- Description is lowercase, imperative tense, no period at the end
- Max 72 characters on the first line
- Body explains *why*, not *what* — the diff already shows what
- Breaking changes: `feat(api)!: remove v1 endpoints`

Forbidden:
```
fix stuff
update
WIP
final
final2
asdfgh
```

---

## 3. Commit Discipline [MUST]

Commits are atomic — one logical change per commit. A commit must be revertable without breaking unrelated functionality.

Never commit:
- Commented-out code
- Hardcoded secrets or credentials
- Unresolved merge conflict markers
- Files that belong in `.gitignore`

Before every commit, scan staged changes for common mistakes:
```bash
git diff --staged | grep -E "(console\.log|fmt\.Print|debugger|print\(|TODO|FIXME|\.env)"
```

This catches debug statements and accidental secret exposure before they land in history.

---

## 4. Versioning and Phase Tagging [SHOULD]

Every project uses `MAJOR.MINOR.PATCH`:

| Increment | When |
|-----------|------|
| `MAJOR` | Breaking change |
| `MINOR` | New feature, backward compatible |
| `PATCH` | Bug fix, backward compatible |

Phase boundaries are minor version increments. Tag the state at the end of each phase:
```bash
git tag -a v0.2.0 -m "Phase 2 complete: LiveKit integration, 1080p/30fps screen sharing"
git push origin v0.2.0
```

This maps the phase system directly onto version history — rolling back to any phase boundary is a single checkout.

Annotated tags only (`-a`). Never lightweight tags.

---

## 5. Merge Strategy [SHOULD]

Document your merge strategy in `DECISIONS.md` at project start. The options:

| Strategy | Use when |
|----------|----------|
| Squash merge | Feature branches with messy interim commits — keeps `main` history clean |
| Merge commit | You want to preserve the full branch history |
| Rebase | You want a linear history without merge commits |

Pick one and stick to it. Mixed strategies in the same repo create confusing history.

Before pushing after a rebase or merge, review what is actually going out:
```bash
git log --oneline origin/main..HEAD
```

---

## 6. .gitignore Discipline [MUST]

`.gitignore` is created at project initialization — not after accidentally committing something wrong.

Standard entries for every project:
```
.env
.env.local
.env.*.local
*.log
.DS_Store
Thumbs.db
```

IDE-specific files (`.vscode/`, `.idea/`) go in a global gitignore, not the project `.gitignore`.

Never commit `.env`. If it happens, treat it as a secret leak — rotate the credentials, do not just remove the file in the next commit.