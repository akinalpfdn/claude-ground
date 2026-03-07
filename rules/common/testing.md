# Testing Rules

Applies to every project regardless of language. Language-specific test tooling is covered in individual language rules.

---

## 1. When to Write Tests [MUST]

**MUST write tests for:**
- Every public API or function with business logic
- Every bug fix — the test reproduces the bug before the fix, passes after
- Every edge case explicitly mentioned in requirements
- Any code that has caused a bug before

**SHOULD write tests for:**
- Non-trivial private functions with complex logic
- Integration points between components or services

**Do NOT test:**
- Framework boilerplate (getters/setters, auto-generated code)
- Third-party library behavior
- Implementation details that change without behavior changes

---

## 2. Test Names [SHOULD]

Test names describe behavior, not implementation.

Format: `should [expected behavior] when [condition]`

```
// Correct
should return null when user does not exist
should throw unauthorized when token is expired
should retry three times before failing

// Forbidden
testGetUser
test1
getUserTest
```

---

## 3. Test Structure [SHOULD]

Every test follows Arrange-Act-Assert:

```
// Arrange — set up state and inputs
// Act — call the thing being tested
// Assert — verify the outcome
```

One assertion per test when possible. Multiple assertions are acceptable when they verify the same behavior from different angles — not when they test different behaviors.

---

## 4. Mocks vs Integration [SHOULD]

**Use mocks when:**
- Testing a unit in isolation from its dependencies
- The dependency is slow (network, DB, filesystem)
- You need to simulate error conditions that are hard to reproduce

**Use integration tests when:**
- Verifying that two or more components work together correctly
- Testing database queries (use a real test DB, not mocks)
- Testing API contracts end-to-end

Do not mock what you own. If you control the code, test the real thing.

---

## 5. Test Coverage [SHOULD]

Coverage is a signal, not a goal. 100% coverage with meaningless tests is worse than 60% coverage with meaningful ones.

**SHOULD:**
- All critical paths have tests before a feature is marked complete
- Unhappy paths (errors, edge cases) have at least as much coverage as happy paths
- New code does not reduce overall test coverage

**Do NOT:**
- Skip tests to ship faster and "add them later" — they do not get added later
- Write tests that only verify the happy path
- Comment out or skip failing tests to make the build pass

---

## 6. Test as Documentation [RECOMMENDED]

Tests describe how the system behaves. A new developer reading the test suite should understand what the system does without reading the implementation.

If a test is hard to understand, the test (or the code it tests) is probably too complex.
