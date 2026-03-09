# Python Rules

Extends `common/` rules.

---

## 1. Project Structure [MUST]

Packages are organized by domain, not by type. No `utils.py` or `helpers.py` catch-all modules.

```
src/
  project_name/
    __init__.py
    user/
      service.py
      repository.py
      models.py
    order/
      service.py
      repository.py
    core/
      config.py
      exceptions.py

# Forbidden
utils/
  helpers.py
  misc.py
```

`src/` layout with `pyproject.toml` is the default. `setup.py` only when required by legacy tooling.

Every project has a `pyproject.toml` from day one — not added later when packaging becomes necessary.

---

## 2. Type Hints [MUST]

All function signatures have type hints. No exceptions for "simple" functions.

```python
# Correct
def get_user(user_id: str) -> User | None:

# Forbidden
def get_user(user_id):
```

`Any` is forbidden unless interfacing with an untyped third-party library — and requires an inline comment explaining why.

`mypy --strict` or `pyright` is configured from project start. Type checking is not added retroactively.

Return types are always explicit. `-> None` is not optional on functions that return nothing.

---

## 3. Error Handling [MUST]

Custom exceptions inherit from a project-level base exception, not directly from `Exception`:

```python
class AppError(Exception):
    """Base exception for this project."""

class UserNotFoundError(AppError):
    pass

class ValidationError(AppError):
    pass
```

`except Exception` without re-raising is forbidden unless at a top-level boundary (CLI entry point, API handler). Every broad catch requires a comment explaining why.

Never use exceptions for control flow. Check conditions explicitly:

```python
# Forbidden
try:
    user = users[user_id]
except KeyError:
    user = create_user(user_id)

# Correct
if user_id in users:
    user = users[user_id]
else:
    user = create_user(user_id)
```

---

## 4. Dependency Management [MUST]

Dependencies are pinned in `pyproject.toml` with version constraints. No unpinned dependencies in production.

Virtual environments are mandatory. Never install into the system Python.

The dependency tool choice (pip + venv, poetry, uv, pdm) is made at project start and logged in `DECISIONS.md`.

Dev dependencies are separated from production dependencies. Test frameworks, linters, and formatters never ship to production.

---

## 5. Async [SHOULD]

One async framework per project. `asyncio` is the default. Do not mix `asyncio` with threading for I/O-bound work unless there is a documented reason.

`async def` functions that contain no `await` are regular functions — remove the `async`.

Never call `asyncio.run()` inside already-running async code. Never use `loop.run_until_complete()` in async contexts.

Blocking calls inside async functions must be wrapped with `asyncio.to_thread()` or run in an executor.

---

## 6. Testing [SHOULD]

`pytest` is the default test framework. Test files mirror the source structure:

```
tests/
  user/
    test_service.py
    test_repository.py
  order/
    test_service.py
```

Fixtures are preferred over setUp/tearDown. Shared fixtures live in `conftest.py` at the appropriate directory level — not all in the root `conftest.py`.

Use `pytest.raises` for exception testing, not try/except in tests.

For async code, use `pytest-asyncio` with `@pytest.mark.asyncio`. Every async function has an async test counterpart.
