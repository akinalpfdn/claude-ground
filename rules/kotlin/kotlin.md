# Kotlin / Android Rules

Extends `common/` rules and `common/frontend.md`.

---

## 1. Coroutine Scope [MUST]

Every coroutine is launched from the correct scope:

| Context | Scope |
|---------|-------|
| ViewModel | `viewModelScope` |
| Activity / Fragment | `lifecycleScope` |
| Repository / Service | `suspend fun` — no scope, inherits from caller |
| App-level background work | Injected `CoroutineScope` |

`GlobalScope` is forbidden. If you think you need it, stop and ask.

`suspend fun` does not launch coroutines internally unless creating structured children with `coroutineScope {}`.

---

## 2. UI State as Sealed Class [MUST]

ViewModel exposes a single sealed class for UI state — not multiple separate `StateFlow` fields:

```kotlin
sealed class UserProfileState {
    object Loading : UserProfileState()
    data class Success(val user: User) : UserProfileState()
    data class Error(val message: String) : UserProfileState()
}

val state: StateFlow<UserProfileState> = _state.asStateFlow()
```

If a composable contains an `if` statement that is not about layout, it belongs in the ViewModel.

ViewModel never references Android framework classes directly. Context is injected via Hilt as `ApplicationContext` only.

---

## 3. Compose Theme [MUST]

All colors, typography, and shapes are defined in the theme — never hardcoded in composables:

```
ui/theme/
  Color.kt
  Typography.kt
  Shape.kt
  Theme.kt    ← AppTheme composable
```

Dark/light theme support is configured from project start. Not retrofitted later.

---

## 4. Repository Pattern [MUST]

ViewModel never accesses a data source directly. Every data source is behind a repository interface defined in the domain layer, implemented in infrastructure.

Domain models never contain `@SerializedName` or `@ColumnInfo`. Mapping happens in the repository.

---

## 5. Testing [SHOULD]

ViewModel tests use `kotlinx-coroutines-test` with `TestCoroutineDispatcher`. Every ViewModel test replaces the main dispatcher:

```kotlin
@Before
fun setup() {
    Dispatchers.setMain(testDispatcher)
}
```

Repository tests use a real in-memory database (Room's `inMemoryDatabaseBuilder`) — not mocked DAOs. Mocked DAOs test nothing meaningful.

UI tests use Compose testing APIs (`composeTestRule.onNodeWithText`), not legacy Espresso for Compose screens.
