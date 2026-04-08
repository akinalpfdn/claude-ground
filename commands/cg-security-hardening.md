---
name: cg-security-hardening
description: Harden an indie-scale production app against common attacks — rate limiting, CORS, security headers, input validation, secrets management, authentication, and dependency scanning. Use when the user mentions security, hardening, rate limit, CORS, CSRF, XSS, injection, auth, JWT, secrets, environment variables, dependency vulnerabilities, OWASP, "is my app secure", "how do I prevent", or is about to ship to production. Aligned with OWASP Top 10 2025. NOT for penetration testing, red team exercises, compliance audits (SOC2/HIPAA/PCI), or enterprise WAF configuration.
---

# cg-security-hardening

Close the most common attack surfaces on an indie-scale production web app. Targets solo devs and small teams who do not have a dedicated security engineer, aligned with OWASP Top 10 2025 priorities. The goal is to raise the cost of attack from "trivial" to "not worth the effort" — not to achieve enterprise-grade security posture.

## Scope

**This skill covers:**
- Rate limiting (global and endpoint-specific)
- CORS configuration (without breaking your own frontend)
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Input validation and output encoding
- Secrets management (env vars, rotation, what to never commit)
- Authentication patterns (passwords, sessions, JWT, MFA)
- Authorization patterns (IDOR prevention, least privilege)
- Dependency scanning and supply chain hygiene
- Error handling that does not leak internal details
- Security logging (what to log, what to never log)
- Safe file upload handling
- SQL injection and XSS prevention

**This skill does NOT cover:**
- Penetration testing or red team exercises (use a pentester)
- Compliance audits (SOC2, HIPAA, PCI-DSS, GDPR legal advice)
- Enterprise WAF configuration (Cloudflare/Akamai/AWS WAF beyond basic setup)
- Full SAST/DAST pipeline integration (separate CI/CD concern)
- Security incident response playbooks
- Bug bounty program setup
- Cryptographic protocol design (use vetted libraries, don't invent)
- Supply chain attack forensics

If the user needs any of the excluded items, recommend specialized tools or services instead of attempting them with this skill.

## Required context — gather before generating anything

MUST have answers to these before producing code or config. Ask the user directly if unclear.

1. **What language/framework is the app?** — affects library choices:
   - Go → `chi` or `gin` middleware, `validator` for input, `golang-jwt`
   - Node.js → `helmet`, `express-rate-limit`, `cors`, `zod`/`joi` for validation
   - Python → `Flask-Limiter`/`slowapi`, `pydantic` for validation, `secure` for headers
   - Rust → `tower-http` middleware, `validator` crate
   - Java / Spring Boot → Spring Security, Bucket4j for rate limiting, Bean Validation (JSR-380)
   - .NET → built-in `AspNetCoreRateLimit`, `FluentValidation`, `Microsoft.AspNetCore.Authentication.JwtBearer`

2. **What does the app expose?**
   - Public HTML pages with forms (traditional web app)
   - Public API consumed by a frontend SPA (CORS matters)
   - Public API consumed by mobile apps (CORS irrelevant, auth critical)
   - Internal API only (different threat model, still needs hardening)
   - Mix of the above

3. **What authentication model?**
   - Session cookies (traditional web app)
   - JWT bearer tokens (SPA/mobile)
   - OAuth via provider (Google, GitHub, Apple)
   - API keys (service-to-service)
   - None yet (the user may be at "I just shipped it" stage)

4. **Is there user-generated content?**
   - File uploads? → sandbox, type validation, size limits, virus scan
   - Rich text / markdown? → sanitization library needed
   - Plain text only? → simpler threat model

5. **Is the app already in production, or pre-launch?**
   - Pre-launch → ideal time for full hardening, no breaking changes
   - In production → incremental hardening, measure each change, avoid breaking active users

6. **What's the threat model?** (ask explicitly if unclear)
   - Random bots and script kiddies → baseline hardening is enough
   - Targeted attacks from motivated actors → need deeper review, maybe a pentester
   - Sensitive data (PII, health, financial) → compliance concerns, needs legal review too

## The seven pillars of indie-scale hardening

Ordered by impact-to-effort ratio. Start from pillar 1. Do not skip to pillar 7 before pillars 1-3 are done.

### Pillar 1 — Rate limiting (stops the most common attacks cheaply)

**Why first**: Credential stuffing, brute force, enumeration, and scraping all rely on high request volume. Rate limiting stops 90% of opportunistic attacks with a single middleware.

**Rules**:
- **MUST** rate limit every authentication endpoint (`/login`, `/signup`, `/password-reset`, `/verify-email`, `/mfa-challenge`) — stricter than everything else
- **MUST** have a global default rate limit on all endpoints
- **SHOULD** have stricter limits on expensive operations (search, export, file upload, AI calls)
- **SHOULD** return `429 Too Many Requests` with `Retry-After` header, not silently drop
- **SHOULD** include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every response
- **SHOULD** rate limit by authenticated user ID when available, falling back to IP for anonymous requests
- **MUST NOT** rely on client IP alone behind a reverse proxy without reading `X-Forwarded-For` correctly
- **MUST NOT** set limits so tight that legitimate users hit them (start loose, tighten with real data)
- **SHOULD** prefer sliding window or token bucket algorithms over fixed windows — fixed windows allow burst-at-boundary attacks (e.g., 100 requests at 0:59 + 100 at 1:00 = 200 in 2 seconds)

**Baseline limits** (adjust per app):
| Endpoint type | Limit |
|---|---|
| Login / signup | 5 per minute per IP, 10 per hour per IP |
| Password reset request | 3 per hour per email |
| General API (authenticated) | 100 per minute per user |
| General API (anonymous) | 30 per minute per IP |
| Expensive operations (search, export) | 10 per minute per user |
| Webhook receive endpoints | Based on provider docs |

**Go (chi + httprate)**:
```go
import "github.com/go-chi/httprate"

r := chi.NewRouter()

// Global limit
r.Use(httprate.LimitByIP(100, time.Minute))

// Stricter limit on auth endpoints
r.Group(func(r chi.Router) {
    r.Use(httprate.LimitByIP(5, time.Minute))
    r.Post("/login", loginHandler)
    r.Post("/signup", signupHandler)
})
```

**Node.js (express-rate-limit)**:
```javascript
import rateLimit from 'express-rate-limit';

const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,  // RateLimit-* headers
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
});

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    skipSuccessfulRequests: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
```

**Python (slowapi for FastAPI)**:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request): ...
```

**Java / Spring Boot (Bucket4j)**:
```java
@Bean
public FilterRegistrationBean<RateLimitFilter> rateLimitFilter() {
    FilterRegistrationBean<RateLimitFilter> bean = new FilterRegistrationBean<>();
    bean.setFilter(new RateLimitFilter(
        Bucket.builder()
            .addLimit(Bandwidth.classic(100, Refill.intervally(100, Duration.ofMinutes(1))))
            .build()
    ));
    bean.addUrlPatterns("/api/*");
    return bean;
}
```

**.NET (AspNetCoreRateLimit)**:
```csharp
// Program.cs
builder.Services.AddRateLimiter(options => {
    options.AddFixedWindowLimiter("general", opt => {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
    });
    options.AddFixedWindowLimiter("auth", opt => {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
    });
});

app.MapPost("/login", ...).RequireRateLimiting("auth");
```

**Behind a reverse proxy**: configure the framework to trust `X-Forwarded-For` from your proxy's IP only. Trusting it blindly lets attackers spoof their IP and bypass limits entirely.

### Pillar 2 — Security headers (one middleware, huge impact)

**Why high priority**: Most security headers are a single line of config that closes entire vulnerability classes (clickjacking, MIME sniffing, protocol downgrade, XSS via inline scripts).

**Essential headers**:

| Header | Purpose | Recommended value |
|---|---|---|
| `Strict-Transport-Security` | Force HTTPS, prevent downgrade | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | Disable MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` or `SAMEORIGIN` |
| `Referrer-Policy` | Control referrer leakage | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Block inline scripts, restrict sources | App-specific, see below |
| `Permissions-Policy` | Disable unused browser features | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | Isolate browsing context | `same-origin` |

**Remove these headers** (they leak framework info):
- `X-Powered-By`
- `Server` (or set to generic value)
- Any header revealing version numbers

**Subresource Integrity (SRI)** — if loading any script or stylesheet from a CDN, always include an `integrity` hash. This prevents compromised CDNs from injecting malicious code:
```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-abc123..."
        crossorigin="anonymous"></script>
```
Generate hashes with `shasum -b -a 384 lib.js | awk '{ print $1 }' | xxd -r -p | base64` or use [srihash.org](https://srihash.org).

**Content Security Policy** is the hardest to get right. Start with `default-src 'self'` and add exceptions for third-party resources (Stripe, Google Fonts, analytics) one by one. Test in report-only mode first:
```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://js.stripe.com; report-uri /csp-report
```
Monitor `/csp-report` for a week, then flip to enforcing mode.

**Node.js (helmet — one line does most of it)**:
```javascript
import helmet from 'helmet';

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://js.stripe.com"],
            imgSrc: ["'self'", "data:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'"],  // or nonce-based if possible
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

**Go (secure middleware)**:
```go
import "github.com/unrolled/secure"

secureMiddleware := secure.New(secure.Options{
    STSSeconds:           31536000,
    STSIncludeSubdomains: true,
    STSPreload:           true,
    ContentTypeNosniff:   true,
    FrameDeny:            true,
    ReferrerPolicy:       "strict-origin-when-cross-origin",
    ContentSecurityPolicy: "default-src 'self'",
})
r.Use(secureMiddleware.Handler)
```

**Caddy (set at reverse proxy level — easiest if using cg-indie-deploy)**:
```
example.com {
    reverse_proxy localhost:8080
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
        -X-Powered-By
    }
}
```

Setting headers at the reverse proxy level means they apply regardless of what the app does. This is the most foolproof approach.

### Pillar 3 — CORS (easy to get wrong, critical to get right)

**Rules**:
- **MUST** specify exact origins, never `*` for authenticated endpoints
- **MUST NOT** dynamically reflect any `Origin` header value without whitelist validation
- **MUST** include `Vary: Origin` when reflecting origins (prevents cache poisoning)
- **MUST NOT** use `Access-Control-Allow-Credentials: true` with `Access-Control-Allow-Origin: *` (browsers reject this, but catching it fast matters)
- **SHOULD** restrict `Access-Control-Allow-Methods` to what you actually use
- **SHOULD** set a reasonable `Access-Control-Max-Age` (86400 = 24h) to reduce preflight overhead
- **MUST NOT** trust `Origin: null` — reject it explicitly

**Decision tree**:
- Public API consumed by your own frontend → allow specific domain(s) only
- Public API for third parties → require API key auth and whitelist per-key
- Internal API only → allow only internal domains
- No browser consumer at all (mobile app only) → disable CORS entirely, it serves no purpose for non-browser clients

**Node.js (cors)**:
```javascript
import cors from 'cors';

const allowedOrigins = [
    'https://app.example.com',
    'https://admin.example.com',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
}));
```

**Go (rs/cors)**:
```go
import "github.com/rs/cors"

c := cors.New(cors.Options{
    AllowedOrigins: []string{"https://app.example.com"},
    AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
    AllowCredentials: true,
    MaxAge: 86400,
})
handler := c.Handler(r)
```

**Common mistake to catch**: developers add `Access-Control-Allow-Origin: *` during debugging, ship it, and forget. Grep the codebase for `*` in CORS config before any production deploy.

### Pillar 4 — Input validation and output encoding (prevents injection + XSS)

**Input validation rules**:
- **MUST** validate every field that comes from the client (body, query, headers, cookies, URL params)
- **MUST** use an allow-list (whitelist), not a block-list (blacklist)
- **MUST** validate type, length, format, and range
- **MUST** limit request body size at the server/proxy level (not just the framework)
- **SHOULD** use a schema validation library, not hand-rolled checks
- **MUST NOT** trust `Content-Type`, `User-Agent`, or any header without validation
- **MUST NOT** use client-side validation as the only defense — it's a UX feature, not a security control

**Output encoding rules**:
- **MUST** escape user-controlled data when rendering HTML, JSON, SQL, shell commands, or log messages
- **MUST** use parameterized queries / prepared statements for SQL — never string concatenation
- **MUST** use context-aware encoding (HTML body ≠ HTML attribute ≠ JavaScript ≠ URL)
- **SHOULD** use template engines that auto-escape by default (React, Jinja2, Thymeleaf, Razor)
- **MUST NOT** use `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, or equivalents with user data

**SQL injection** — this is still #5 on OWASP 2025 because people still do this:
```javascript
// ❌ NEVER
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✓ Parameterized
db.query('SELECT * FROM users WHERE email = $1', [email]);

// ✓ ORM (also safe)
await prisma.user.findUnique({ where: { email } });
```

**Schema validation examples**:

**Node.js (zod)**:
```javascript
import { z } from 'zod';

const SignupSchema = z.object({
    email: z.string().email().max(255),
    password: z.string().min(12).max(128),
    name: z.string().min(1).max(100),
    age: z.number().int().min(13).max(120),
});

app.post('/signup', (req, res) => {
    const result = SignupSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: 'invalid_input', details: result.error.issues });
    }
    // Use result.data — typed and validated
});
```

**Python (pydantic)**:
```python
from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=13, le=120)

@app.post("/signup")
async def signup(data: SignupRequest):  # auto-validates
    ...
```

**Go (validator)**:
```go
type SignupRequest struct {
    Email    string `json:"email" validate:"required,email,max=255"`
    Password string `json:"password" validate:"required,min=12,max=128"`
    Name     string `json:"name" validate:"required,min=1,max=100"`
    Age      int    `json:"age" validate:"required,gte=13,lte=120"`
}

validate := validator.New()
if err := validate.Struct(req); err != nil {
    // Return 400
}
```

**Java / Spring Boot (Bean Validation)**:
```java
public record SignupRequest(
    @Email @Size(max=255) String email,
    @Size(min=12, max=128) String password,
    @Size(min=1, max=100) String name,
    @Min(13) @Max(120) int age
) {}

@PostMapping("/signup")
public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest req) { ... }
```

**Body size limit** (often forgotten):
- Caddy: `request_body { max_size 1MB }`
- nginx: `client_max_body_size 1M;`
- Express: `app.use(express.json({ limit: '100kb' }))`
- Spring Boot: `spring.servlet.multipart.max-request-size=1MB`
- Set this at BOTH the reverse proxy and the app level.

### Pillar 5 — Secrets management (the most common indie mistake)

**Rules**:
- **MUST NOT** commit secrets to git, ever, even in private repos
- **MUST NOT** put secrets in frontend code, bundled JavaScript, or mobile app binaries (they are trivially extractable)
- **MUST** use environment variables or a secrets manager for all secrets
- **MUST** add `.env`, `.env.local`, `.env.production`, `*.pem`, `*.key` to `.gitignore`
- **MUST** rotate any secret that was ever committed to git (git history is forever, even after a force push)
- **SHOULD** use different secrets per environment (dev, staging, production)
- **SHOULD** scan commits for accidentally-committed secrets using pre-commit hooks
- **SHOULD** prefix secret env vars clearly (e.g., `APP_SECRET_*`) to make them easy to find and rotate
- **MUST NOT** log secrets, even at DEBUG level
- **MUST NOT** include secrets in error messages returned to clients

**What counts as a secret** (people underestimate this list):
- Database credentials
- API keys for third-party services (Stripe, SendGrid, AWS, OpenAI, etc.)
- JWT signing keys
- Session secret / cookie encryption key
- OAuth client secrets
- Webhook signing secrets
- Private keys (TLS certs, SSH keys, signing keys)
- Admin passwords and initial seed credentials
- Internal service-to-service tokens

**What is NOT a secret** (safe to expose, often confused):
- Stripe publishable keys (`pk_live_*`)
- Google Maps API keys (if domain-restricted)
- OAuth client IDs (not secrets, per spec)
- Public product identifiers

**Pre-commit secret scanning**:
```bash
# gitleaks — catches most common secret patterns
brew install gitleaks
gitleaks protect --staged

# Or add to .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

**If a secret leaks to git**:
1. **Rotate the secret immediately** — do not try to delete it from git first
2. Revoke the old secret in the provider dashboard
3. Update all systems using the new secret
4. Then, optionally, scrub git history with `git filter-repo` (but assume the old secret is public)
5. Enable secret scanning on the repo (GitHub has this free)

**Secrets managers for indie scale** (in order of simplicity):
- **Environment variables via systemd `EnvironmentFile`** — simplest, good enough for solo deployments
- **Doppler** — free tier, good DX, CLI-friendly
- **1Password Secrets Automation** — if you already use 1Password
- **AWS Secrets Manager / GCP Secret Manager** — if already in that cloud
- **HashiCorp Vault** — overkill for indie scale

### Pillar 6 — Authentication and authorization

**Session cookies vs JWT — choose correctly**:
- **For browser-facing web apps**: prefer HttpOnly session cookies with server-side session storage. This is the 2025 consensus — cookies get `HttpOnly`, `Secure`, `SameSite` for free, which are hard to replicate with JWTs.
- **For mobile apps / SPAs that cannot use cookies**: JWT with short-lived access tokens (15 min) + refresh token rotation, stored in HttpOnly cookies if possible, never in `localStorage`.
- **For service-to-service**: JWT or API keys with mutual TLS.
- **Common mistake**: choosing JWT "because it's modern" for a server-rendered web app that would be simpler and more secure with session cookies.

**OAuth provider rules (if using Google, GitHub, Apple Sign-In, etc.)**:
- **MUST** validate the `redirect_uri` against a strict allow-list — redirect URI manipulation is a common OAuth attack vector
- **MUST** use the `state` parameter to prevent CSRF on the OAuth callback
- **MUST** exchange authorization codes server-side, never in frontend JavaScript
- **SHOULD** use PKCE (Proof Key for Code Exchange) even for server-side flows — it's required for public clients and adds defense-in-depth for confidential clients
- **MUST NOT** accept tokens from the implicit flow (deprecated in OAuth 2.1)

**Password handling rules**:
- **MUST** use Argon2id, bcrypt (cost ≥ 12), or scrypt for password hashing
- **MUST NOT** use MD5, SHA-1, SHA-256, or any fast hash for passwords
- **MUST** enforce minimum password length (12+ characters recommended; stop obsessing over complexity rules)
- **SHOULD** check against known-breached passwords via HaveIBeenPwned k-anonymity API
- **MUST NOT** impose a maximum password length below 128 characters
- **MUST NOT** restrict characters in passwords (UTF-8 should all be valid)
- **MUST NOT** roll your own authentication library — use a proven one

**Session / token rules**:
- **MUST** use `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) on session cookies
- **MUST NOT** store session tokens in `localStorage` (XSS-accessible)
- **SHOULD** use short-lived access tokens (15 min) with longer-lived refresh tokens (7-30 days) for JWT-based auth
- **MUST** invalidate sessions server-side on logout — not just remove the client cookie
- **MUST** rotate session IDs on login and privilege escalation (prevents session fixation)
- **SHOULD** set reasonable session timeouts based on sensitivity (financial apps: 15 min; social apps: 30 days)

**JWT-specific rules**:
- **MUST** verify `alg` header against an expected value — never trust `alg` from the token
- **MUST NOT** accept `alg: none`
- **MUST** set `exp` claim on every token
- **SHOULD** include `iss`, `aud`, `sub` claims
- **MUST NOT** put sensitive data in JWT payload (it's base64, not encrypted)
- **SHOULD** use asymmetric signing (RS256, ES256) if multiple services verify tokens; symmetric (HS256) is fine for single-service apps

**Authorization rules (Broken Access Control is OWASP #1)**:
- **MUST** check authorization on every endpoint, not just authentication
- **MUST** check object-level permissions on every resource access (prevent IDOR)
- **MUST** enforce authorization server-side — never trust client-side checks
- **SHOULD** default to deny (allow-list approach, not block-list)
- **MUST NOT** expose internal IDs that allow enumeration (use UUIDs or opaque slugs)
- **MUST** verify ownership before any update/delete: `WHERE id = ? AND user_id = ?`

**IDOR example — the #1 indie vulnerability**:
```javascript
// ❌ BROKEN — any logged-in user can read any order
app.get('/orders/:id', auth, async (req, res) => {
    const order = await db.orders.findById(req.params.id);
    res.json(order);
});

// ✓ FIXED — only the owner can read
app.get('/orders/:id', auth, async (req, res) => {
    const order = await db.orders.findOne({
        id: req.params.id,
        userId: req.user.id,  // ownership check
    });
    if (!order) return res.status(404).json({ error: 'not_found' });
    res.json(order);
});
```

**Do not roll your own auth**. Recommended libraries:
- **Better Auth**, **Auth.js** (NextAuth), **Lucia** for Node/TypeScript
- **Authlib** or Django's built-in for Python
- **Spring Security** for Java
- **ASP.NET Identity** for .NET
- **Supabase Auth**, **Clerk**, **Auth0**, **WorkOS** for hosted solutions

### Pillar 7 — Dependency and supply chain hygiene

OWASP 2025 elevated this to #3 — it deserves attention.

**Rules**:
- **MUST** pin dependency versions in lockfiles (`package-lock.json`, `go.sum`, `Cargo.lock`, `poetry.lock`, `pom.xml` with specific versions)
- **MUST** run an automated dependency scanner at least weekly
- **SHOULD** enable Dependabot (free on GitHub) or Renovate for automatic PRs on security updates
- **SHOULD** review transitive dependencies before adding a new direct dependency
- **MUST** remove unused dependencies (they still contribute to attack surface)
- **SHOULD** generate an SBOM (Software Bill of Materials) for production releases
- **MUST NOT** install packages with no recent activity, low star count, or suspicious maintainer changes without review
- **MUST NOT** auto-merge dependency updates without CI running — supply chain attacks can slip in

**Per-ecosystem scanning**:
```bash
# Node.js
npm audit
npm audit fix

# Python
pip-audit
safety check

# Go
govulncheck ./...

# Rust
cargo audit

# Ruby
bundle audit

# Java (Maven)
mvn dependency-check:check

# .NET
dotnet list package --vulnerable --include-transitive
```

**GitHub Dependabot setup** (`.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Slopsquatting and AI-generated package names**: Recent attack trend — LLM coding assistants hallucinate package names, attackers register them with malicious code. Always verify that a package Claude Code suggests actually exists on the official registry before installing. Do not run `npm install <something-claude-suggested>` without checking `npmjs.com/package/<name>` first for weekly downloads, maintainer, and creation date.

## SSRF prevention (if your app fetches URLs)

If your app fetches user-provided URLs (webhooks, link previews, image proxying, RSS readers, PDF generation from URLs), you are vulnerable to Server-Side Request Forgery.

**Rules**:
- **MUST** block requests to private/internal IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` — the cloud metadata endpoint)
- **MUST** block requests to `localhost`, `0.0.0.0`, and IPv6 loopback (`::1`)
- **MUST** resolve DNS before connecting and check the resolved IP against the block list — attackers use DNS rebinding to bypass hostname checks
- **SHOULD** use an allow-list of permitted domains when possible (e.g., only fetch from known webhook providers)
- **MUST NOT** follow redirects blindly — a redirect can point to an internal IP after passing the initial check
- **MUST NOT** expose raw response bodies from fetched URLs to users without sanitization

**Cloud metadata is the prize**: On AWS, `http://169.254.169.254/latest/meta-data/` returns IAM credentials. On GCP, similar at `http://metadata.google.internal/`. A single SSRF can compromise your entire cloud account. If on AWS, enforce IMDSv2 (requires a token header that SSRF attacks can't easily set).

## AI/LLM integration security (if your app uses LLM APIs)

If your app sends user input to an LLM API (OpenAI, Anthropic, etc.), you have a new attack surface.

**Rules**:
- **MUST** treat user input flowing into prompts as untrusted — never concatenate user input directly into system prompts without sanitization
- **MUST** validate and constrain LLM outputs before acting on them (especially if the LLM generates SQL, code, or commands)
- **MUST NOT** give the LLM access to tools/functions that can modify data without a human-in-the-loop or strict validation
- **SHOULD** separate system instructions from user input with clear delimiters and instruct the model to ignore instruction-like patterns in user input
- **SHOULD** log all LLM interactions for abuse detection (but never log API keys)
- **MUST** rate limit LLM-powered endpoints aggressively — they are expensive and attractive targets for abuse

This is an evolving field. There is no OWASP-equivalent standard yet, but the [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) provides a starting framework.

## File upload security (if applicable)

If the app accepts file uploads, these are non-negotiable:

- **MUST** validate file type by content (magic bytes), not just extension or `Content-Type`
- **MUST** use a strict allow-list of accepted types
- **MUST** set a hard size limit at the proxy level and at the app level
- **MUST** store uploads outside the web root — never serve them from the same directory as application code
- **MUST** generate new filenames (UUIDs) — never use user-provided filenames
- **MUST** set strict `Content-Type` on serving (prevent MIME sniffing)
- **SHOULD** serve uploads from a separate domain or subdomain (cookie isolation)
- **SHOULD** scan uploads for malware if they will be shared with other users (ClamAV, VirusTotal API)
- **MUST NOT** allow uploads of executables, scripts, or archive files that can contain them
- **MUST NOT** pass user-uploaded files to shell commands, even with escaping

## Error handling that doesn't leak

OWASP 2025 added "Mishandling of Exceptional Conditions" as a new category (#10).

**Rules**:
- **MUST NOT** return stack traces to clients in production
- **MUST NOT** return database error messages to clients
- **MUST NOT** reveal whether a username/email exists in login errors ("user not found" vs "wrong password" — both must say the same generic thing)
- **SHOULD** use generic error messages for clients, detailed logs for developers
- **MUST** fail closed — if authorization check fails unexpectedly, deny access, don't allow it
- **SHOULD** return a stable error identifier the user can reference in support requests
- **MUST NOT** fail open on security-critical paths (if the rate limiter errors, block the request; don't let it through)

**Error response template**:
```json
{
    "error": "invalid_request",
    "message": "The request could not be processed.",
    "request_id": "req_abc123"
}
```

The `request_id` correlates with detailed server-side logs (see `cg-indie-observability`).

## Security logging

**Log these**:
- Failed login attempts (email and IP, NOT the attempted password)
- Rate limit violations
- Authorization failures (user X tried to access resource Y)
- Password reset requests
- Changes to security-sensitive settings (email, password, MFA, API keys)
- New device / new IP logins
- Admin actions
- Input validation failures on sensitive endpoints

**Never log these**:
- Passwords (even hashed — no reason to log them)
- Session tokens or JWT contents
- API keys or secrets
- Full credit card numbers, SSNs, or national IDs
- Raw request bodies that might contain any of the above

See `cg-indie-observability` for structured logging patterns.

## Pre-launch security checklist

Before shipping to production, verify every item. This takes about an hour and catches most indie-scale vulnerabilities.

**Foundation**
- [ ] HTTPS enforced everywhere, HTTP redirects to HTTPS
- [ ] HSTS header set with `max-age` ≥ 6 months
- [ ] TLS certificate valid and auto-renewing
- [ ] All security headers present (test at securityheaders.com)
- [ ] `X-Powered-By` and `Server` headers removed

**Rate limiting**
- [ ] Global rate limit active on all endpoints
- [ ] Stricter rate limit on login/signup/password-reset
- [ ] Rate limit tested with a script (see validation section)
- [ ] `429` responses return `Retry-After` header

**CORS**
- [ ] No `Access-Control-Allow-Origin: *` in production
- [ ] Origin allow-list matches actual frontend domains
- [ ] `Vary: Origin` set when dynamically reflecting origins

**Input validation**
- [ ] Every endpoint validates input with a schema library
- [ ] Request body size limited at proxy and app level
- [ ] Parameterized queries everywhere (no string concatenation in SQL)
- [ ] No `innerHTML` / `dangerouslySetInnerHTML` with user data

**Secrets**
- [ ] No secrets in git history (`git log --all -p | gitleaks detect --pipe`)
- [ ] `.env*` in `.gitignore`
- [ ] All production secrets loaded from environment, not files in repo
- [ ] Pre-commit hook for secret scanning active
- [ ] Frontend bundle contains no secret keys

**Authentication**
- [ ] Passwords hashed with Argon2id or bcrypt (cost ≥ 12)
- [ ] Session cookies have `HttpOnly`, `Secure`, `SameSite` flags
- [ ] No tokens in `localStorage`
- [ ] Session invalidated server-side on logout
- [ ] Login error messages do not reveal whether email exists
- [ ] MFA available for admin accounts

**Authorization**
- [ ] Every endpoint has an authorization check, not just authentication
- [ ] Object-level ownership checks on every update/delete
- [ ] No sequential integer IDs exposed for user-owned resources
- [ ] Admin endpoints require a separate role check

**Dependencies**
- [ ] Dependency scanner ran with zero critical issues
- [ ] Dependabot / Renovate enabled
- [ ] Lockfile committed
- [ ] No dev dependencies in production build

**Error handling**
- [ ] Production error responses contain no stack traces
- [ ] Database errors are never returned to clients
- [ ] 500 errors log full detail server-side with request ID
- [ ] Failing closed on security checks verified with a test

**Logging**
- [ ] Failed logins logged with email + IP
- [ ] Authorization failures logged
- [ ] No passwords, tokens, or secrets in logs (grep the last day's logs to verify)

**File uploads** (if applicable)
- [ ] Content-type validation by magic bytes, not extension
- [ ] Size limits enforced
- [ ] Stored outside web root
- [ ] New filenames generated, user filenames never used
- [ ] Served from separate domain or with strict `Content-Type`

## Validation — proving the hardening works

After implementation, run these actual tests. A checklist the user doesn't verify is worthless.

**Rate limit test**:
```bash
# Hit login endpoint 20 times in a row
for i in {1..20}; do
    curl -o /dev/null -s -w "%{http_code}\n" https://example.com/login \
        -X POST -d '{"email":"test@test.com","password":"wrong"}' \
        -H "Content-Type: application/json"
done
# Expect: first 5 return 401, remaining return 429
```

**Security headers test**:
```bash
curl -sI https://example.com | grep -iE 'strict-transport|x-content-type|x-frame|referrer-policy|content-security'
# Or use https://securityheaders.com for a grade
```

**CORS test**:
```bash
# From a disallowed origin
curl -sI https://example.com/api/data -H "Origin: https://evil.com"
# Expect: no Access-Control-Allow-Origin in response, or it should not be 'https://evil.com'
```

**IDOR test** (requires two test accounts):
```bash
# Log in as user A, get a resource ID
# Log in as user B, try to access user A's resource by ID
curl -H "Authorization: Bearer <user_b_token>" https://example.com/api/orders/<user_a_order_id>
# Expect: 404 or 403, never 200 with user A's data
```

**Secret leak test**:
```bash
# Check frontend bundle for secrets
curl https://example.com/assets/main.js | grep -iE 'sk_live|api[_-]?key|secret|password'
# Expect: no matches (publishable keys like pk_live are OK)

# Check git history
gitleaks detect --source=. --verbose
# Expect: no findings
```

**Error leak test**:
```bash
# Send malformed requests
curl -X POST https://example.com/api/users -d '{invalid json'
curl -X POST https://example.com/api/users -d '{"email":"<script>"}'
# Expect: generic error messages, no stack traces, no DB errors
```

## Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| `CORS: *` with credentials | Any site can read authenticated responses | Explicit origin allow-list |
| Secret in frontend env var (`NEXT_PUBLIC_*`, `VITE_*`) | Secret bundled into JS, visible to anyone | Move to server-side, never prefix secrets with public env var prefixes |
| SHA-256 for passwords | Passwords cracked in minutes with GPU | Argon2id or bcrypt |
| Rate limit by IP only, no proxy trust config | Either blocks legitimate users or doesn't block anyone | Configure `trust proxy` correctly, rate limit by user ID when authenticated |
| CSP with `'unsafe-inline'` everywhere | XSS protection nullified | Use nonces or hashes; move inline scripts to external files |
| JWT stored in `localStorage` | XSS steals token → account takeover | `HttpOnly` cookie |
| Sequential integer IDs in URLs (`/orders/123`) | Enumeration + IDOR | UUIDs or opaque slugs |
| Returning `400 Bad Request` with DB error text | SQL schema leaked to attackers | Generic error + server-side logging |
| "User not found" vs "Wrong password" | User enumeration | Single generic "invalid credentials" message |
| `npm audit` ignored during deploy | Known CVE shipped to production | Fail CI on high/critical findings |
| JWT in `localStorage` for a web app | XSS → full account takeover | Use HttpOnly session cookies instead |
| No SSRF protection on URL fetch | Cloud metadata leak → full infrastructure compromise | Block private IPs, validate DNS resolution |
| User input concatenated into LLM prompt | Prompt injection → data exfiltration or unauthorized actions | Sanitize input, validate output, separate system/user context |
| CDN scripts without SRI hashes | Compromised CDN → XSS on your domain | Add `integrity` attribute to all external scripts |
| OAuth without `state` parameter | CSRF on login callback → account linking attack | Always generate and verify `state` |

## Principles

- **Defense in depth.** No single control should be the only thing standing between an attacker and sensitive data. Rate limit AND validate AND authorize.
- **Fail closed, not open.** If a security check errors out, deny the request. Never assume "it probably worked."
- **Do not invent crypto or auth.** Use libraries that have been audited by people who do this full-time. The ego cost of not rolling your own is much smaller than the cost of a breach.
- **Raise the cost of attack, don't aim for perfection.** The goal is to make your app an unattractive target compared to the thousands of unhardened apps next to it. Perfect security is impossible; good-enough security is very achievable.
- **Security headers at the reverse proxy level, not the app level.** This way they apply even if the app is misconfigured, crashed, or replaced.
- **Log security events, but never log secrets.** A good audit trail is worth more than you think when debugging a suspected incident.
- **The pre-launch checklist is non-negotiable.** Skipping it saves an hour; missing something on it can cost months of cleanup.
- **Dependencies are code you didn't write but are responsible for.** Treat them that way: scan, update, and audit.
- **Trust the browser's security model.** `HttpOnly`, `Secure`, `SameSite`, CSP, and CORS exist because they work. Use them.
