# Flutter / Dart Rules

Extends `common/` rules and `common/frontend.md`.

---

## 1. Widget Granularity [MUST]

`build()` methods over 60 lines are split. No business logic in `build()` — format data for display only.

Private widgets in the same file if used once. Separate file in `shared/components/` if used in multiple features.

---

## 2. State Management [MUST]

One solution per project. Riverpod is preferred. Bloc is acceptable for complex event-driven flows. Do not mix them.

The choice is made at project start and logged in `DECISIONS.md`.

`setState` is acceptable only for purely local UI state (animation controllers, focus nodes) — never for anything that touches a data source.

**Riverpod:** All providers are in dedicated provider files, not inline in widget files.

**Bloc:** Blocs do not call other Blocs. Cross-feature communication goes through the repository layer.

---

## 3. AppTheme [MUST]

`ThemeData` is defined once in `lib/theme/app_theme.dart`. No widget uses hardcoded colors, font sizes, or spacing.

```
lib/theme/
  app_colors.dart
  app_text_styles.dart
  app_spacing.dart
  app_theme.dart
```

Dark theme support is configured at project start.

---

## 4. Platform-Specific Code [MUST]

`Platform.isIOS` and `Platform.isAndroid` are never scattered through UI or business logic. Platform-specific behavior is isolated:

```
core/platform/
  share_service.dart           ← abstract interface
  share_service_mobile.dart
  share_service_web.dart
```

---

## 5. Testing [SHOULD]

Widget tests use `WidgetTester` — test what the user sees, not widget internals:

```dart
await tester.pumpWidget(MyApp());
expect(find.text('Welcome'), findsOneWidget);
```

Riverpod tests use `ProviderContainer` with overridden providers — no mocking the entire dependency tree.

Bloc tests use `bloc_test` package with `blocTest<MyBloc, MyState>()`. Every Bloc has a corresponding `*_bloc_test.dart`.

Golden tests for critical UI components that must not change appearance unexpectedly.
