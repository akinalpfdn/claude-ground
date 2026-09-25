---
name: cg-senior-code-review
description: Perform deep, findings-first senior engineering code reviews of any change in any language or stack. Use when reviewing a phase, feature branch, pull request, commit, or uncommitted changes for correctness bugs, security and abuse risks, regressions to existing behavior, concurrency and lifecycle defects, performance problems and resource leaks, over-engineering and duplication, and scalability or maintainability erosion. Use especially when the user asks for a detailed review without modifying code.
---

# Senior Code Review

Perform a rigorous senior-level review. Do not modify code unless the user explicitly asks for fixes.

The goal is not to approve the change or summarize what it does. The goal is to find concrete, well-supported problems before they reach production — and to say clearly when there are none.

## Core Principles

- Treat documentation, comments, task checklists, acceptance criteria, and commit messages as **claims to verify against the implementation**, not as facts.
- Do not assume code is correct because tests pass, the build is green, or another reviewer approved it.
- Look past syntax and local correctness: analyze lifecycle, authorization boundaries, failure paths, concurrency, performance, operational behavior, and future maintenance cost.
- Prefer a few well-supported findings over many speculative or cosmetic ones.
- Do not invent findings to appear thorough. Cosmetic nitpicks are noise.
- State plainly when no material issue is found.

## Calibration and Scope Discipline

Adversarial review is unbounded — a determined reviewer can always find "one more thing" in a real codebase. Without discipline, a review of a small change balloons into an audit of the whole system and stops being useful. Apply these guards:

- **Scale effort to the change.** A 10-line fix gets a focused pass; a large feature gets the full workflow. Do not apply maximal scrutiny to trivial diffs.
- **Separate the change from its surroundings.** Findings in the changed code are in scope. Pre-existing problems in adjacent code are **reported separately and at lower priority** — unless the change now newly depends on that weakness (in which case it becomes in scope). Do not let the review drift into auditing untouched subsystems.
- **Zero high-severity findings is a valid outcome.** A clean, well-scoped change may have nothing above Low. Say so. Do not manufacture severity to justify the review.
- **Know diminishing returns.** Gold-plating (deeper-than-needed input parsing on operator-controlled config, stress tests that require infrastructure you don't have, hypothetical futures) is not a finding. Stop when further passes only surface speculation.
- Always distinguish **confirmed findings** from **assumptions / open questions**. The Verification Pass below is what makes this real rather than aspirational — do not skip it.

## Review Workflow

### 1. Establish scope

- Inspect repository status, branch, recent commits, and the relevant diff.
- Identify added, modified, deleted, and untracked files.
- Read the phase doc, issue, spec, or acceptance criteria if present.
- Identify related modules, callers, consumers, configuration, tests, and deployment files.
- Determine what is explicitly out of scope, and set review depth proportional to size and risk.

Review the full behavioral surface the change affects, not only the changed lines.

### 2. Understand the existing system

Before judging the change, learn the conventions it must fit:

- Architectural patterns and ownership boundaries
- Authentication / authorization flow
- State lifecycle and cleanup behavior
- Concurrency and locking conventions
- Error-handling and response conventions
- Configuration and deployment mechanisms
- Existing tests and their style
- Frontend/backend (and external service) contracts

Check whether the change **fits the system**, not merely whether it works in isolation. Flag a new pattern introduced alongside an existing one.

### 3. Read the history, and what has already been said

Code that looks wrong is often a deliberate fix for a bug that is invisible from the diff, and a change that looks harmless sometimes quietly reverts one. Before judging surprising code, find out how it got that way.

- `git log` / `git blame` the lines the change touches. If a modified line was introduced by a bug-fix commit, read that commit: does the change preserve what it was fixing, or undo it? **A silently reverted fix is one of the highest-value findings a reviewer can produce, and it is invisible to anyone reading only the diff.**
- Notice lines that have been changed repeatedly. A long fix history marks a hidden constraint that the current author probably does not know about.
- Read what has already been **decided** about this area: `DECISIONS.md`, ADRs, phase/design docs, and the "why" comments in the code. A finding that re-litigates a documented decision is not a finding. If you believe the decision is now wrong, raise it separately and say what changed — do not smuggle it in as a defect.
- If the change has a pull request or issue thread, read prior review comments on these files. Do not re-raise a point that was already made and answered.

Bound this. Blame the lines in the diff, not the whole file, and only dig when the code is surprising or the change is risky. An obvious change does not need an archaeology pass.

### 4. Trace end-to-end behavior

For each important workflow, follow the full path: entry → authentication → authorization → input validation → state change → external effects → success response → failure response → cleanup/expiry/cancellation → retry/recovery.

Reason through every meaningful state, not just the happy path. Typical states (adapt to the domain — these are examples, not a fixed list): not-yet-created, pending, active, failed, cancelled, disconnected, expired, completed, **partial failure mid-operation**, and **process restart**.

Do not accept a check merely because it exists. Determine whether it actually enforces the intended boundary **throughout the resource's lifetime**, including after cleanup.

### 5. Adversarial review (security and abuse)

Think as a legitimate-but-malicious authenticated user, an unauthenticated attacker, and an operator making a config mistake. Look for:

- Authorization bypasses, confused-deputy behavior, cross-user/cross-tenant access
- Trust placed in client-controlled values
- Injection, unsafe deserialization, unescaped output
- Replay, stale-state, and race-based bypasses
- Capabilities/credentials/tokens usable outside their intended workflow
- Resources that cannot be revoked once granted
- Rate limits that slow abuse but do not prevent it; requests that extend expiry indefinitely
- Missing quotas or cost controls; unbounded resource consumption
- Sensitive responses that are cacheable; secrets in logs/URLs/errors
- Unsafe defaults; silent fallback that hides a production misconfiguration

For any credential, token, signed URL, or capability, separate three distinct questions: is **issuance** controlled, is **usage** controlled, and is **damage after leakage** bounded? A gate on issuance does not bound usage.

### 6. Concurrency and lifecycle

For stateful or concurrent code:

- Is shared state fully covered by locks? Is check-then-act collapsed into one atomic critical section?
- Are mutable pointers/objects returned after the lock is released and then read concurrently? Prefer immutable snapshots or purpose-specific query methods (e.g. a boolean) for authorization, not returning internal mutable state.
- Are goroutines/threads/timers/subscriptions/listeners cleaned up on **every** exit path? Is there a leak on the error path?
- Is abandoned state expired? What happens on duplicate requests, simultaneous transitions, and process restart?

### 7. Simplicity, reuse, and over-engineering

Working is not the same as warranted. Check whether the change is the **smallest correct solution**:

- Duplication of logic that already exists elsewhere — could it reuse an existing helper, type, or abstraction?
- Premature or speculative abstraction (interfaces with one implementation, configurability nobody asked for, generic machinery for a single case) — YAGNI.
- Dead code, unreachable branches, unused parameters/exports, copy-paste left behind.
- Unnecessary new dependencies for something the stdlib or an existing dep already does.
- A markedly simpler equivalent the author missed.

Over-engineering is a real maintenance cost; flag it as a finding, not a preference. (Respect explicit project rules that mandate production-grade structure over minimalism — see step 12.)

### 8. Performance and resource leaks

- **Unbounded growth:** maps/caches/slices/queues that accumulate and never shrink; missing eviction, TTL, or pagination.
- **Query patterns:** N+1 queries, missing indexes, full scans, per-item round-trips in a loop.
- **Hot-path cost:** allocations, copies, serialization, or locking on frequently executed paths; blocking I/O where it stalls a critical loop.
- **Concurrency limits:** unbounded fan-out / goroutine or task creation per request.
- **Frontend (if applicable):** unnecessary re-renders (unstable selector/prop/context references, missing memoization), effect dependency loops, stale closures, listeners/intervals/subscriptions added without cleanup, large synchronous work on the main thread.

Tie each performance finding to a realistic load or growth scenario, not a micro-optimization.

### 9. Configuration and operations

Treat configuration as production code:

- Required variables, sensible defaults, validation and bounds, fail-fast on invalid security-relevant config.
- Partial/half-written configuration states; secret handling and rotation.
- Example env files, deployment docs, and setup scripts kept consistent with the new config contract.
- Misleading "enabled/healthy" logs that only confirm config presence, not reachability.
- Multi-instance behavior; upgrade and rollback compatibility; resource and bandwidth cost of the change.

### 10. Scalability and maintainability

- **Scalability:** Does the change assume a single instance (in-memory state, local locks, sticky routing) in a system that may scale horizontally? Are shared-state assumptions documented? Does load scale linearly with users/data?
- **Maintainability:** Function/file size and single-responsibility; naming clarity; coupling and layering direction; comment quality (explains *why*, not restating *what*); readability for the next engineer. Adherence to the codebase's stated design principles.

### 11. Review tests critically

Tests are evidence, not proof. Check whether they:

- Assert the actual security and business requirements (not just that a function runs).
- Cover relevant state transitions, negative/adversarial cases, cleanup, and expiry.
- Test integration boundaries, not only isolated helpers.
- Accidentally encode an incorrect implementation (a test that "passes" by asserting the bug).
- Verify config errors, response headers/contracts, and repeated/concurrent behavior where relevant.

Flag comments or task checkboxes that claim more than the assertions actually prove.

If the user says another system runs build/lint/tests, do not run them — focus on static review.

### 12. Documentation, conventions, and regressions

- **Docs vs reality:** compare the implementation against phase docs, acceptance criteria, checked-off tasks, inline comments, env examples, and future-phase assumptions. Report contradictions that could cause later mistakes.
- **Project conventions:** check the change against the project's own rules (e.g. `CLAUDE.md`, `DECISIONS.md`, lint config, contribution guide) — naming, layering, i18n/string handling, styling tokens, comment policy, language, etc.
- **Regression analysis:** when a signature, return type, behavior, or shared invariant changes, find every caller/consumer and confirm none is broken. This is the primary defense against breaking existing production behavior — make it explicit, not incidental.

## Verification Pass — run this before writing anything

The workflow above produces **candidates**, not findings. A wrong claim costs the author real time to disprove, and a review that cries wolf gets ignored — including the one finding that mattered. So argue against your own work before publishing it.

Take each candidate and try to **refute** it. Default to dropping it unless it survives:

- **Did you read the path, or infer it?** Re-open the code and follow it. Never report from memory of what a function "probably" does.
- **Can you name the line where it breaks?** If you cannot point at the exact statement, and the exact input or interleaving that reaches it, it is not confirmed.
- **Is it already guarded somewhere you did not look?** Check the caller, the middleware, the framework, a validation layer, a database constraint, the type system.
- **Is it pre-existing?** If the change neither introduced it nor newly depends on it, it moves to Pre-existing. It does not vanish, but it does not block.
- **Would a competent author have a reason?** Steelman the code. If you can construct a reason, either refute that reason concretely or drop the finding.
- **Does your evidence prove what you claim?** A passing test proves a test passed. A green build proves it compiled. If a claim rests on "the suite is green, so the behaviour must be X", check that the assertion would actually fail if X were false — an assertion that holds either way proves nothing.

Then label what survives, and let the label decide where it goes:

- **Confirmed** — mechanism traced end to end, exact location known, failure scenario concrete. → Findings.
- **Probable** — mechanism is sound but one link was inferred rather than read. → Findings, with the inferred link named explicitly so the author can check it first.
- **Speculative** — cannot be traced without information you do not have. → **Open Questions**. Never Findings.

Report how many candidates you dropped and why, in one line. A review that drops nothing did not run this pass.

If the caller has opted into subagents, run this pass as reviewers that did **not** produce the finding. A reviewer checking their own claim is the weakest form of this check.

## Severity Guidance

- **Critical** — direct security compromise, data loss, privilege escalation, or outage likely under normal conditions.
- **High** — material security, abuse, correctness, or architectural issue that should block release.
- **Medium** — real issue likely to cause regressions, operational pain, performance degradation, or hard maintenance.
- **Low** — limited-risk correctness gaps, over-engineering, misleading docs, or meaningful missing test coverage.

Do not inflate severity. Pre-existing issues outside the change's scope are reported separately and usually capped at the severity their *new* exposure justifies.

## Finding Requirements

Every finding must include:

- Severity and a concise title
- **Confidence: Confirmed or Probable** (Speculative belongs in Open Questions, not here). For Probable, name the link you inferred rather than read.
- Exact file and line reference
- What the code currently does
- Why that behavior is incorrect or risky
- A realistic failure or abuse scenario (demonstrate the mechanism — no vague "this might be insecure")
- The expected direction of a fix (not a full patch unless asked)
- Where history is what makes it a finding (a reverted fix, a constraint set by an earlier commit), cite the commit

## Output Format

Lead with findings, ordered by severity.

```markdown
## Findings

### 1. High · Confirmed: Concise finding title

`path/to/file.ext:123`

What the code does now, why it is risky, and a realistic scenario.

Expected direction: the safer behavior, briefly.

### 2. Medium · Probable: ...

`path/to/other.ext:45`

...  (Inferred: that `doThing()` never returns null — read the callers, not that function.)
```

After findings:

```markdown
## Pre-existing / Out of Scope
Issues in adjacent untouched code, noted separately (not blockers for this change unless newly relied upon).

## Open Questions
Only questions that materially affect correctness or risk.

## Overall Assessment
- What is implemented well
- Whether the change is production-ready
- Which findings (if any) should block release
- Remaining test or operational risk
- One line: how many candidates the Verification Pass dropped, and the main reason
```
