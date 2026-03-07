# Rust Rules

Extends `common/` rules.

---

## 1. Ownership — Work With the Compiler [MUST]

When the borrow checker rejects an approach, it is usually right. Stop, understand why, and redesign — do not reach for `clone()` or `Rc<RefCell<>>` as a first response.

`clone()` on large data structures requires an inline comment explaining why ownership cannot be transferred or borrowed.

If you are fighting lifetime annotations extensively, the data structure relationships need redesigning — not more annotations.

---

## 2. Error Handling [MUST]

Library crates use `thiserror` for typed errors. Binary crates use `anyhow` for propagation:

```rust
// Library — explicit typed errors
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("user {0} not found")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

// Binary — anyhow for propagation
fn main() -> anyhow::Result<()> { }
```

`unwrap()` and `expect()` are forbidden in production paths. Acceptable in tests and `main()` startup configuration. Every other use requires a `// SAFETY:` or `// INVARIANT:` comment.

---

## 3. Async Runtime [MUST]

One runtime per project — Tokio by default. Do not mix runtimes.

`block_on` inside async code is forbidden — deadlock on single-threaded runtimes.

`tokio::spawn` tasks are either awaited, stored with an abort handle, or documented as intentional fire-and-forget with a reason.

---

## 4. Unsafe [MUST]

Every `unsafe` block has a `// SAFETY:` comment that explains:
1. Why this is safe despite bypassing the compiler
2. What invariants the caller must maintain

`unsafe` blocks are as small as possible. New `unsafe` code requires stopping to ask before writing — it is never the first solution considered.

---

## 5. Testing [SHOULD]

Unit tests live in a `#[cfg(test)]` module at the bottom of the file being tested — not in a separate file.

Integration tests in `tests/` directory use the public API only. They should not know about internal implementation details.

Property-based testing with `proptest` or `quickcheck` for functions with complex input spaces (parsers, serializers, algorithms).
