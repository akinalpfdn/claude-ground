# TypeScript / React Rules

Extends `common/core.md` and `common/frontend.md`. These rules apply to every TypeScript/React project.

---

## 1. Component Granularity

One component, one responsibility. If a component:
- Fetches data AND renders it → split
- Manages form state AND displays results → split
- Has more than one reason to re-render → split

Component size is a smell, not a rule — but components over 150 lines almost always have hidden responsibilities. Review them.

```
features/
  UserProfile/
    UserProfilePage.tsx       ← route entry, composes below
    UserProfileHeader.tsx
    UserProfileStats.tsx
    useUserProfile.ts         ← all data fetching / state
    userProfile.types.ts
```

Page-level components are thin composers. They do not contain logic.

---

## 2. State Management

Local state (`useState`) is for UI-only concerns: open/closed, hover, input value before submit.

Server state (anything fetched) uses a dedicated library — React Query, SWR, or RTK Query. Never manually manage loading/error/data with three separate `useState` calls.

Global client state (auth, theme, user preferences) uses a single solution per project — Zustand, Redux, or Context. Mixing multiple global state solutions in one project requires a documented decision in `DECISIONS.md`.

State shape is typed strictly. No `any`, no optional chains masking missing types:
```typescript
// Forbidden
const [data, setData] = useState<any>(null)

// Correct
const [user, setUser] = useState<User | null>(null)
```

---

## 3. API Layer

Network calls are never made directly inside components. Ever.

All API calls live in a dedicated service layer:
```
src/
  services/
    userService.ts     ← all user-related API calls
    orderService.ts
  hooks/
    useUser.ts         ← wraps service + React Query
```

Components call hooks. Hooks call services. Services call the network.

API responses are typed at the boundary — not inferred from usage. Define response types explicitly and validate them (zod or equivalent) if the API is external.

Base URL, headers, and auth token injection are handled in a single axios instance or fetch wrapper. Not repeated per call.

---

## 4. TypeScript Strictness

`tsconfig.json` has `strict: true`. Non-negotiable.

`any` is forbidden. If a type is genuinely unknown, use `unknown` and narrow it.

`as` type assertions require a comment explaining why the type system cannot infer this correctly:
```typescript
// Forbidden
const user = data as User

// Acceptable only with explanation
// API returns correct shape but tRPC types don't reflect optional fields yet
const user = data as User
```

Non-null assertions (`!`) follow the same rule — comment or remove.

---

## 5. File & Folder Conventions

Feature folders contain everything related to that feature. No cross-feature imports except through `shared/` or `core/`.

```
src/
  features/
    auth/
    user/
    order/
  shared/
    components/    ← generic UI primitives only
    hooks/         ← generic hooks only
    utils/
  core/
    api/
    router/
    theme/         ← see frontend rules
```

Barrel exports (`index.ts`) for each feature and shared folder. No deep imports from outside a feature:
```typescript
// Correct
import { UserCard } from '@/features/user'

// Forbidden
import { UserCard } from '@/features/user/components/UserCard/UserCard'
```
