# Flutter / Dart Rules

Extends `common/core.md` and `common/frontend.md`. These rules apply to every Flutter project.

---

## 1. Widget Granularity

Widgets are small and focused. If a widget has more than one visual responsibility, split it.

`build()` methods that exceed 60 lines are a signal to extract sub-widgets. Extract into:
- Private widgets in the same file if used only once
- Separate files in `shared/components/` if used in more than one feature

Never put business logic in `build()`. If there is any logic beyond formatting data for display, it belongs in the state management layer.

---

## 2. State Management

One state management solution per project. Riverpod is preferred. Bloc is acceptable for complex event-driven flows. Do not mix them.

The choice is made at project start and logged in `DECISIONS.md`. It is not changed mid-project without a documented decision.

**Riverpod:** All providers are defined in dedicated provider files, not inline in widget files.

**Bloc:** Every feature has its own Bloc. Blocs do not call other Blocs directly — communicate through the repository layer.

`setState` is acceptable only for purely local UI state (animation controllers, focus nodes). Not for anything that comes from or goes to a data source.

---

## 3. Theme & AppTheme

`ThemeData` is defined once in `lib/theme/app_theme.dart`. No widget uses hardcoded colors, font sizes, or spacing values.

```dart
lib/
  theme/
    app_colors.dart       ← color constants
    app_text_styles.dart  ← TextStyle definitions
    app_spacing.dart      ← spacing constants
    app_theme.dart        ← ThemeData assembly
```

Colors are referenced via `Theme.of(context)` or the app colors constants — never as `Color(0xFF...)` inline.

`TextStyle` is never defined inline in a widget. It is always referenced from `app_text_styles.dart` or `Theme.of(context).textTheme`.

Dark theme support is configured in `app_theme.dart` from project start.

---

## 4. Platform-Specific Code Isolation

Platform-specific code lives in dedicated files using conditional imports or the platform channel pattern. Never use `Platform.isIOS` or `Platform.isAndroid` scattered through UI code.

```dart
// Correct — isolated
lib/
  core/
    platform/
      share_service.dart          ← abstract interface
      share_service_mobile.dart   ← mobile implementation
      share_service_web.dart      ← web implementation
```

`dart:io` imports that are platform-specific are wrapped and injected, not used directly in widgets or business logic.

---

## 5. Project Structure

```
lib/
  core/
    network/
    storage/
    platform/
    theme/
  features/
    [feature]/
      data/
        [feature]_repository.dart
        [feature]_remote_source.dart
      domain/
        [feature]_model.dart
      presentation/
        [feature]_page.dart
        [feature]_provider.dart   ← or bloc/
  shared/
    components/
    extensions/
  main.dart
```

Each feature is self-contained. Cross-feature dependencies go through `core/` or `shared/`.
