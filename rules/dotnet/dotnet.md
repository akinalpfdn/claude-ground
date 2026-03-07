# .NET / C# Rules

Extends `common/` rules.

---

## 1. Dependency Injection [MUST]

Constructor injection only for mandatory dependencies. `[Autowired]` field injection is forbidden.

Service lifetimes must be correct — captive dependency (Scoped injected into Singleton) is a runtime bug the compiler will not catch. Reason through lifetimes explicitly.

Interfaces are defined for all services crossing layer boundaries.

---

## 2. Layered Architecture [MUST]

Dependencies point inward only:

```
API / Presentation
    ↓
Application (Services, Use Cases)
    ↓
Domain (Entities, Interfaces)
    ↑
Infrastructure (Repositories, DB, external APIs)
```

`DbContext` is never used directly in controllers or application services. Always wrapped in a repository.

Repository interfaces live in Domain. Implementations live in Infrastructure.

---

## 3. Exception Handling [MUST]

Global exception middleware handles all unhandled exceptions. Controllers do not catch and swallow.

Business rule violations are domain results, not exceptions:
```csharp
// Forbidden
throw new Exception("User not found");

// Correct
return Result<User>.Failure("User not found");
```

`catch (Exception)` without rethrowing requires a comment explaining why swallowing is intentional.

---

## 4. Async [MUST]

No `.Result` or `.Wait()` on Tasks in ASP.NET contexts — causes deadlocks.

`CancellationToken` is passed through the entire call chain for all I/O operations. Not optional.

---

## 5. API Versioning [SHOULD]

All APIs are versioned from day one. URL segment versioning is the default (`/api/v1/`). Breaking changes increment the major version. Old versions are not removed without a documented deprecation period.

---

## 6. Testing [SHOULD]

Unit tests do not load the ASP.NET host — they test classes directly with mocked dependencies (Moq or NSubstitute).

Integration tests use `WebApplicationFactory<T>` with a real test database (use Testcontainers, not SQLite-in-memory — it masks SQL Server-specific behavior).

Test method names describe behavior:
```csharp
// Correct
void Should_ReturnNotFound_When_UserDoesNotExist()

// Forbidden
void TestGetUser()
```
