---
name: cg-devplan
description: Generate a structured development plan (devplan) for software projects. Use this skill whenever the user wants to plan a new app, feature, or project — including phrases like "plan this app", "create a devplan", "help me architect", "I want to build X", "let's plan out Y", "write a development plan", or any request that involves scoping, structuring, or roadmapping a software project before implementation. Also trigger when the user describes an app idea (even casually) and expects a structured plan as output. This skill is specifically designed for indie developers building macOS, iOS, Android, Windows, and cross-platform desktop/mobile applications.
---

# Devplan Skill

Generate development plans that Claude Code can directly follow to build a project. The devplan is not a tutorial for the developer — it is an instruction document for Claude Code.

## Who is this for

Indie developers who work with Claude Code. They describe an app idea in a few sentences, answer some clarifying questions, and receive a devplan file they drop into their project root. Then they tell Claude Code "follow this plan" and development begins.

## Core philosophy

The devplan must be:
- **An instruction document for Claude Code**, not a guide for the developer
- **Architecture-focused**, not code-focused — describe what to build and how to structure it, never include code snippets
- **Platform-aware** — account for real constraints of the target platform (sandboxing, permissions, API limitations, store requirements)
- **Atomic in phases** — each phase should be completable in a single Claude Code session
- **Opinionated about quality** — bake in engineering standards so the developer doesn't repeat them every time
- **Testable by default** — every phase has test criteria, not as afterthought but as definition of done

## Workflow

### Step 1: Collect the brief

The user provides a short description of what they want to build (3-10 sentences is typical). Accept whatever they give — don't demand a specific format.

**Important:** Determine whether this is a greenfield project or a feature addition to an existing codebase. If existing code is present, read the codebase first and document the current state before planning changes.

### Step 2: Ask clarifying questions

Before writing anything, ask questions to fill gaps. Ask only what you genuinely need — don't ask things you can reasonably infer. Typical gaps to probe:

- **Target platform(s)**: macOS, iOS, Android, Windows, cross-platform? Which framework if cross-platform (Tauri, Electron, Flutter, React Native)?
- **Core interaction model**: Menu bar app? Floating window? Full window? Widget? System tray? Background service?
- **Data story**: Local-only? Cloud sync? What kind of data, how much, how sensitive?
- **Distribution**: App Store, direct download, both? Open source?
- **Existing constraints**: Must it integrate with specific APIs, tools, or ecosystems? Any hard tech stack preferences?
- **Multi-language support**: Will the app need localization? Even if the user says "no" or "just English for now", note this decision in the plan — retrofitting localization into a codebase that wasn't designed for it is painful. If yes, which languages? This affects string architecture from day one.
- **Theming / appearance**: Dark mode only? Light + dark? User-customizable themes? System appearance following? This must be decided upfront because it shapes the entire styling architecture.
- **Prior art / inspiration**: Any existing app this is inspired by or competing with?

Do NOT ask about:
- Time estimates — they are meaningless with AI-assisted development
- Team size — assume solo indie dev with Claude Code
- Budget — irrelevant at planning stage
- Detailed UI mockups — architecture first, UI emerges from implementation

### Step 3: Generate the devplan

Write the devplan as a markdown file. The structure is below.

---

## Devplan structure

```markdown
# [App Name] — Development Plan

## Overview
What the app does in 2-3 sentences. Who it's for. Why it exists.

## Current State (if adding to existing project)
- What exists: [brief description of current codebase, key modules, patterns in use]
- What changes: [which areas this plan modifies or extends]
- What must not break: [existing functionality that must be preserved]
(Omit this section for greenfield projects.)

## Platform & Stack
- Target: [macOS / iOS / Android / cross-platform]
- Framework: [SwiftUI / UIKit / Jetpack Compose / Tauri / Flutter / etc.]
- Language: [Swift / Kotlin / Rust / Dart / TypeScript / etc.]
- Key dependencies: [list only critical ones with brief reason — log each choice in DECISIONS.md]
- Architecture: [MVVM / MVC / Clean Architecture / etc. — pick one and justify briefly]
- Design pattern notes: [Strategy, Observer, Coordinator — only if project warrants specific patterns]
- Localization: [None / Prepared for future / Active — list languages. If "prepared for future": all user-facing strings must go through a localization layer from day one, even if only one language ships initially]
- Theming: [Dark only / Light+Dark / System-following / User-customizable. All colors, fonts, spacing, and visual tokens must be defined in a central theme system — no hardcoded colors or font names anywhere in the codebase]

## Data Model
Core entities and their relationships. No code — describe in plain language.
- What are the main data objects?
- How do they relate to each other? (one-to-many, many-to-many, etc.)
- Where is data persisted? (SQLite, Core Data, SwiftData, Room, file system, UserDefaults/SharedPreferences)
- What is the migration strategy when the schema changes?
- What data is sensitive and needs encryption or secure storage?

## Constraints & Platform Considerations
Real, actionable constraints the developer will hit. Examples:
- macOS: Sandbox restrictions, entitlements needed, Accessibility API permissions, notarization requirements
- iOS: App Store review gotchas, background execution limits, widget limitations
- Android: SYSTEM_ALERT_WINDOW requirements, battery optimization behavior, Play Store policies
- Cross-platform: Platform-specific code paths, native API bridges needed

## Architecture
Describe the layer structure and data flow. No code — use plain language and optionally a simple ASCII diagram.
- What are the main modules/layers?
- How does data flow between them?
- Where does state live?
- What are the key abstractions?

For cross-platform projects: define the shared core first (business logic, data models, API layer), then describe platform-specific layers separately. Never plan "build iOS and Android simultaneously" — plan shared core, then each platform as its own phase.

## Feature Scope
List features grouped by priority:
### MVP (Phase 1-2)
- Feature A — brief description
- Feature B — brief description
### Post-MVP
- Feature C — brief description
- Feature D — brief description

## Testing Strategy
Define the testing approach upfront — not as a separate phase, but integrated into every implementation phase.

- **Unit tests**: Which modules/layers need unit tests? What's the minimum coverage target for business logic?
- **Integration tests**: Which component boundaries need integration tests? (e.g., repository ↔ database, service ↔ API)
- **UI tests**: Which critical user flows need automated UI tests?
- **Test framework**: [XCTest / pytest / JUnit / Flutter test / etc.]
- **Rule**: Every phase's acceptance criteria must include test criteria. A feature without tests is not done.

## Phases

### Phase 1: [Name]
**Goal**: One sentence describing what's true when this phase is complete.
**Delivers**: Concrete list of what exists after this phase.
**Scope**: Which modules/files this phase creates or modifies.
**Depends on**: Nothing / Phase N
**Acceptance criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
**Tests**:
- [ ] Unit: [what to test]
- [ ] Integration: [what to test, if applicable]

### Phase 2: [Name]
...same structure...

(Continue for all phases. Typically 3-6 phases for an MVP.)

## Spikes & Research Phases
When the plan involves unknowns that need investigation before implementation, use spike phases:

### Spike: [Name]
**Question**: What specific question does this spike answer?
**Timebox**: 1 session maximum.
**Deliverable**: A decision logged in DECISIONS.md and optionally a proof-of-concept in `spikes/`.
**Outcome feeds into**: Phase N

Mark unknowns in the plan with [SPIKE NEEDED] so Claude Code does not guess past them. Spikes produce decisions; implementation phases consume them. Never mix research and implementation in the same phase.

## Implementation Guidelines
These apply to ALL phases. Claude Code must follow these throughout development.

- Follow SOLID principles — especially Single Responsibility and Dependency Inversion
- Apply appropriate design patterns (Strategy, Observer, Factory, etc.) — don't force patterns where they add complexity without benefit
- Write clean, self-documenting code — no comments that restate what the code does. Comments only for "why", never "what"
- No hardcoded values — use constants, configuration, or environment variables
- **Theming must be centralized** — all colors, fonts, typography scales, spacing tokens, border radii, and shadows must be defined in a single theme source of truth. Components consume theme tokens, never raw values. This applies regardless of whether the app ships with one theme or ten. No `Color(hex: "#1A1A1A")` or `fontSize: 14` scattered in view code — always `Theme.colors.background` or `Theme.typography.body`
- **Localization-ready architecture** — all user-facing strings must go through a localization system, even if only one language ships at launch. No hardcoded strings in views or business logic. Use platform-native localization (NSLocalizedString / Localizable.xcstrings for Apple, strings.xml for Android, ARB for Flutter, i18n libraries for web). If the user explicitly opts out of localization, note this as a conscious trade-off in the plan
- **Testing is not optional** — every public function with business logic has a unit test. Every bug fix has a regression test. Every phase is not complete until its test criteria pass.
- Error handling must be explicit and meaningful — no silent catches, no generic error messages
- **Log architectural decisions** — when making a non-trivial choice (library, pattern, architecture), log it in DECISIONS.md with chosen/alternatives/why format
- If this is a public repository: generate a proper README.md, .gitignore appropriate to the stack, and LICENSE file
- Respect existing code patterns — when modifying existing code, read and understand the current patterns before changing anything

## Risks & Watch Items
Known unknowns. Things that could derail or require rethinking. Platform API changes, dependency stability, performance bottlenecks to watch. Mark items that may need a spike with [SPIKE NEEDED].
```

## Phase sizing guide

Phases must be atomic — completable in a single Claude Code session. Use these heuristics:

- **5-15 tasks per phase** — fewer is too granular (overhead), more loses coherence
- **15-20 files max touched per phase** — beyond this, context windows fill and quality drops
- **One testable increment per phase** — after each phase, something new works that didn't before
- **One PR per phase** is the target — if a phase can't be a clean PR, it's too big or too tangled

**Signs a phase is too big:**
- It touches more than 3 unrelated modules
- Its acceptance criteria list exceeds 8 items
- You can't describe its goal in one sentence

**Signs a phase is too small:**
- It only creates a file with no behavior
- It can't be tested independently
- The next phase would immediately modify everything this phase created

## Writing principles

**No code snippets.** Ever. The devplan describes architecture and intent. Claude Code writes the code. Including snippets creates confusion about whether they are prescriptive or illustrative, and they go stale immediately.

**No time estimates.** Development with Claude Code is unpredictable — a phase might take 10 minutes or 2 hours depending on how the session goes. Estimates add no value.

**Phases must be atomic.** Each phase should be something you can tell Claude Code "do Phase N" and it completes it in one session. If a phase requires multiple sessions, it's too big — split it.

**Be specific about constraints, vague about implementation.** "Use NSPanel with .floating level for the shelf window" is good — it's a real architectural constraint. "Create a SwiftUI view with a VStack containing..." is bad — that's implementation detail Claude Code will figure out.

**Platform knowledge is the differentiator.** A generic devplan says "build a menu bar app." A good devplan says "use NSStatusItem with a custom NSPopover; note that NSPopover dismisses on resignKey by default — if you need persistent display, use an NSPanel instead. Requires LSUIElement=true in Info.plist to hide from Dock."

**The Implementation Guidelines section is sacred.** This is where the developer's recurring preferences live — SOLID, patterns, naming conventions, repo hygiene. These should feel like non-negotiable standards, not suggestions.

**Test criteria are part of every phase.** Not a separate "testing phase" at the end. Each phase defines what to test and how. A phase without test criteria is incomplete.

## Adapting to platforms

When the target platform is known, inject platform-specific knowledge:

### macOS
- Sandbox vs non-sandboxed implications
- Entitlements checklist (camera, microphone, accessibility, file access, network)
- NSStatusItem / NSPanel / NSWindow level behaviors
- Hardened Runtime requirements for notarization
- App Sandbox file access (bookmarks, security-scoped URLs)
- macOS version compatibility considerations
- Accessibility API (AXUIElement) permission flow

### iOS
- App lifecycle constraints (background execution, scene lifecycle)
- Widget limitations (timeline-based, no live interaction beyond intents)
- App Store Review Guidelines red flags for the specific app type
- Push notification setup complexity
- Core Data vs SwiftData decision points
- Privacy manifest requirements

### Android
- Activity vs Service vs BroadcastReceiver — which one for this use case
- SYSTEM_ALERT_WINDOW and draw-over-other-apps
- Battery optimization and Doze mode impact
- Play Store policy considerations (accessibility service use, background location)
- Material Design 3 vs custom theming
- Jetpack Compose vs XML layouts decision

### Cross-platform (Tauri, Electron, Flutter, React Native)
- Define shared core first (business logic, data models), then platform layers
- Where native code is unavoidable
- Platform-specific code path strategy
- Bundle size and performance characteristics
- Native API bridge patterns
- Auto-update mechanisms per platform

## Output

Save the devplan as `DEVPLAN.md` in the project root (or wherever the user specifies). The file should be immediately usable — the developer drops it in, tells Claude Code to follow it, and development begins.

When the devplan is saved, also ensure `DECISIONS.md` exists in the project root. If stack and dependency choices were made during planning, log them there immediately.
