# Spring / Java Rules

Extends `common/core.md`. These rules apply to every Spring Boot project.

---

## 1. Dependency Injection

Constructor injection is the only acceptable injection style for mandatory dependencies:

```java
// Correct
@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}

// Forbidden
@Autowired
private UserRepository userRepository;
```

`@Autowired` field injection is forbidden. It makes dependencies invisible, prevents immutability, and breaks testability.

`@Qualifier` use signals that an interface has too many implementations — reconsider the design before adding qualifiers.

---

## 2. Repository + Service Layer

Layers are strictly separated:

```
Controller        ← HTTP only, no business logic
    ↓
Service           ← business logic, orchestration
    ↓
Repository        ← data access only
    ↓
Entity / Model    ← JPA entities or plain domain objects
```

Controllers do not call repositories. Services do not contain SQL or JPQL directly — that lives in repositories.

DTOs are used at the controller boundary. JPA entities are never serialized directly to API responses. MapStruct or manual mapping is acceptable — document the choice in `DECISIONS.md`.

---

## 3. Exception Handling

A global `@ControllerAdvice` / `@RestControllerAdvice` handles all exceptions. Individual controllers do not have try/catch blocks for business exceptions.

Custom exceptions extend `RuntimeException` for unchecked, or `Exception` for checked (prefer unchecked in Spring applications):

```java
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String id) {
        super("User not found: " + id);
    }
}
```

Checked exceptions from libraries (IOException, SQLException) are caught at the infrastructure layer and rethrown as domain exceptions. They do not bubble up to the service layer as checked exceptions.

---

## 4. API Versioning

All REST APIs are versioned from day one. URL segment versioning is the default:
```
/api/v1/users
/api/v2/users
```

`@RequestMapping` at the controller level includes the version prefix. Versioning is not added per-method.

Breaking changes always introduce a new version. Old versions remain available until formally deprecated and communicated.

---

## 5. Transaction Management

`@Transactional` is applied at the service layer, not the repository layer or controller.

Read-only operations are annotated with `@Transactional(readOnly = true)` — this is not optional, it enables query optimizations.

Transactions do not span HTTP requests. If a workflow requires multiple requests to complete, use a saga pattern or explicit compensation logic — not a held transaction.

`@Transactional` on `private` methods has no effect — Spring's proxy-based AOP cannot intercept them. If you need transactional behavior on a private method, restructure.

---

## 6. Testing Conventions

Unit tests use Mockito. No Spring context is loaded for unit tests — they are fast.

Integration tests use `@SpringBootTest` with `@Testcontainers` for real infrastructure (DB, Redis, etc.). No H2 in-memory database for integration tests — it masks SQL compatibility issues.

Test method names describe behavior, not implementation:
```java
// Correct
@Test
void shouldReturnNotFoundWhenUserDoesNotExist()

// Forbidden
@Test
void testGetUser()
```
