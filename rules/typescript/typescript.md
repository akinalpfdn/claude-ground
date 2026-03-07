# TypeScript / React Rules

Extends `common/` rules and `common/frontend.md`.

---

## 1. Component Granularity [MUST]

One component, one responsibility. A component that fetches AND renders, or manages form state AND displays results, must be split.

Page-level components are thin composers — no logic, only layout and composition.

```
features/UserProfile/
  UserProfilePage.tsx     ← route entry, composes below
  UserProfileHeader.tsx
  UserProfileStats.tsx
  useUserProfile.ts       ← all data fetching and state
  userProfile.types.ts
```

---

## 2. API Layer Separation [MUST]

Network calls are never made directly inside components.

```
services/userService.ts   ← API calls only
hooks/useUser.ts          ← wraps service + React Query
components/UserCard.tsx   ← calls hook, renders state
```

Components call hooks. Hooks call services. Services call the network. Nothing skips a layer.

Base URL, auth token injection, and default headers live in a single axios instance or fetch wrapper — not repeated per call.

---

## 3. State Management [MUST]

Server state uses React Query, SWR, or RTK Query. Never manually manage loading/error/data with three separate `useState` calls.

Global client state uses one solution per project. Mixing Zustand and Context and Redux in the same project requires a documented decision.

---

## 4. TypeScript Strictness [MUST]

`strict: true` in `tsconfig.json`. Non-negotiable.

`any` is forbidden. Use `unknown` and narrow it.

`as` type assertions and non-null assertions (`!`) require an inline comment explaining why the type system cannot infer this:
```typescript
// API returns correct shape but generated types don't reflect optional fields yet
const user = data as User
```

---

## 5. Testing [SHOULD]

Component tests use React Testing Library. Test behavior, not implementation:

```typescript
// Correct — tests what the user sees
expect(screen.getByText('Welcome, Alice')).toBeInTheDocument()

// Forbidden — tests implementation detail
expect(wrapper.find('UserGreeting').prop('name')).toBe('Alice')
```

Hook logic is tested with `renderHook`. Service functions are unit tested independently with mocked fetch/axios.

Do not test that a component calls a function — test what changes in the UI when it does.
