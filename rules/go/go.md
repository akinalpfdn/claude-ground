# Go Rules

Extends `common/core.md`. These rules apply to every Go project.

---

## 1. Goroutine & Context

Every goroutine MUST have a defined exit condition. No goroutine is launched without one of:
- A `context.Context` cancellation path
- A done channel
- A WaitGroup with a clear completion signal

`context.Context` is always the first parameter of any function that may block, do I/O, or spawn goroutines:
```go
// Correct
func FetchUser(ctx context.Context, id string) (*User, error)

// Forbidden
func FetchUser(id string) (*User, error)
```

Never store context in a struct. Pass it explicitly every time.

If you cannot see a clear exit path for a goroutine, stop and ask before writing it.

---

## 2. Error Handling

Every error returned from a function boundary MUST be wrapped with context:
```go
// Correct
return fmt.Errorf("fetchUser %s: %w", id, err)

// Forbidden
return err
```

Errors are defined as package-level sentinel values or typed errors — not raw strings:
```go
var ErrNotFound = errors.New("not found")
```

Use `errors.Is` and `errors.As` for matching. Never compare error strings.

Ignoring errors with `_` is forbidden unless the function is documented as safe to ignore and the reason is commented inline.

---

## 3. Interface Design

Interfaces are defined at the point of consumption, not at the point of implementation.

Interfaces are small and focused — one to three methods maximum. If an interface has more than three methods, split it unless there is a documented reason not to.

```go
// Correct — small, focused
type UserReader interface {
    GetUser(ctx context.Context, id string) (*User, error)
}

// Forbidden — too broad
type UserService interface {
    GetUser(ctx context.Context, id string) (*User, error)
    CreateUser(ctx context.Context, u *User) error
    DeleteUser(ctx context.Context, id string) error
    ListUsers(ctx context.Context) ([]*User, error)
    UpdateUser(ctx context.Context, u *User) error
}
```

Do not create interfaces speculatively. Create them when you have at least two implementations or a clear testing need.

---

## 4. Package Structure

Packages are organized by domain, not by type. No `models/`, `utils/`, `helpers/` packages.

```
// Correct
internal/
  user/
    handler.go
    service.go
    repository.go
    errors.go
  order/
    handler.go
    service.go

// Forbidden
models/
  user.go
  order.go
utils/
  helpers.go
```

`internal/` is used for packages not meant to be imported externally. Default to `internal/` unless external import is explicitly required.

Package names are lowercase, single words, no underscores. If you need two words, the package boundary is probably wrong.

Circular imports are never solved by merging packages. Stop and redesign if a circular dependency appears.

---

## 5. Concurrency Patterns

Prefer channels for ownership transfer, mutexes for shared state protection. Do not mix them on the same data.

`sync.Mutex` is always unlocked with `defer`:
```go
mu.Lock()
defer mu.Unlock()
```

`sync.WaitGroup` Add is called before the goroutine is launched, not inside it.

Race conditions are caught with `-race` flag. Run `go test -race ./...` before marking any concurrent code complete.
