# Observability Essentials

Applies to any app running in production. Three questions to always be able to answer: Is it up? Did something break? Why?

---

## 1. Structured Logging [MUST]

- Log as JSON key-value pairs — never `printf` / `console.log` / `print` in production code paths
- Log to stdout/stderr — let the process supervisor (systemd, Docker) handle collection
- Every log entry must include: `timestamp` (ISO 8601 UTC), `level`, `message`
- Add request-scoped context: `request_id`, `user_id`, `route`, `duration_ms`
- Generate `request_id` in middleware, propagate through the entire request chain
- Use the right library: Go `slog`, Node `pino`, Python `structlog`, Rust `tracing`, Java `logstash-logback-encoder`, .NET `Serilog`

## 2. Log Hygiene [MUST]

- Never log passwords, API keys, tokens, or raw PII
- Use log levels correctly: DEBUG (dev only), INFO (normal), WARN (unexpected but handled), ERROR (failure), FATAL (must exit)
- Configure log rotation — journald `SystemMaxUse=2G` or logrotate for file-based logs

## 3. Health Endpoints [SHOULD]

- `/health` — fast liveness check, no dependency verification, returns `{"status":"ok","version":"1.2.3"}`
- `/health/ready` — deep check, verifies database/cache/disk, returns 503 if degraded

## 4. External Monitoring [SHOULD]

- Use an external uptime monitor — a script on a down server tells you nothing
- Alert on 2+ consecutive failures, not every transient blip
- Alerts should include enough context to decide urgency without logging in

## Full Guide

For multi-language code examples, error tracking setup (Sentry/Bugsink/GlitchTip), log-based alerting, status pages, and migration from unstructured logs:
`~/.claude/commands/cg-indie-observability.md`
