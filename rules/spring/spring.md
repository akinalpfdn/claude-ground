# Spring / Java Rules

Extends `common/` rules.

---

## 1. Constructor Injection [MUST]

Constructor injection is the only acceptable style for mandatory dependencies:

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

`@Autowired` field injection is forbidden — it hides dependencies, prevents immutability, and breaks testability.

---

## 2. Layered Architecture [MUST]

```
Controller     ← HTTP only, no business logic
    ↓
Service        ← business logic, orchestration
    ↓
Repository     ← data access only
    ↓
Entity         ← JPA entities
```

Controllers never call repositories. Services never contain JPQL directly.

DTOs at the controller boundary — JPA entities are never serialized to API responses directly.

---

## 3. Exception Handling [MUST]

`@RestControllerAdvice` handles all exceptions globally. Controllers do not have try/catch for business exceptions.

Checked exceptions from libraries are caught at the infrastructure layer and rethrown as unchecked domain exceptions. They do not bubble to the service layer as checked exceptions.

---

## 4. Transactions [MUST]

`@Transactional` is applied at the service layer. Read-only operations use `@Transactional(readOnly = true)` — not optional, it enables query optimizations.

`@Transactional` on `private` methods has no effect due to Spring's proxy-based AOP. If you need transactional behavior in a private method, restructure.

---

## 5. API Versioning [SHOULD]

All APIs versioned from day one with URL segments (`/api/v1/`). Breaking changes introduce a new version — old versions remain available until formally deprecated.

---

## 6. Testing [SHOULD]

Unit tests do not load the Spring context. They test classes directly with Mockito mocks — fast, no infrastructure.

Integration tests use `@SpringBootTest` with `@Testcontainers` for real infrastructure. No H2 in-memory database — it masks SQL compatibility issues with production databases.

Test method names describe behavior:
```java
// Correct
@Test
void shouldReturnNotFoundWhenUserDoesNotExist()

// Forbidden
@Test
void testGetUser()
```

Every Repository has an integration test that verifies queries against a real database (Testcontainers).
