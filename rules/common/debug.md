# Debug Rules

Applies to every project. The most common failure mode when debugging is not having the wrong solution — it is trying the same wrong solution repeatedly with minor variations.

---

## 1. The Two-Attempt Rule [MUST]

**MUST:**
- If the same problem is not resolved after 2 attempts, stop.
- Do not make a third attempt without first doing a structured analysis (see below).
- Do not make a third attempt with a minor variation of the second attempt.

This rule exists because brute-force debugging creates new bugs, masks the original problem, and wastes context window.

---

## 2. Structured Analysis Before Attempt 3 [MUST]

Before the third attempt, do this in order:

1. **State the problem precisely.** What is the exact error or unexpected behavior? Not "it doesn't work" — what specifically is wrong?
2. **State your assumptions.** What did you assume was true that might not be?
3. **Identify what you do not know.** What information would change your approach?
4. **Read the relevant code again.** Not from memory — actually re-read it.
5. **Form a hypothesis.** "I believe the problem is X because Y."

Only then make the next attempt — and it should be testing the hypothesis, not trying a different fix.

---

## 3. When to Ask the User [MUST]

**MUST ask the user when:**
- 3 attempts have not resolved the problem
- The root cause is unclear after structured analysis
- The fix would require a significant architectural change
- You suspect the problem is in code or configuration you cannot see

When asking, always include:
- What you have tried
- What you believe the root cause is
- What information you need

Do not ask "what should I do?" — ask a specific question.

---

## 4. Do Not Mask Errors [MUST]

**MUST NOT:**
- Catch and swallow exceptions to make tests pass
- Add null checks to hide a null reference instead of fixing the source
- Disable a failing test to unblock the build
- Change error handling to suppress a symptom instead of fixing the cause

If fixing the symptom is genuinely the right call (e.g., defensive null check for external input), document why.

---

## 5. Reproduce Before Fixing [SHOULD]

**SHOULD:**
- Before fixing a bug, confirm you can reproduce it reliably.
- If you cannot reproduce it, do not guess at a fix — investigate why it is unreproducible.
- A fix that cannot be verified against a reproduction is a guess.

---

## 6. One Change at a Time [SHOULD]

**SHOULD:**
- Make one change per debug attempt. Multiple simultaneous changes make it impossible to know what fixed the problem.
- If you changed three things and the bug is gone, revert two of them and verify the fix still holds.
- If you cannot isolate which change fixed it, you do not understand the fix.
