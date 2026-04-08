# Security Essentials

Applies when shipping to production or touching authentication, authorization, or user input handling. These are the non-negotiable minimum — not a comprehensive guide.

---

## 1. Input & Injection [MUST]

- Validate every field from the client with a schema library (zod, pydantic, validator, Bean Validation)
- Use parameterized queries / prepared statements for SQL — never string concatenation
- Escape user data in HTML output — no `innerHTML` / `dangerouslySetInnerHTML` with user content
- Limit request body size at both the reverse proxy and the app level

## 2. Authentication [MUST]

- Hash passwords with Argon2id or bcrypt (cost ≥ 12) — never MD5, SHA-1, or SHA-256
- Set `HttpOnly`, `Secure`, `SameSite=Lax` on session cookies
- Never store tokens in `localStorage` — use HttpOnly cookies
- Invalidate sessions server-side on logout
- Return identical error messages for "user not found" and "wrong password"

## 3. Authorization [MUST]

- Check authorization on every endpoint, not just authentication
- Verify object-level ownership before every update/delete: `WHERE id = ? AND user_id = ?`
- Use UUIDs or opaque slugs for user-owned resources — no sequential integer IDs in URLs

## 4. Secrets [MUST]

- Never commit secrets to git — add `.env*` to `.gitignore`
- Load secrets from environment variables or a secrets manager
- Rotate any secret that was ever committed (git history is permanent)
- Never put secrets in frontend code or environment variables prefixed with `NEXT_PUBLIC_*`, `VITE_*`, etc.

## 5. Headers & CORS [MUST]

- Set security headers: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP
- Remove `X-Powered-By` and `Server` headers
- Never use `Access-Control-Allow-Origin: *` on authenticated endpoints

## 6. Rate Limiting [MUST]

- Rate limit every authentication endpoint (login, signup, password reset) — 5/min per IP minimum
- Have a global default rate limit on all endpoints

## Full Guide

For comprehensive hardening with code examples, checklists, and validation tests across Go, Node, Python, Java, .NET:
`~/.claude/commands/cg-security-hardening.md`
