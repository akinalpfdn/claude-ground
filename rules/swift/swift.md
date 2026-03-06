# Swift Rules

Extends `common/core.md` and `common/frontend.md`. These rules apply to every Swift/SwiftUI project.

---

## 1. SwiftUI + MVVM Structure

Every screen has exactly one ViewModel. Views are passive — they render state, they do not compute it.

```
Features/
  UserProfile/
    UserProfileView.swift
    UserProfileViewModel.swift
    UserProfileModel.swift   ← data types only
```

ViewModel is an `@Observable` class (Swift 5.9+) or `ObservableObject`. It owns:
- All business logic
- All async calls
- All state that drives the view

Views own:
- Layout
- Animations
- Navigation triggers (but not navigation logic)

If a View contains a function that does anything other than format data for display, move it to the ViewModel.

---

## 2. Actor & Async/Await

`@MainActor` is applied to ViewModels explicitly, not assumed:
```swift
@MainActor
final class UserProfileViewModel: ObservableObject { }
```

All async work is done inside `Task {}` blocks, never with `DispatchQueue.main.async` in new code.

Structured concurrency is preferred over unstructured. Use `async let` for parallel work, `TaskGroup` for dynamic parallelism.

Every `Task` that is stored must be cancelled on deinit:
```swift
private var loadTask: Task<Void, Never>?

deinit {
    loadTask?.cancel()
}
```

Do not use `Task.detached` unless you explicitly need to escape the current actor context and can document why.

---

## 3. Memory Management

`weak` is used for delegate references and closure captures where the referenced object has an equal or shorter lifetime than the closure.

`unowned` is only used when you can guarantee the referenced object outlives the closure — document this guarantee inline when you use it.

Capture lists are explicit in every escaping closure:
```swift
// Correct
Task { [weak self] in
    await self?.loadData()
}

// Forbidden — implicit capture
Task {
    await loadData()
}
```

Retain cycles are checked whenever a closure is stored as a property. If a stored closure captures `self`, `self` must be `weak` or `unowned`.

---

## 4. Project Structure

```
App/
  AppEntry.swift         ← @main only
  AppCoordinator.swift   ← root navigation

Core/
  Network/
  Storage/
  Theme/                 ← colors, typography, spacing (see frontend rules)

Features/
  [FeatureName]/
    [Feature]View.swift
    [Feature]ViewModel.swift

Shared/
  Components/            ← reusable UI primitives
  Extensions/
  Models/
```

No business logic in `AppEntry` or App-level files. Coordinator or root ViewModel handles navigation.

---

## 5. Error Handling

Define errors as enums conforming to `LocalizedError`:
```swift
enum UserError: LocalizedError {
    case notFound(id: String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .notFound(let id): return "User \(id) not found"
        case .unauthorized: return "Unauthorized"
        }
    }
}
```

Do not use `try!` in production code. Ever. Use `try?` only when nil is a valid handled outcome and the error is intentionally discarded — comment why.

ViewModels expose errors as published state, not as thrown errors:
```swift
@Published var errorMessage: String?
```
