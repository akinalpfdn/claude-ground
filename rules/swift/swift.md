# Swift Rules

Extends `common/` rules. Assumes SwiftUI + modern Swift (5.9+).

---

## 1. MVVM Structure [MUST]

Every screen has exactly one ViewModel. Views render state — they do not compute it.

```
Features/UserProfile/
  UserProfileView.swift        ← layout only
  UserProfileViewModel.swift   ← all logic, all async calls, all state
```

If a View contains a function that does anything other than format data for display, move it to the ViewModel.

ViewModel is `@Observable` (Swift 5.9+) or `ObservableObject`. It is explicitly annotated `@MainActor`:

```swift
@MainActor
final class UserProfileViewModel: ObservableObject { }
```

---

## 2. Async/Await & Actor [MUST]

All async work runs inside `Task {}` blocks. No `DispatchQueue.main.async` in new code.

Every stored `Task` is cancelled on deinit:
```swift
private var loadTask: Task<Void, Never>?
deinit { loadTask?.cancel() }
```

`Task.detached` requires a comment explaining why escaping the current actor context is necessary.

---

## 3. Memory Management [MUST]

Capture lists are explicit in every escaping closure:
```swift
// Correct
Task { [weak self] in await self?.load() }

// Forbidden — implicit capture
Task { await load() }
```

`unowned` requires an inline comment guaranteeing the referenced object outlives the closure. If you cannot write that comment confidently, use `weak`.

---

## 4. Error Handling [SHOULD]

Errors are enums conforming to `LocalizedError`. `try!` is forbidden in production. `try?` requires a comment explaining why discarding the error is intentional.

ViewModels expose errors as published state, not thrown errors:
```swift
@Published var errorMessage: String?
```

---

## 5. Testing [SHOULD]

ViewModels are testable without launching the full app. Dependencies are injected, not created inside the ViewModel:

```swift
// Correct
init(userService: UserServiceProtocol) { self.userService = userService }

// Forbidden — untestable
init() { self.userService = UserService() }
```

Test async ViewModel behavior with `MainActor.run {}` in test bodies.
