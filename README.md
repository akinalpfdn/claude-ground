# claude-ground

A minimal rule system for Claude Code. Gives Claude the structural discipline it lacks by default — phase tracking, decision logging, honest pushback, debug discipline, language-specific best practices, and reusable skills.

---

## The problem

Claude Code is capable. But left to its own defaults it tends to:

- Lose track of the original plan mid-implementation
- Silently simplify or pivot when blocked, without asking
- Agree with you when it should push back
- Brute-force the same failed approach instead of stopping to think
- Modify existing code without understanding it first
- Skip tests or write superficial ones
- Use inline styles, hardcoded colors, and generic AI aesthetics

These aren't model failures — they're defaults that go unchallenged without explicit rules.

---

## What this does

**`rules/common/`** — Always active, every project:

| Rule file | What it does |
|-----------|-------------|
| `core.md` | Phase management, approval gates, honest opposition, time estimates, periodic analysis |
| `decisions.md` | Decision log format and rules |
| `git.md` | Branch strategy, conventional commits, commit discipline, versioning |
| `testing.md` | When to test, naming, structure, mocks vs integration, coverage |
| `debug.md` | Two-attempt rule, structured analysis, no error masking |
| `existing-code.md` | Read before touch, follow existing patterns, separate refactoring from features |
| `frontend.md` | Theme-first, no inline styles, intentional design (UI projects only) |

**`rules/[language]/`** — Language-specific best practices:

| Language | Key rules |
|----------|-----------|
| Go | Goroutine lifecycle, error wrapping, interface design, package structure, table-driven tests |
| Swift | MVVM structure, async/await + actors, memory management, error handling, testable ViewModels |
| TypeScript | Component granularity, API layer separation, strict types, state discipline, RTL testing |
| Kotlin | Coroutine scopes, sealed UI state, Compose theming, repository pattern, coroutine testing |
| Flutter | Widget granularity, state management, AppTheme, platform isolation, widget/golden tests |
| Rust | Ownership patterns, thiserror/anyhow, tokio consistency, unsafe discipline, proptest |
| Python | Type hints, project structure, custom exceptions, dependency management, pytest |
| .NET | Constructor DI, layered architecture, async + CancellationToken, Result pattern, Testcontainers |
| Spring | Constructor injection, layered architecture, exception handling, transactions, Testcontainers |

**`commands/`** — Reusable skills (slash commands):

| Skill | What it does |
|-------|-------------|
| `cg-mac-release` | Build, sign, notarize, and publish a macOS app as a GitHub release with a professional DMG |

All rules use **MUST / SHOULD / RECOMMENDED** severity levels so Claude knows what is a hard rule vs a best practice.

**`templates/`** — Starting point for new projects:

- `CLAUDE.md` — Project context file. Tech stack, architecture, active rules.
- `DECISIONS.md` — Empty decisions log, ready to fill.
- `phases/PHASE-01.md` — First phase template.

---

## Install

Three things get installed — they go to different places:

| What | Where | Effect |
|------|-------|--------|
| **Rules** | `~/.claude/rules/` (global) | Active in every project, every session |
| **Skills** | `~/.claude/commands/` (global) | Slash commands available everywhere |
| **Templates** | Current working directory | CLAUDE.md, DECISIONS.md, phases/ for one project |

Rules and skills are always global. Templates are always local to whatever directory you run the command from.

```bash
npm install -g claude-ground
```

No dependencies — uses only Node.js built-ins.

### Step 1 — Install rules + skills globally (once)

```bash
claudeground                       # interactive — pick languages + skills
claudeground install go typescript # non-interactive — specify languages directly
```

This installs common rules + your chosen language rules to `~/.claude/rules/`, and selected skills to `~/.claude/commands/`. Done once, works everywhere.

### Step 2 — Set up a project (per project)

From your project directory:

```bash
cd your-project
claudeground init                  # interactive — pick languages, skills, UI
claudeground init go swift         # non-interactive — specific languages
```

This asks if the project has a UI (to enable frontend rules), then creates:

```
your-project/
├── CLAUDE.md                        ← fill this in
├── DECISIONS.md                     ← log your first stack decision
└── .claude/
    ├── commands/                    ← project-level skills (if selected)
    │   └── cg-mac-release.md
    └── phases/
        └── PHASE-01-active.md       ← define your first phase
```

### Step 3 — Fill in CLAUDE.md

Open `CLAUDE.md` and fill in:
- What the project does
- Your tech stack and why
- Uncomment the language rules that apply
- Any project-specific constraints for Claude

### Updating

When you update the package (`npm update -g claude-ground`), re-apply your rules and skills:

```bash
claudeground update                # re-installs using your saved preferences
```

Your language and skill selections are saved to `~/.claude/.claude-ground.json` on first install — no need to re-select every time.

---

## Phase workflow

Long implementations use phase files to survive context resets:

```
.claude/phases/
├── PHASE-01-done.md       ← completed
├── PHASE-02-done.md       ← completed
├── PHASE-03-active.md     ← Claude reads this when context fills
└── PHASE-04-pending.md    ← not started
```

Each phase file contains: goal, task list, acceptance criteria. No code snippets — phases are goals, not implementations.

Claude checks the active phase file before continuing work. It will not start the next phase without your approval.

---

## Folder structure

```
claude-ground/
├── cli.js
├── package.json
├── rules/
│   ├── common/
│   │   ├── core.md            # phase management, approval gates, honest pushback
│   │   ├── decisions.md       # decision log format and rules
│   │   ├── git.md             # branch strategy, commits, versioning
│   │   ├── testing.md         # test discipline, naming, coverage
│   │   ├── debug.md           # two-attempt rule, structured analysis
│   │   ├── existing-code.md   # read before touch, pattern respect
│   │   └── frontend.md        # theme-first, intentional design (UI only)
│   ├── go/
│   │   └── go.md
│   ├── swift/
│   │   └── swift.md
│   ├── typescript/
│   │   └── typescript.md
│   ├── kotlin/
│   │   └── kotlin.md
│   ├── flutter/
│   │   └── flutter.md
│   ├── rust/
│   │   └── rust.md
│   ├── python/
│   │   └── python.md
│   ├── dotnet/
│   │   └── dotnet.md
│   └── spring/
│       └── spring.md
├── commands/
│   └── cg-mac-release.md         # macOS app release pipeline
└── templates/
    ├── CLAUDE.md
    ├── DECISIONS.md
    └── phases/
        └── PHASE-01.md
```

---

## Contributing

Rules should be:
- Specific enough to change behavior, not just remind Claude of good practices
- Language-idiomatic — written from the perspective of someone who knows the ecosystem well
- Free of code snippets that Claude would write anyway
- Tagged with severity: **MUST** (hard rule), **SHOULD** (best practice), **RECOMMENDED** (nice to have)

Skills should be:
- Generic — no hardcoded user-specific values, use placeholders
- Self-contained — one `.md` file per skill in `commands/`
- Production-focused — real workflows, not demos

New language rules, skills, corrections, and improvements are welcome.
