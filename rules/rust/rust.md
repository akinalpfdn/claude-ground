# Rust Rules

Extends `common/core.md`. These rules apply to every Rust project.

---

## 1. Ownership & Borrowing

Do not fight the borrow checker. If the compiler rejects an approach, it is usually right. Stop, understand why, and redesign — do not reach for `clone()` or `Rc<RefCell<>>` as a first resort.

`clone()` on large data structures requires a comment explaining why ownership cannot be transferred or borrowed:
```rust
// Acceptable only with explanation
// Handler runs concurrently and needs independent ownership of config
let config = self.config.clone();
```

`Rc<RefCell<T>>` and `Arc<Mutex<T>>` are valid tools — but if you are reaching for them frequently, the ownership model is probably wrong at a higher level. Stop and reconsider the design.

References outlive their owners — the compiler enforces this. If you are fighting lifetime annotations extensively, the data structure relationships need redesigning, not more annotations.

---

## 2. Error Handling

Application-level errors use `thiserror` for defining error types and `anyhow` for propagation in binary crates:

```rust
// Library crate — explicit typed errors
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("user {0} not found")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

// Binary crate / application code — anyhow for propagation
fn main() -> anyhow::Result<()> { }
```

`unwrap()` and `expect()` are forbidden in production paths. They are acceptable in:
- Tests
- `main()` for startup configuration that must succeed
- Cases where the invariant is provably maintained — with an `// SAFETY:` comment explaining why

`?` is always preferred over `match` for simple error propagation.

---

## 3. Async Runtime

One async runtime per project. Tokio is the default. Do not mix runtimes.

The runtime is initialized once at the top level:
```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> { }
```

`block_on` inside async code is forbidden — it will deadlock on single-threaded runtimes. If you think you need it, stop and ask.

Async functions do not spawn threads unnecessarily. CPU-bound work uses `tokio::task::spawn_blocking`. I/O-bound work stays in async.

Tasks spawned with `tokio::spawn` are either awaited, stored with an abort handle, or explicitly documented as fire-and-forget with a reason.

---

## 4. Unsafe

`unsafe` blocks require a `// SAFETY:` comment that explains:
1. Why this is safe despite bypassing the compiler
2. What invariants the caller must maintain

```rust
// SAFETY: ptr is non-null and aligned, allocated by Box::into_raw above
// and this is the only live reference to the allocation.
unsafe { Box::from_raw(ptr) }
```

`unsafe` blocks are as small as possible — only the specific operations that require it.

New `unsafe` code requires a stop-and-ask before writing it. It is never the first solution considered.

---

## 5. Project Structure

```
src/
  main.rs          ← entry point only, minimal logic
  lib.rs           ← library root if dual crate
  config/
  error.rs         ← top-level error types
  domain/          ← core types and logic, no I/O
  infrastructure/  ← database, HTTP clients, external services
  handlers/        ← HTTP handlers or CLI commands
```

Business logic in `domain/` has no dependencies on `infrastructure/`. This is enforced by keeping infrastructure traits in `domain/` and implementations in `infrastructure/`.
