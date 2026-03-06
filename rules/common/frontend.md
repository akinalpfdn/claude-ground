# Frontend Rules — UI Projects

Applies to any project with a user interface: web, mobile, desktop.

---

## 1. No Inline Anything

Inline styles, inline colors, inline fonts — all forbidden.

**Before writing a single component:**
- Create a theme/token file
- Define all colors, typography, spacing as named variables
- Every component imports from this file

**React/TypeScript:**
```
src/
└── theme/
    ├── colors.ts
    ├── typography.ts
    ├── spacing.ts
    └── index.ts
```

**Swift/SwiftUI:**
```
App/
└── Theme/
    ├── Colors.swift
    ├── Typography.swift
    └── Spacing.swift
```

**Flutter:**
```
lib/
└── theme/
    ├── app_colors.dart
    ├── app_text_styles.dart
    └── app_theme.dart
```

If these files don't exist yet, create them before the first component. Not after.

---

## 2. No Generic AI Design

Default AI aesthetics are forbidden:
- Purple/blue gradients on white backgrounds
- Inter, Roboto, Arial, system-ui as primary fonts
- Card-everywhere layouts with no visual hierarchy
- Symmetric, predictable, safe compositions
- Color palettes that look like they came from a design system tutorial

**Instead:**
- Commit to a clear visual direction before writing code
- Pick a tone: brutalist, editorial, minimal-luxury, playful, industrial — anything with intention
- Use color with restraint and contrast, not decoration
- Typography should carry weight — choose fonts that are distinctive
- Layouts should have a point of view

**When no design brief is given:** Ask. Even one sentence ("dark, dense, developer tool aesthetic") is enough to avoid generic output.

---

## 3. Text Management

No hardcoded strings scattered across components.

Maintain a centralized strings/copy file:
```
src/constants/strings.ts   (web)
App/Resources/Strings/     (iOS)
lib/constants/strings.dart (Flutter)
```

Localization-ready from day one, even if you're not localizing yet.

---

## 4. Theme Before Components

Strict order:
1. Define theme tokens
2. Define base/primitive components (Button, Text, Input)
3. Build feature components on top of primitives

Never skip step 1 or 2 to get to step 3 faster.
