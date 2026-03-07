# Frontend Rules

Applies to any project with a user interface: web, mobile, desktop.
Only loaded when the project has a UI — do not include for backend-only projects.

---

## 1. No Inline Anything [MUST]

Inline styles, inline colors, inline fonts — all forbidden.

**MUST create before writing the first component:**

React/TypeScript:
```
src/theme/
  colors.ts
  typography.ts
  spacing.ts
  index.ts
```

Swift/SwiftUI:
```
App/Theme/
  Colors.swift
  Typography.swift
  Spacing.swift
```

Flutter:
```
lib/theme/
  app_colors.dart
  app_text_styles.dart
  app_theme.dart
```

Every component imports from the theme. No exceptions.

---

## 2. Intentional Design [MUST]

Every visual decision must be intentional. The failure mode is not using a "wrong" font or color — it is making choices without thinking.

**MUST:**
- Before writing a single component, define the visual direction in one sentence. ("Dense developer tool, dark, monospace-heavy" is enough.)
- Commit to that direction. Do not drift toward safe/generic mid-implementation.

**SHOULD:**
- Avoid defaulting to the same palette, layout, and component patterns across every project. Each project has a different context — the design should reflect it.
- When no design brief is given, ask for one. Even one sentence changes the output significantly.

There is nothing wrong with Inter, Roboto, or system fonts when they are the right choice for the context. There is something wrong with using them because you did not think about it.

---

## 3. Theme Before Components [MUST]

Strict order:
1. Define theme tokens (colors, typography, spacing)
2. Build primitive components (Button, Text, Input) using tokens
3. Build feature components on top of primitives

Never skip step 1 or 2 to get to step 3 faster.

---

## 4. Text Management [SHOULD]

**SHOULD:**
- No hardcoded strings scattered across components.
- Maintain a centralized strings/copy file from day one, even if not localizing.

```
src/constants/strings.ts    (web)
App/Resources/Strings/      (iOS)
lib/constants/strings.dart  (Flutter)
```
