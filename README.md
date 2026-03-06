# claude-ground

A minimal rule system for Claude Code. Gives Claude the structural discipline it lacks by default — phase tracking, decision logging, honest pushback, and language-specific best practices.

---

## The problem

Claude Code is capable. But left to its own defaults it tends to:

- Lose track of the original plan mid-implementation
- Silently simplify or pivot when blocked, without asking
- Agree with you when it should push back
- Use inline styles, hardcoded colors, and generic AI aesthetics
- Estimate time in human weeks instead of Claude sessions

These aren't model failures — they're defaults that go unchallenged without explicit rules.

---

## What this does

**`rules/common/`** — Loaded globally, active in every project:

- **Phase management** — One active phase at a time. Each phase is a file. Done phases are renamed, not deleted. Claude re-reads the active phase when context fills, so it never loses the plan.
- **Decision logging** — Every non-trivial technical choice gets written to `DECISIONS.md`: what was chosen, what was rejected, and why.
- **Approval gates** — Claude stops and presents options when blocked. It does not simplify silently.
- **Honest opposition** — Claude states disagreements directly, shows trade-offs even when you seem committed to an idea.
- **Time estimates** — In Claude sessions, not human weeks.
- **Periodic analysis** — At phase boundaries, Claude offers to check performance, security, SOLID violations, modularity, or structure — whichever you choose.

**`rules/common/frontend.md`** — For UI projects:

- No inline styles, colors, or fonts. Theme tokens first, components second.
- No generic AI aesthetics. A design direction is chosen before writing code.
- Centralized strings from day one.

**`rules/languages/`** — Language-specific best practices:

| Language | Key rules |
|----------|-----------|
| Go | Context propagation, goroutine lifecycle, error wrapping, package structure |
| Swift | MVVM structure, actor/async-await, memory management, project layout |
| TypeScript | Component granularity, API layer separation, strict types, state discipline |
| Kotlin | Coroutine scopes, ViewModel/UI state, Compose theming, repository pattern |
| Flutter | Widget granularity, state management consistency, AppTheme, platform isolation |
| Rust | Ownership patterns, thiserror/anyhow, tokio consistency, unsafe discipline |
| .NET | Constructor DI, layered architecture, async conventions, API versioning |
| Spring | Constructor injection, repository/service separation, exception handling, transactions |

**`templates/`** — Starting point for new projects:

- `CLAUDE.md` — Project context file. Tech stack, architecture, active rules.
- `DECISIONS.md` — Empty decisions log, ready to fill.
- `phases/PHASE-01.md` — First phase template.

---

## Install

```bash
git clone https://github.com/your-username/claude-ground
cd claude-ground
node install.js
```

Or specify languages directly (non-interactive):

```bash
node install.js go swift
node install.js typescript kotlin
node install.js --project go   # project-scoped, installs to .claude/rules/
```

No dependencies. Uses only Node.js built-ins — no `npm install` needed.

**Global install** — rules go to `~/.claude/rules/`, active in all projects.  
**Project install** (`--project`) — rules go to `.claude/rules/`, active in this project only.

Common rules are always installed. You choose which language rules to add.

---

## Project setup

After installing, run from your project directory:

```bash
node /path/to/claude-ground/install.js --project go
```

Answer `y` when asked about templates. This creates:

```
your-project/
├── CLAUDE.md                        ← fill this in
├── DECISIONS.md                     ← log your first stack decision
└── .claude/
    └── phases/
        └── PHASE-01-active.md       ← define your first phase
```

Open `CLAUDE.md` and fill in:
- What the project does
- Your tech stack and why
- Any project-specific constraints for Claude

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
├── install.sh
├── rules/
│   ├── common/
│   │   ├── core.md          # phase management, approval gates, honest pushback
│   │   ├── frontend.md      # theme-first, no inline styles, no generic aesthetics
│   │   └── decisions.md     # decision log format and rules
│   └── [language]/
│       └── [language].md
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

New language rules, corrections, and improvements are welcome.
