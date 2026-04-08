---
name: cg-indie-deploy
description: Deploy an application to a single VPS with reverse proxy, automatic TLS, systemd process supervision, firewall, and basic health checks. Use when the user mentions deploying to a server, VPS setup, going to production, Hetzner/DigitalOcean/Vultr/Linode deployment, setting up Caddy or nginx, writing a systemd service, or any "how do I put this app online" question. NOT for Kubernetes, managed cloud services (AWS ECS, Cloud Run, App Engine), or serverless platforms.
---

# cg-indie-deploy

Deploy an application to one VPS with production-grade defaults. Targets indie developers and small teams shipping to a single server — not enterprise infrastructure, not container orchestration, not managed cloud services.

## Scope

**This skill covers:**
- Initial server hardening (SSH, firewall, deploy user)
- Reverse proxy setup with automatic TLS (Caddy or nginx)
- Process supervision with systemd
- Application deployment for binaries, runtime apps, and Docker Compose
- Health checks and log rotation
- Update/rollback workflow for subsequent deploys
- Basic backup strategy

**This skill does NOT cover:**
- Kubernetes, Docker Swarm, Nomad, or any orchestrator
- Managed services (AWS ECS, GCP Cloud Run, Azure App Service, Fly.io, Railway, Render)
- Serverless (Lambda, Cloudflare Workers, Vercel Functions)
- Multi-server / load-balanced deployments
- CI/CD pipeline creation (separate concern — this skill is the deploy target)
- DNS registrar configuration (too provider-specific)

If the user needs any of the excluded items, say so and suggest a better-matching tool.

## Required context — gather before generating anything

MUST have answers to these before producing commands. Ask the user directly if unclear; do not guess.

1. **Application type** — determines artifact and service config:
   - `binary` — Go, Rust, compiled languages. Copy binary, run as systemd service.
   - `node` — Node.js, Bun, Deno. Install runtime, run via systemd.
   - `python` — Python with venv. Install deps, run via systemd (or gunicorn/uvicorn for web).
   - `docker` — Docker Compose on the VPS, no systemd needed for the app itself.
   - `static` — Static HTML/JS/CSS. Reverse proxy serves files directly, no process.

2. **VPS provider** — affects only initial setup commands and DNS instructions. Core workflow is identical across: Hetzner, DigitalOcean, Linode/Akamai, Vultr, OVH, or any generic Ubuntu/Debian host.

3. **Reverse proxy preference** — default to Caddy unless user asks otherwise:
   - **Caddy** (RECOMMENDED) — automatic TLS via Let's Encrypt, minimal config, sane defaults. Less to go wrong.
   - **nginx** — if user already has it, prefers it, or needs features Caddy doesn't have.
   - **Traefik** — only if the setup is Docker-heavy and the user asks for it.

4. **Domain state** — MUST verify before attempting TLS:
   - Domain pointed to the server IP via an A record?
   - Root domain (`example.com`) or subdomain (`app.example.com`)?
   - If DNS is not configured yet, stop and tell the user to do that first. Do not attempt TLS before DNS propagates.

5. **Listening port** — what port does the app bind to locally? Default by type if user doesn't know: Go 8080, Node 3000, Python 8000. This is internal only; the reverse proxy handles 80/443.

## Workflow

Execute phases in order. Do not skip. Each phase has verification — do not proceed if verification fails.

### Phase 1 — Server hardening (fresh server only)

Skip if the server already has a non-root `deploy` user, UFW enabled, and root SSH disabled.

```bash
# Update
apt update && apt upgrade -y
apt install -y ufw curl ca-certificates

# Deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Firewall — only SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Disable root SSH and password auth
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# fail2ban — reduces brute-force noise, blocks repeat offenders
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
# Default config bans IPs after 5 failed SSH attempts for 10 minutes. Good enough.

# Unattended security upgrades — auto-install security patches only
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades  # answer Yes
# Verify: cat /etc/apt/apt.conf.d/20auto-upgrades should show "1" for both lines
# This only installs security patches, not all upgrades. Low risk, high value.
```

**CRITICAL**: Before disabling root login, verify the deploy user can SSH in from a separate terminal. Never close the only working session until you have tested the replacement.

**Optional — Tailscale for SSH**: If you want to eliminate public SSH exposure entirely, install [Tailscale](https://tailscale.com/) on the server and your local machine. Then change UFW to only allow SSH from the Tailscale interface:
```bash
ufw delete allow OpenSSH
ufw allow in on tailscale0 to any port 22
```
This is the single strongest SSH hardening measure — no public SSH port means no brute-force attacks, no fail2ban needed, no port scanning. Free for personal use.

**Verification**: `ssh deploy@server` works, `ufw status` shows active, `curl https://example.com` from outside reaches the server (or times out because nothing is listening yet — that's fine, firewall is not blocking).

### Phase 2 — Install reverse proxy

**Caddy** (default):
```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

Minimal Caddyfile at `/etc/caddy/Caddyfile`:
```
example.com {
    reverse_proxy localhost:8080
    encode gzip
    log {
        output file /var/log/caddy/access.log
    }
}
```

That is the entire TLS setup. No certbot, no cron, no renewal scripts, no nginx SSL blocks. Caddy handles certificate issuance and renewal automatically on first request.

For a static site: replace `reverse_proxy localhost:8080` with `root * /var/www/example.com` and add `file_server`.

```bash
systemctl reload caddy
systemctl status caddy
```

**nginx** (if user prefers):
```bash
apt install -y nginx certbot python3-certbot-nginx
```

Write `/etc/nginx/sites-available/example.com` with:
- `proxy_pass http://127.0.0.1:<port>;`
- Proxy headers: `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`
- WebSocket headers (`Upgrade`, `Connection`) if the app needs them
- `gzip on;` and related compression settings
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`

Symlink to `sites-enabled/`, then `nginx -t && systemctl reload nginx`, then `certbot --nginx -d example.com`.

**Verification**: `curl -I https://example.com` returns a valid response with a valid TLS certificate. If TLS fails with Caddy, check `journalctl -u caddy` — the most common cause is DNS not yet propagated.

### Phase 3 — Deploy the application

**Binary (Go, Rust)**:
Cross-compile for the server's architecture on the build machine, then copy:
```bash
# On local machine
GOOS=linux GOARCH=amd64 go build -o myapp .
scp myapp deploy@server:/home/deploy/myapp/
scp .env.production deploy@server:/home/deploy/myapp/.env
```

**Node.js**:
```bash
# On server, as deploy user
cd /home/deploy/myapp
git clone <repo> .   # or rsync source
npm ci --production
npm run build        # if applicable
```

**Python**:
```bash
# On server, as deploy user
cd /home/deploy/myapp
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Docker Compose**:
```bash
# On server
cd /home/deploy/myapp
docker compose pull
docker compose up -d
```

When using Docker, skip Phase 4 (systemd) — Docker is the process supervisor.

### Phase 4 — systemd service (binary, node, python)

Write `/etc/systemd/system/<app-name>.service`:

```ini
[Unit]
Description=<App Name>
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/myapp
ExecStart=/home/deploy/myapp/myapp
Restart=on-failure
RestartSec=5
StartLimitBurst=3
StartLimitIntervalSec=60

EnvironmentFile=/home/deploy/myapp/.env

# Security hardening — zero performance cost, blocks entire exploit categories
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/deploy/myapp/data
PrivateTmp=true
PrivateDevices=true
RestrictNamespaces=true
RestrictSUIDSGID=true
CapabilityBoundingSet=
MemoryDenyWriteExecute=true

StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp

[Install]
WantedBy=multi-user.target
```

Adapt `ExecStart` per app type:
- Go/Rust binary: `/home/deploy/myapp/myapp`
- Node: `/usr/bin/node /home/deploy/myapp/dist/index.js`
- Python (uvicorn): `/home/deploy/myapp/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000`
- Python (gunicorn): `/home/deploy/myapp/venv/bin/gunicorn -w 4 -b 127.0.0.1:8000 main:app`

Activate:
```bash
systemctl daemon-reload
systemctl enable <app-name>
systemctl start <app-name>
systemctl status <app-name>
journalctl -u <app-name> -f
```

**Verification**: `systemctl is-active <app-name>` returns `active`. `curl http://localhost:<port>` from the server returns the expected response. `curl https://example.com` from outside returns the expected response through the reverse proxy.

### Phase 5 — Health checks (SHOULD)

The application SHOULD expose a `/health` or `/healthz` endpoint returning 200 with minimal JSON. If the app does not have one, recommend adding it — it is a five-line change that unlocks everything downstream.

External uptime monitoring (recommended over server-side checks):
- **UptimeRobot**, **BetterStack**, or **Uptime Kuma** (self-hosted) — free tiers are sufficient for indie scale
- Point at `https://example.com/health`, get email/Telegram/Slack alerts on failure

Server-side auto-restart on failure (fallback if no external monitor):
```bash
#!/bin/bash
# /home/deploy/scripts/healthcheck.sh
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$RESPONSE" != "200" ]; then
    sudo systemctl restart <app-name>
    echo "$(date): restarted (got $RESPONSE)" >> /home/deploy/logs/healthcheck.log
fi
```
Cron: `*/5 * * * * /home/deploy/scripts/healthcheck.sh`

Note: systemd's `Restart=on-failure` already handles crashes. A healthcheck script only helps when the process is running but unresponsive.

**Disk space monitoring** — disks fill silently and everything breaks at once:
```bash
#!/bin/bash
# /home/deploy/scripts/disk-check.sh
USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -gt 85 ]; then
    echo "DISK WARNING: ${USAGE}% used on $(hostname)" | \
    curl -s -X POST "https://your-webhook-url" -d "$(cat -)"
fi
```
Cron: `0 */6 * * * /home/deploy/scripts/disk-check.sh`

Or simply add disk monitoring to your external uptime tool (BetterStack, UptimeRobot Pro, etc.).

### Phase 6 — Log rotation (SHOULD)

Prevent logs from filling the disk. Create `/etc/logrotate.d/<app-name>`:

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

systemd journal logs are already rotated by `journald` — no action needed there. Configure journal size in `/etc/systemd/journald.conf` if it grows too large (`SystemMaxUse=500M`).

### Phase 7 — Backup (RECOMMENDED for stateful apps)

Only relevant if the app has a database or persistent data. Skip for stateless apps.

```bash
#!/bin/bash
# /home/deploy/scripts/backup.sh
set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/deploy/backups
mkdir -p "$BACKUP_DIR"

# SQLite
# sqlite3 /home/deploy/myapp/data/app.db ".backup $BACKUP_DIR/app_$TIMESTAMP.db"

# PostgreSQL
# pg_dump -U myapp myappdb | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Keep last 7 daily + 4 weekly
find "$BACKUP_DIR" -type f -mtime +7 -delete
```
Cron: `0 3 * * * /home/deploy/scripts/backup.sh`

For offsite backup (STRONGLY RECOMMENDED — a single VPS is a single point of failure):
- `rclone` to Backblaze B2, Hetzner Storage Box, or any S3-compatible storage
- `rsync` to a second VPS in a different region
- `restic` for deduplicated, encrypted backups

## Database port security (if running a database on the VPS)

If you install PostgreSQL, MySQL, Redis, or any database on the same VPS:

- **MUST** bind to `127.0.0.1` only, never `0.0.0.0`
- **MUST NOT** open database ports (5432, 3306, 6379) in the firewall
- **MUST** verify with `ss -tlnp | grep <port>` — the "Local Address" column should show `127.0.0.1:<port>`, not `*:<port>` or `0.0.0.0:<port>`

This is one of the most common indie deployment mistakes. An exposed Redis with no password is full remote code execution. An exposed Postgres is a data breach.

## Update/redeploy workflow

For subsequent deploys after the first one:

**Binary apps — atomic swap with rollback**:
```bash
# On local
GOOS=linux GOARCH=amd64 go build -o myapp .
scp myapp deploy@server:/home/deploy/myapp/myapp.new

# On server
cd /home/deploy/myapp
mv myapp myapp.old
mv myapp.new myapp
chmod +x myapp
sudo systemctl restart <app-name>
sleep 3
if systemctl is-active --quiet <app-name>; then
    rm myapp.old
    echo "Deploy successful"
else
    mv myapp.old myapp
    sudo systemctl restart <app-name>
    echo "ROLLBACK: new version failed to start"
    exit 1
fi
```

**Docker Compose**:
```bash
cd /home/deploy/myapp
docker compose pull
docker compose up -d
# Old containers stop automatically; rollback by pinning to previous image tag
```

**Runtime apps (Node, Python)**: git pull, reinstall deps if changed, restart service.

**Zero-downtime deploy (optional)**: If your app cannot tolerate even a few seconds of downtime during restarts:

1. **Caddy upstream swap**: Run the new version on a staging port (e.g., 8081), health-check it, then update Caddy's upstream and reload:
   ```bash
   # Start new version on staging port
   APP_PORT=8081 /home/deploy/myapp/myapp.new &
   sleep 3
   curl -f http://localhost:8081/health || { echo "New version failed health check"; kill %1; exit 1; }
   
   # Swap Caddy upstream
   sed -i 's/localhost:8080/localhost:8081/' /etc/caddy/Caddyfile
   systemctl reload caddy
   
   # Stop old version, move new to primary port
   # (then update Caddyfile back to 8080 for next deploy)
   ```

2. **systemd socket activation**: systemd holds the listening socket during restart, buffering connections for the few hundred milliseconds of service restart. Effectively zero-downtime for most indie workloads. Requires a socket unit file — see `systemd.socket(5)` docs.

For most indie apps, the 1-3 second restart gap is acceptable. Only add zero-downtime complexity if you actually need it.

## Validation checklist

After initial deployment, verify every item:

- [ ] `curl https://example.com` returns expected response with valid TLS
- [ ] Browser shows padlock, no certificate warnings
- [ ] `systemctl status <app-name>` shows `active (running)`
- [ ] `ufw status` shows only 22, 80, 443 allowed
- [ ] `ssh root@server` fails (root login disabled)
- [ ] `journalctl -u <app-name> --since "5 min ago"` shows application logs
- [ ] Health endpoint responds: `curl https://example.com/health`
- [ ] Server survives reboot: `sudo reboot`, then verify app comes back up automatically after ~60 seconds
- [ ] External uptime monitor configured and receiving data

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| 502 Bad Gateway | App not running, or listening on wrong port | `systemctl status <app-name>`, check port matches proxy config |
| TLS fails (Caddy) | DNS not propagated yet | Wait, check `dig example.com`, monitor `journalctl -u caddy` |
| TLS fails (nginx + certbot) | Port 80 blocked, or DNS wrong | `ufw status`, verify DNS, retry `certbot --nginx` |
| App starts then dies seconds later | Missing env vars, wrong permissions, port already in use | `journalctl -u <app-name> -n 100`, check `.env` file exists and is readable by `deploy` user |
| Permission denied errors | File ownership is `root` instead of `deploy` | `chown -R deploy:deploy /home/deploy/myapp` |
| Port already in use | Another process on the same port | `ss -tlnp \| grep :<port>` to find the conflicting process |
| Cannot reach site at all | Firewall, DNS, or server down | `ufw status`, `dig example.com`, `ping <ip>` |
| systemd service won't enable | Syntax error in unit file | `systemctl daemon-reload`, `systemd-analyze verify /etc/systemd/system/<app-name>.service` |
| `Restart=on-failure` loops forever | App crashes immediately on start | Check `StartLimitBurst` triggered, fix root cause, then `systemctl reset-failed <app-name>` |
| Disk full, everything stops | Logs or data grew unchecked | Add log rotation (Phase 6), disk monitoring, and `journald.conf SystemMaxUse=500M` |
| Database exposed to internet | Data breach, crypto mining, ransomware | Bind to 127.0.0.1, never open DB ports in firewall |
| Server compromised months later | No auto-patching for security vulnerabilities | Enable `unattended-upgrades` for security patches |

## Principles

- **Default to the simplest thing that works in production**. Caddy over nginx. systemd over Docker when Docker isn't needed. SQLite over Postgres when Postgres isn't needed.
- **Never skip server hardening**. An indie project does not deserve worse security than an enterprise one. The three steps (non-root user, SSH key only, firewall) take five minutes and prevent most common attacks.
- **Atomic deploys with rollback**. Every update must have a defined rollback path. If the new version fails to start, the old version must be restored automatically.
- **Verify, do not assume**. Each phase has a verification step. Do not proceed to the next phase without running it.
- **External monitoring beats server-side monitoring**. If the server is down, a script on that server cannot tell you. Use an external uptime check.
