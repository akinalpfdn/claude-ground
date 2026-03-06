# Kotlin / Android Rules

Extends `common/core.md` and `common/frontend.md`. These rules apply to every Kotlin/Android project.

---

## 1. Coroutine Scope Management

Every coroutine is launched from the correct scope. No exceptions.

| Where | Scope to use |
|-------|-------------|
| ViewModel | `viewModelScope` |
| Activity / Fragment | `lifecycleScope` |
| Repository / Service | Injected `CoroutineScope` or `suspend fun` only |
| Application-level | `applicationScope` (custom, injected) |

`GlobalScope` is forbidden. If you think you need it, stop and ask.

`suspend fun` does not need its own scope — it inherits from the caller. Do not launch coroutines inside suspend functions unless creating structured children with `coroutineScope {}`.

All coroutines that can fail have explicit error handling — either `try/catch` or `CoroutineExceptionHandler`. Silent failures are not acceptable.

---

## 2. ViewModel & UI State

ViewModel exposes a single UI state sealed class, not multiple LiveData/StateFlow fields:

```kotlin
sealed class UserProfileState {
    object Loading : UserProfileState()
    data class Success(val user: User) : UserProfileState()
    data class Error(val message: String) : UserProfileState()
}

private val _state = MutableStateFlow<UserProfileState>(Loading)
val state: StateFlow<UserProfileState> = _state.asStateFlow()
```

UI observes state. UI does not contain logic. If there is an `if` statement in a composable that is not about layout, it belongs in the ViewModel.

ViewModel does not reference Android framework classes (Context, Activity, View). If you need Context, use `ApplicationContext` injected via Hilt — never passed directly.

---

## 3. Jetpack Compose Theme

`MaterialTheme` is extended, not bypassed. All colors, typography, and shapes are defined in the theme:

```
ui/
  theme/
    Color.kt
    Typography.kt
    Shape.kt
    Theme.kt      ← AppTheme composable
```

`AppTheme {}` wraps the entire app. No component uses hardcoded color values or `TextStyle` inline.

Custom design tokens that don't map to MaterialTheme slots use `CompositionLocal`:
```kotlin
val LocalAppSpacing = staticCompositionLocalOf { AppSpacing() }
```

Dark/light theme support is handled at the theme level from day one. Not retrofitted later.

---

## 4. Repository Pattern

Every data source is behind a repository interface. ViewModel never calls a data source directly.

```
data/
  repository/
    UserRepository.kt          ← interface
    UserRepositoryImpl.kt      ← implementation
  remote/
    UserApiService.kt
  local/
    UserDao.kt

domain/
  model/
    User.kt                    ← domain model, not API/DB model
  usecase/
    GetUserUseCase.kt          ← optional, for complex logic

ui/
  userprofile/
    UserProfileViewModel.kt    ← calls repository only
```

Mapping between API/DB models and domain models happens in the repository layer. Domain models never contain `@SerializedName` or `@ColumnInfo` annotations.

---

## 5. Dependency Injection

Hilt is the DI solution. No manual DI, no service locator pattern, no singletons via `object` unless genuinely stateless utilities.

Every dependency is injected through the constructor. `@Inject lateinit var` in Activities/Fragments is acceptable only for Android framework entry points.
