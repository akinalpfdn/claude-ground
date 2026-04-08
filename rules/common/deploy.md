# Deploy Essentials

Applies when deploying to a VPS or discussing production infrastructure. These are the non-negotiable minimum for a single-server deployment.

---

## 1. Server Hardening [MUST]

- Create a non-root deploy user — never run the app as root
- SSH key-only authentication — disable password auth and root login
- Firewall (UFW): allow only 22, 80, 443 — deny everything else
- Never expose database ports (5432, 3306, 6379) to the public internet — bind to 127.0.0.1

## 2. Reverse Proxy & TLS [MUST]

- Use Caddy (automatic TLS) or nginx + certbot — never serve the app directly on port 80/443
- Verify DNS A record points to the server before attempting TLS
- Set security headers at the reverse proxy level (HSTS, X-Frame-Options, etc.)

## 3. Process Supervision [MUST]

- Run the app as a systemd service with `Restart=on-failure`
- Use `EnvironmentFile` for secrets — never pass secrets as command-line arguments
- Enable systemd hardening: `NoNewPrivileges=true`, `ProtectSystem=strict`, `PrivateTmp=true`
- Verify the app survives a `sudo reboot`

## 4. Updates & Rollback [MUST]

- Every deploy must have a rollback path — keep the previous binary/image
- Enable unattended security upgrades (`unattended-upgrades` package)

## 5. Monitoring [SHOULD]

- Expose a `/health` endpoint
- Use an external uptime monitor (UptimeRobot, BetterStack, Uptime Kuma) — server-side monitoring cannot detect server-down
- Set up disk space monitoring — disks fill silently

## Full Guide

For step-by-step deployment with Caddy/nginx config, systemd unit files, zero-downtime deploys, backup strategy:
`~/.claude/commands/cg-indie-deploy.md`
