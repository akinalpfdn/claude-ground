# Go Rules

Extends `common/` rules. Only rules that change behavior — not reminders of things already done correctly.

---

## 1. Goroutine Lifecycle [MUST]

Every goroutine MUST have a visible exit condition before it is written. If you cannot point to the exit condition, do not write the goroutine yet — design it first.

`context.Context` is the first parameter of any function that may block, do I/O, or spawn goroutines. No exceptions.

```go
// Correct
func FetchUser(ctx context.Context, id string) (*User, error)

// Forbidden
func FetchUser(id string) (*User, error)
```

Never store context in a struct. Pass it explicitly every time.

Stored goroutines (launched and not immediately awaited) require a cancellation path. If you are launching a goroutine that runs "until the app shuts down," there must be a shutdown signal it responds to.

---

## 2. Error Wrapping [MUST]

Every error crossing a function boundary is wrapped with context:

```go
// Correct
return fmt.Errorf("fetchUser %s: %w", id, err)

// Forbidden — loses call site context
return err
```

Sentinel errors are package-level variables, not inline strings:
```go
var ErrNotFound = errors.New("not found")
```

`errors.Is` and `errors.As` for matching. Never compare `.Error()` strings.

Ignoring errors with `_` requires an inline comment explaining why it is safe.

---

## 3. Interface Design [MUST]

Interfaces are defined at the point of consumption, not at the point of implementation.

Maximum three methods per interface. If you need more, split — unless there is a documented reason not to.

Do not create interfaces speculatively. Create them when you have two implementations or a concrete testing need.

---

## 4. Package Structure [MUST]

Packages are organized by domain, never by type:

```
// Correct
internal/user/handler.go
internal/user/service.go
internal/order/handler.go

// Forbidden
models/user.go
utils/helpers.go
```

`internal/` by default. External packages require a documented reason.

Circular imports are never resolved by merging packages. Stop and redesign.

---

## 5. Testing [SHOULD]

Table-driven tests for all functions with multiple input cases:

```go
tests := []struct {
    name    string
    input   string
    want    *User
    wantErr bool
}{
    {"valid id", "abc", &User{}, false},
    {"empty id", "", nil, true},
}
```

Run `go test -race ./...` before marking any concurrent code complete. Race conditions in tests are bugs, not test flakiness.
