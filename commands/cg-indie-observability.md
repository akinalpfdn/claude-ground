---
name: cg-indie-observability
description: Set up production observability for indie-scale apps — structured logging, uptime monitoring, error tracking, and basic metrics. Use when the user mentions logging, monitoring, alerts, error tracking, uptime checks, "how do I know if my app is down", Sentry, journalctl, structured logs, or wants to know what's happening in production. NOT for enterprise observability stacks (Grafana+Prometheus+Loki+Jaeger), OpenTelemetry distributed tracing, or APM platforms — this is for solo devs and small teams who want to know when something breaks and why.
---

# cg-indie-observability

Give an indie-scale production app enough visibility to answer three questions reliably: *Is it up? Did something break? Why?* Without running a six-container observability stack.

## Scope

**This skill covers:**
- Structured logging (JSON to stdout, picked up by journald)
- Log rotation and retention
- External uptime monitoring with alerts
- Error tracking with Sentry-compatible tools
- Basic system and application metrics
- Alerting that actually reaches you (email, Telegram, Discord, Slack)
- Log querying with `journalctl` and simple grep workflows

**This skill does NOT cover:**
- Grafana + Prometheus + Loki + Tempo + Jaeger stacks (too much to run and maintain)
- Full OpenTelemetry distributed tracing (overkill for single-service apps)
- APM platforms with flame graphs, session replay, or LLM trace capture
- Kubernetes cluster observability
- Multi-cluster federation or high-availability monitoring
- Custom Grafana dashboards and PromQL

If the user has multiple services, high traffic, or needs distributed tracing across a microservice mesh — recommend SigNoz, Grafana LGTM, or a managed platform instead.

## Required context — gather before generating anything

MUST have answers to these before producing code or config. Ask the user directly if unclear.

1. **What language/runtime is the app?** — determines logging library:
   - Go → `log/slog` (standard library, 1.21+)
   - Node.js / Bun → `pino`
   - Python → `structlog` or `python-json-logger`
   - Rust → `tracing` with `tracing-subscriber`
   - Java / Spring Boot → Logback with `logstash-logback-encoder`
   - .NET → Serilog with `Serilog.Formatting.Compact` (CLEF format)
   - Kotlin → same as Java (Logback) or `kotlin-logging` wrapper
   - Swift (server-side) → `swift-log` with a JSON backend like `swift-log-format-and-pipe`

2. **Is the app already running in production?** — determines workflow:
   - New app → instrument from the start
   - Existing app with `printf` or `console.log` → migration path, not a rewrite

3. **How is the app deployed?** — affects log destination:
   - systemd service → logs go to stdout/stderr, journald captures them
   - Docker container → logs go to stdout, Docker captures them, forwarded via `docker logs` or a log driver
   - Bare process → needs explicit file redirection with log rotation

4. **What's the team size and error volume expectation?**
   - Solo dev, low volume → free tier of Sentry cloud, or skip error tracker entirely (structured logs are enough)
   - Small team, moderate volume → self-hosted Bugsink (single container) or GlitchTip
   - Privacy-sensitive (EU data, healthcare, etc.) → self-hosted only

5. **What alerting channels does the user actually check?**
   - Email is reliable but slow
   - Telegram/Discord are fast and mobile-friendly
   - Slack is fine if the team lives there
   - SMS/phone calls only for true emergencies (PagerDuty-style)

   The best alerting system is the one the user will not mute.

## The four pillars

Indie observability is four loosely-coupled concerns. Set them up in order of value.

### Pillar 1 — Structured logging (highest value, lowest cost)

**Why first**: Every other pillar is easier when logs are structured. A single `jq` query replaces an entire dashboard. Debugging goes from hours to minutes.

**Rules**:
- **MUST** use structured logging (JSON key-value pairs), not `printf` or string concatenation
- **MUST** log to stdout/stderr, not files directly — let the process supervisor handle log collection
- **MUST** include these fields on every log entry: `timestamp` (ISO 8601 UTC), `level`, `service`, `message`
- **SHOULD** add request-scoped context: `request_id`, `user_id`, `route`, `duration_ms`
- **SHOULD** generate `request_id` via middleware at the entry point and propagate through the entire request chain — this is single-service tracing and gives you 90% of what distributed tracing provides without the complexity
- **SHOULD** use log levels correctly: `DEBUG` (dev only), `INFO` (normal operations), `WARN` (unexpected but handled), `ERROR` (something failed), `FATAL` (process must exit)
- **MUST NOT** log secrets, passwords, API keys, full credit card numbers, or raw PII
- **MUST NOT** use `printf` / `console.log` / `print` in production code paths

**Go example with slog**:
```go
import (
    "log/slog"
    "os"
)

logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))
slog.SetDefault(logger)

// Use it
slog.Info("request completed",
    "request_id", reqID,
    "method", "POST",
    "path", "/api/users",
    "status", 201,
    "duration_ms", 42,
)
```

**Node.js with pino**:
```javascript
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

logger.info({
    request_id: reqId,
    method: 'POST',
    path: '/api/users',
    status: 201,
    duration_ms: 42,
}, 'request completed');
```

**Python with structlog**:
```python
import structlog
import logging

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)

log = structlog.get_logger()
log.info("request completed",
    request_id=req_id,
    method="POST",
    path="/api/users",
    status=201,
    duration_ms=42,
)
```

**Rust with tracing**:
```rust
use tracing::{info, instrument};
use tracing_subscriber::{fmt, EnvFilter};

fmt()
    .json()
    .with_env_filter(EnvFilter::from_default_env())
    .with_current_span(false)
    .init();

info!(
    request_id = %req_id,
    method = "POST",
    path = "/api/users",
    status = 201,
    duration_ms = 42,
    "request completed"
);
```

**Java / Spring Boot with Logback + logstash-encoder**:

Add to `pom.xml`:
```xml
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

`src/main/resources/logback-spring.xml`:
```xml
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeContext>false</includeContext>
            <customFields>{"service":"myapp"}</customFields>
        </encoder>
    </appender>
    <root level="INFO">
        <appender-ref ref="STDOUT" />
    </root>
</configuration>
```

Then in code (use SLF4J with structured arguments via `net.logstash.logback.argument.StructuredArguments`):
```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static net.logstash.logback.argument.StructuredArguments.kv;

private static final Logger log = LoggerFactory.getLogger(UserController.class);

log.info("request completed",
    kv("request_id", reqId),
    kv("method", "POST"),
    kv("path", "/api/users"),
    kv("status", 201),
    kv("duration_ms", 42)
);
```

For request-scoped context, use SLF4J's MDC (Mapped Diagnostic Context) in a servlet filter or Spring interceptor so `request_id` propagates through the whole request chain automatically.

**.NET with Serilog**:

Install packages:
```
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Formatting.Compact
```

In `Program.cs`:
```csharp
using Serilog;
using Serilog.Formatting.Compact;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "myapp")
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// ... app setup ...
```

Then in code:
```csharp
using Serilog;

Log.Information("request completed {RequestId} {Method} {Path} {Status} {DurationMs}",
    reqId, "POST", "/api/users", 201, 42);
```

Serilog's message template syntax (`{PropertyName}`) automatically captures structured properties — no need for a separate structured arguments API. For request-scoped context, use `LogContext.PushProperty("request_id", reqId)` inside an ASP.NET Core middleware.

**Kotlin with kotlin-logging + Logback**:

Same Logback + `logstash-logback-encoder` setup as Java. In code:
```kotlin
import io.github.oshai.kotlinlogging.KotlinLogging
import net.logstash.logback.argument.StructuredArguments.kv

private val log = KotlinLogging.logger {}

log.info(
    kv("request_id", reqId),
    kv("method", "POST"),
    kv("path", "/api/users"),
    kv("status", 201),
    kv("duration_ms", 42)
) { "request completed" }
```

### Pillar 2 — Log collection and querying

On a systemd-based deploy, structured stdout logs are already collected by journald. No extra agent needed for indie scale.

**Querying logs with journalctl**:
```bash
# Tail logs from the app
journalctl -u myapp -f

# Last 100 lines
journalctl -u myapp -n 100

# Since a specific time
journalctl -u myapp --since "1 hour ago"
journalctl -u myapp --since "2026-01-15 14:00:00"

# JSON output for piping to jq
journalctl -u myapp -o json | jq 'select(.MESSAGE | fromjson | .level == "error")'

# Filter by field inside the JSON message
journalctl -u myapp -o cat | jq -c 'select(.request_id == "abc-123")'

# Errors only, last hour
journalctl -u myapp --since "1 hour ago" -o cat | jq 'select(.level == "error")'
```

**journald retention and size** (configure in `/etc/systemd/journald.conf`):
```
[Journal]
SystemMaxUse=2G
SystemKeepFree=1G
SystemMaxFileSize=200M
MaxRetentionSec=30day
```

Then: `sudo systemctl restart systemd-journald`.

**If the app writes logs to files directly** (only needed when journald is not an option): set up `logrotate` at `/etc/logrotate.d/<app-name>`:
```
/home/deploy/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

**For Docker apps**: use the `json-file` log driver with size limits in `daemon.json`:
```json
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "5"
    }
}
```

**Centralized log aggregation is usually unnecessary at indie scale.** Skip Loki/Elastic/OpenSearch until one of these is true:
- Multiple servers need a single pane of glass
- Retention requirement exceeds what journald can hold
- Non-technical team members need to query logs

If needed later, the lightest centralization path is: Vector (by Datadog, open source) → object storage (S3/B2). Skip log databases entirely.

### Health check endpoints

The app SHOULD expose health endpoints. These are consumed by uptime monitors, load balancers, and deploy scripts.

**`/health`** — fast liveness check, no dependency verification:
```json
{"status": "ok", "version": "1.2.3", "uptime": "72h15m"}
```
- Returns HTTP 200 immediately
- Does NOT check database, Redis, or external services
- Used by uptime monitors and load balancer probes (called every few seconds)

**`/health/ready`** — deep readiness check, verifies dependencies:
```json
{"status": "degraded", "checks": {"database": "ok", "redis": "timeout", "disk": "ok"}}
```
- Returns HTTP 200 if all checks pass, HTTP 503 if any critical check fails
- Checks database connectivity, cache availability, disk space
- Used by deploy scripts ("is the new version healthy?") and detailed monitoring
- Should timeout per-check (e.g., 2 seconds per dependency) to avoid hanging

**Keep `/health` and `/health/ready` separate.** A health check that queries the database on every call becomes a performance problem at high check frequency and masks whether the app itself is alive vs a dependency is down.

### Pillar 3 — Uptime monitoring (external)

**Rule: server-side monitoring cannot tell you the server is down.** The monitor MUST run externally.

**Options**:

| Tool | Type | Cost | Best for |
|---|---|---|---|
| **UptimeRobot** | SaaS | Free tier: 50 monitors, 5-min checks | Absolute simplest, get started in 2 minutes |
| **BetterStack** | SaaS | Free tier: 10 monitors, 3-min checks | Better alerting, status page included |
| **Uptime Kuma** | Self-hosted | Free | Full control, single Docker container, runs on a $5 VPS |
| **Cronitor** | SaaS | Free tier: 5 monitors | Also monitors cron jobs, not just HTTP |

**What to monitor**:
- Public HTTP endpoint: `https://example.com/health`
- Expected status: 200
- Expected response body contains: `"status":"ok"` (or similar)
- TLS certificate expiry (most uptime tools check this automatically)
- Response time threshold (alert if > 2 seconds for 3 consecutive checks)

**Alert routing**:
- First alert: Telegram/Discord/email (fast, low friction)
- Escalation if still down after 10 minutes: SMS or phone call
- Do NOT route every transient blip to alerts — set `checks_failed >= 2` before alerting

**Uptime Kuma setup (self-hosted)**, if privacy or cost matters:
```bash
# Run on a DIFFERENT server than the one being monitored
docker run -d \
    --restart=always \
    -p 3001:3001 \
    -v uptime-kuma:/app/data \
    --name uptime-kuma \
    louislam/uptime-kuma:1
```

Then open `http://<monitor-server-ip>:3001`, set up an admin user, add HTTP monitors. Configure notification channels in Settings → Notifications.

### Pillar 4 — Error tracking

**Why it matters**: Logs tell you *what* happened. Error tracking tells you *which errors are new*, *which are recurring*, and *who is affected*. It's log grep with grouping, deduplication, and alerts.

**Decision matrix**:

| Situation | Recommendation |
|---|---|
| Solo dev, low volume, don't want to self-host | **Sentry free tier** (5k events/month) |
| Solo dev, wants error + session replay + logs in one tool | **Highlight.io** (open-source, generous free tier) |
| Small team, wants self-hosted, minimal ops burden | **Bugsink** (single Docker container, Sentry-SDK-compatible) |
| Small team, wants self-hosted, more mature UI | **GlitchTip** (4 containers, Sentry-SDK-compatible, Django-based) |
| Large team or high volume already paying for observability | **Sentry paid** or **SigNoz** |
| Don't need error grouping at all | Skip this pillar — structured logs with error-level filtering are enough at very small scale |

**Why NOT self-hosted Sentry**: It requires 9+ containers (Kafka, Redis, ClickHouse, Snuba, etc.), 16GB+ RAM minimum, and Sentry's own docs say self-hosting is "not recommended" and "minimal" support. For indie scale this is a bad trade.

**Bugsink setup** (recommended for most self-hosted cases):
```bash
docker run -d \
    --restart=always \
    -e SECRET_KEY=$(openssl rand -base64 50) \
    -e CREATE_SUPERUSER=admin:<strong-password> \
    -e PORT=8000 \
    -p 8000:8000 \
    -v bugsink-data:/data \
    --name bugsink \
    bugsink/bugsink:latest
```

Put it behind the same reverse proxy as the rest of the infra (see `cg-indie-deploy` for Caddy/nginx patterns). Expose at `errors.example.com`.

**Client-side integration** is identical to Sentry because Bugsink is Sentry-SDK-compatible. Just point the DSN at your Bugsink instance:

```go
// Go
import "github.com/getsentry/sentry-go"

sentry.Init(sentry.ClientOptions{
    Dsn: "https://<key>@errors.example.com/1",
    Environment: "production",
    Release: "myapp@1.2.3",
    TracesSampleRate: 0,  // disable performance traces for indie scale
})
defer sentry.Flush(2 * time.Second)
```

```javascript
// Node.js
import * as Sentry from "@sentry/node";
Sentry.init({
    dsn: "https://<key>@errors.example.com/1",
    environment: "production",
    release: "myapp@1.2.3",
    tracesSampleRate: 0,
});
```

```python
# Python
import sentry_sdk
sentry_sdk.init(
    dsn="https://<key>@errors.example.com/1",
    environment="production",
    release="myapp@1.2.3",
    traces_sample_rate=0,
)
```

```java
// Java / Spring Boot — add io.sentry:sentry-spring-boot-starter-jakarta
// Then in application.properties:
//   sentry.dsn=https://<key>@errors.example.com/1
//   sentry.environment=production
//   sentry.release=myapp@1.2.3
//   sentry.traces-sample-rate=0.0
// The starter auto-wires Sentry into Spring's exception handling — no manual init needed.
```

```csharp
// .NET — add the Sentry.AspNetCore package
// In Program.cs, before builder.Build():
builder.WebHost.UseSentry(o =>
{
    o.Dsn = "https://<key>@errors.example.com/1";
    o.Environment = "production";
    o.Release = "myapp@1.2.3";
    o.TracesSampleRate = 0;
});
```

**What to report**:
- All unhandled exceptions (automatic for most SDKs)
- Explicitly captured errors on important failure paths: `sentry.CaptureException(err)`
- User context (non-PII): `sentry.SetUser({id: "user-123", email: hashedEmail})`
- Release version for every deploy (enables regression detection)

**What NOT to report**:
- Expected validation errors (400 responses on bad input) — these are not bugs
- Rate-limited errors that happen thousands of times per minute — configure sampling or filtering
- Errors containing sensitive data — SDK has `beforeSend` hooks to scrub them

### Log-based alerting (optional but valuable)

You already have structured logs. Adding pattern-based alerts means you catch problems without staring at a dashboard.

**Goal**: "If 10+ error-level log lines appear in 5 minutes, alert me."

**Options by complexity**:

1. **Betterstack (SaaS)** — ship logs to their free tier, set up keyword/pattern alerts in their UI. Simplest path: zero self-hosting, free for small volume.

2. **Custom script + journalctl** (zero dependencies):
   ```bash
   #!/bin/bash
   # /home/deploy/scripts/log-alert.sh
   ERROR_COUNT=$(journalctl -u myapp --since "5 min ago" -o cat 2>/dev/null | jq -r 'select(.level == "error")' | wc -l)
   if [ "$ERROR_COUNT" -gt 10 ]; then
       curl -s -X POST "https://your-webhook-url" \
           -d "🔴 myapp: $ERROR_COUNT errors in the last 5 minutes"
   fi
   ```
   Cron: `*/5 * * * * /home/deploy/scripts/log-alert.sh`

3. **Vector + webhook sink** — Vector (by Datadog, open-source) can filter log streams in real-time and trigger webhooks on patterns. More powerful but requires running another agent.

Start with option 1 or 2. Upgrade to Vector when the cron script feels limiting.

### Status page (optional)

Worth it once you have users who depend on your service. Not needed for side projects or pre-launch.

**Simplest option**: **Uptime Kuma** already includes a built-in status page — if you're using it for uptime monitoring (Pillar 3), you get a public status page for free at `/status/<slug>`.

**Other options**:
- **Instatus** — SaaS, free tier for 1 status page
- **Cachet** — self-hosted, mature

A status page has two purposes: (1) users check it before emailing you "is it down?", and (2) you post incident updates so users know you're aware. Both save you time.

### Basic metrics (optional, lower priority)

At indie scale, metrics matter much less than logs and error tracking. A single `htop` or `journalctl` query answers most "why is my server slow" questions. But for long-term trends, consider:

**Option A — Netdata (single-binary, zero-config)**:
```bash
# One-line install
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```
- Installs a local agent with a web UI on port 19999
- Collects CPU, RAM, disk, network, systemd services, Caddy, PostgreSQL, etc.
- Free tier of Netdata Cloud for remote access across multiple servers
- Minimal overhead, auto-discovers services

**Option B — Glances (terminal-based)**:
```bash
pip install glances
glances -w  # web UI on port 61208
```
- No persistent storage, shows live state only
- Good for "SSH in and check what's happening"

**Option C — Custom cron scripts** (simplest possible):
```bash
#!/bin/bash
# /home/deploy/scripts/monitor.sh
DISK=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
MEM=$(free | awk '/Mem/ {printf "%.0f", $3/$2*100}')

if [ "$DISK" -gt 85 ]; then
    curl -s -X POST "https://api.telegram.org/bot<token>/sendMessage" \
        -d "chat_id=<chat_id>" \
        -d "text=⚠️ Disk at ${DISK}% on $(hostname)"
fi
```
Cron: `*/15 * * * * /home/deploy/scripts/monitor.sh`

**Skip Prometheus + Grafana** unless you already know why you need them. At indie scale, the maintenance burden outweighs the value.

## Alerting philosophy

**The best alert is the one that wakes you up exactly when it matters, and never otherwise.**

Rules for sane alerting:
- **SHOULD** alert only on things that require human action within the next hour
- **SHOULD** tune thresholds with real data — start conservative, tighten over time
- **MUST NOT** alert on transient blips (1 failed check in isolation)
- **MUST NOT** send the same alert to multiple channels unless they have different audiences
- **SHOULD** include enough context in the alert message to decide if it's urgent without logging in
- **SHOULD** have a "working hours only" mode for non-critical alerts
- **MUST** test the alert path at least once — send a fake alert, verify it arrives, measure latency

**Alert message template**:
```
🔴 [SEVERITY] <service> - <what broke>

Where: <server/component>
When: <timestamp in user's timezone>
Last known good: <timestamp>
Suggested action: <one-line fix if known>
Dashboard: <link to logs/metrics>
```

Bad alerts: "Error in app". Good alerts: "🔴 [CRITICAL] myapp - health check failing for 10min on prod-01. Caddy returning 502. Check `journalctl -u myapp`."

## Validation checklist

After setup, verify:

- [ ] Running `journalctl -u <app> -n 1 -o cat | jq .` returns valid JSON with `timestamp`, `level`, and `message` fields
- [ ] Stopping the app triggers an uptime alert within the expected time window (test during off-hours)
- [ ] Throwing a test exception reaches the error tracker within 30 seconds
- [ ] Log rotation is configured (verify journald config or logrotate config exists)
- [ ] At least one non-email alert channel is configured (Telegram/Discord/Slack)
- [ ] The user can answer "what errors happened in the last hour?" in under 30 seconds
- [ ] The user can answer "is the app up right now?" in under 5 seconds (status page or dashboard bookmark)

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Logs are present but not JSON | Library is using default text formatter | Configure JSON handler at logger init |
| `journalctl` shows `MESSAGE=` as escaped string | App is logging to stderr with text format, not structured JSON | Switch formatter to JSON |
| Error tracker receives nothing | Wrong DSN, SDK not initialized before first error, or firewall blocking | Check SDK init order, test with manual `captureException`, verify outbound HTTPS allowed |
| Alerts arrive 5+ minutes late | Check interval too long, or alert channel is slow | Reduce check interval, switch from email to Telegram for speed |
| Disk fills up from logs | journald limits not set, or logrotate not configured | Set `SystemMaxUse` in journald.conf, verify with `journalctl --disk-usage` |
| Sentry/Bugsink dashboard is empty but the app is erroring | `beforeSend` hook is filtering out events, or environment mismatch | Check SDK config, verify `environment` tag matches the filter in the dashboard |
| Uptime monitor reports "down" but the app is up | Monitor is checking wrong URL, TLS issue, or IP allowlist | Verify the exact URL the monitor uses, check `curl -vI` from outside |
| Too many alerts, team starts ignoring them | Thresholds too tight, or alerting on non-actionable events | Audit alert history, remove anything that didn't require action 90% of the time |

## Migration path from unstructured logs

If the user already has `console.log` / `printf` / `print` scattered through the code:

1. **Do not rewrite everything at once.** Pick the highest-traffic code path first.
2. **Add the structured logger alongside the old one.** Both can run during transition.
3. **Replace `printf` calls in the hot path first** — request handlers, error paths, startup/shutdown hooks.
4. **Leave low-traffic debug prints alone** until they break something.
5. **Set a deadline** — "all new code uses the structured logger; existing calls migrated within 2 weeks" is a reasonable pace for a solo dev.

## Principles

- **Logs first, everything else second.** A well-structured log stream answers 80% of production questions for free.
- **External monitoring beats internal.** A healthcheck script on a down server tells you nothing.
- **Sentry cloud is fine for most indie devs.** Self-hosting is a choice, not a default — weigh the maintenance cost honestly.
- **Alerts should respect sleep.** An alert at 3am should be something you genuinely want to know at 3am. Everything else waits.
- **Boring is good.** journald + structured logs + one uptime monitor + one error tracker handles 95% of indie-scale needs. Save the Grafana dreams for when there's actually something to graph.
- **Measure the system's reality, not its aspiration.** Don't set an alert for "99.99% uptime" on a single-VPS deployment — it's not physically possible and the alert will only lie to you.
