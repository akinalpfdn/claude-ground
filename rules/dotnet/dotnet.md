# .NET / C# Rules

Extends `common/core.md`. These rules apply to every .NET project.

---

## 1. Dependency Injection

The built-in `Microsoft.Extensions.DependencyInjection` container is the default. No service locator pattern (`IServiceProvider` resolved manually inside classes). No static dependencies.

Service lifetimes are explicit and correct:
| Lifetime | Use for |
|----------|---------|
| `Singleton` | Stateless services, configuration, caches |
| `Scoped` | Per-request services, DbContext, unit of work |
| `Transient` | Lightweight, stateless utilities |

Captive dependency (injecting Scoped into Singleton) is forbidden. The compiler will not catch this — you must reason about it.

Interfaces are defined for all services that cross layer boundaries. Concrete types are only injected within the same layer.

---

## 2. Repository + Service Layer

Architecture is layered. Dependencies point inward only:

```
API / Presentation
    ↓
Application (Services, Use Cases)
    ↓
Domain (Entities, Interfaces)
    ↑
Infrastructure (Repository implementations, DB, external APIs)
```

`DbContext` is never used directly in controllers or application services. It is always wrapped in a repository.

Repository interfaces are defined in the Domain layer. Implementations live in Infrastructure. Application services depend on the interface, never the implementation.

---

## 3. Exception Handling

Global exception handling is configured at the application level (middleware or `UseExceptionHandler`). Controllers do not catch and swallow exceptions.

Business rule violations are not exceptions — they are domain results:
```csharp
// Forbidden — business logic as exception
throw new Exception("User not found");

// Correct — explicit result
public record Result<T>(T? Value, string? Error, bool IsSuccess);
```

Exceptions are for genuinely exceptional conditions: infrastructure failures, unexpected states. Not for control flow.

`catch (Exception e)` without rethrowing or specific handling is forbidden unless at a global boundary.

---

## 4. API Versioning

All APIs are versioned from day one. Default strategy: URL segment (`/api/v1/`).

```csharp
builder.Services.AddApiVersioning(options => {
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
});
```

Breaking changes always increment the major version. A new version never removes the old one without a documented deprecation period.

---

## 5. Async Conventions

All I/O is async. No `.Result` or `.Wait()` on Tasks — this causes deadlocks in ASP.NET contexts.

```csharp
// Forbidden
var user = userService.GetUserAsync(id).Result;

// Correct
var user = await userService.GetUserAsync(id);
```

Method names that return `Task` end in `Async`. No exceptions.

`CancellationToken` is passed through the entire call chain from controller to repository for all I/O operations.

```csharp
// Correct
public async Task<User> GetUserAsync(string id, CancellationToken ct = default)
```
