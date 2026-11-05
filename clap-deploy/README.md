# clap deployment

Everything needed to rebuild the clap host (Ubuntu 24.04) and deploy to it. Nothing here contains
secrets: those live only in `.env` files on the host.

## Layout

| Path | Purpose |
|---|---|
| `server/harden.sh` + config files | One-time host hardening and Docker install (ssh, ufw, fail2ban, sysctl, journald, docker daemon) |
| `proxy/` | Caddy reverse proxy, the only stack that publishes ports 80 and 443 |
| `../docker-compose.prod.yml` | cadencelanes app, joins the `web` network, no published ports |
| `pkndr/` | pkndr API and web containers (source is synced from the pkndr repo) |
| `backup/` | Daily SQLite-safe backup of the data volumes into `/home/deploy/backups` |
| `deploy.sh` | Syncs and (re)starts a target on the host |

On the host: `/opt/proxy`, `/opt/apps/cadencelanes`, `/opt/apps/pkndr`.

## Secrets and `.env`

`.env` files are created on the host and are never committed or synced (`deploy.sh` excludes `.env*`).
Create them over SSH, mode 600, owned by `deploy`. Do not paste secrets into chat or commit messages.

`/opt/apps/cadencelanes/.env`:

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | yes | 32+ characters, for example `openssl rand -hex 32` |
| `MSG91_AUTH_KEY` | yes | MSG91 auth key |
| `MSG91_OTP_TEMPLATE_ID` | yes | MSG91 OTP template id |
| `SMS_APP_NAME` | no | default `CadenceLanes` |
| `SMS_COUNTRY_CODE` | no | default `91` |
| `SUPER_ADMIN_PHONE` | no | default `9999999999` |
| `JWT_EXPIRY_DAYS` | no | default `30` |
| `LOG_LEVEL` | no | prod compose defaults to `ERROR`; set `INFO` temporarily to debug |
| `CORS_ORIGINS` | no | leave empty for same-origin |

`/opt/apps/pkndr/.env`: `PKNDR_ENVIRONMENT`, `PKNDR_SECRET_KEY` (32+ characters), `PKNDR_LOG_LEVEL`,
`PKNDR_PORT` (use `PKNDR_LOG_LEVEL=ERROR` in production), plus `VITE_GOOGLE_MAPS_API_KEY` for the build if wanted.

Add a value without it appearing in shell history:

```bash
read -rsp "value: " V; echo; printf 'NAME=%s\n' "$V" >> /opt/apps/cadencelanes/.env; unset V
```

Changing `.env` needs a container restart: `cd /opt/apps/cadencelanes && sudo docker compose -f docker-compose.prod.yml up -d`.

## Deploy

```bash
clap-deploy/deploy.sh <host>                 # cadencelanes
clap-deploy/deploy.sh <host> proxy backup    # proxy config, backup script and cron
```

Notes learned the hard way:
- The host rate-limits new SSH connections (`ufw limit`), so `deploy.sh` uses one multiplexed connection.
- The Caddyfile is a single-file bind mount; after changing it the container must be recreated
  (`deploy.sh proxy` does this), not reloaded.
- Caddy runs with all capabilities dropped, so any file it reads must be world-readable.
- Optional basic auth: put a `basic_auth { user hash }` block in `/opt/proxy/auth.caddy` and import it
  in the Caddyfile. Generate the hash with `caddy hash-password`. The file stays on the host only.

## After a code change: what to do on the production machine

Normally nothing is done by hand on the host. Deploy from your laptop; the host only needs a look afterwards.

1. Merge to `main` and pull locally, so you deploy exactly what is in GitHub.
2. Take a safety backup first if the change touches data or models (about 10 seconds):
   ```bash
   ssh deploy@<host> 'sudo /usr/local/sbin/clap-backup.sh'
   ```
3. Deploy: `clap-deploy/deploy.sh <host>` (app), plus `proxy`, `backup` or `pkndr` when those files changed.
   This rebuilds the image and recreates the container. Data lives in a Docker volume and survives.
   Expect a few seconds of downtime while the container restarts.
4. Check it came up healthy and is quiet (logs are ERROR only):
   ```bash
   ssh deploy@<host> 'sudo docker ps --format "table {{.Names}}\t{{.Status}}"; sudo docker logs --tail 20 cadencelanes'
   ```
   `(healthy)` is the signal. Then open the site and log in once.
5. If it is broken, roll back: `git checkout <last-good-commit>`, run `deploy.sh <host>` again. If data
   was damaged, restore from the latest archive (see Backups).

Which kind of change needs what:

| Change | Action |
|---|---|
| Backend or frontend code | `deploy.sh <host>` |
| New env var or changed secret | Edit `/opt/apps/cadencelanes/.env` on the host, then `cd /opt/apps/cadencelanes && sudo docker compose -f docker-compose.prod.yml up -d` (no rebuild needed) |
| `docker-compose.prod.yml` | `deploy.sh <host>` |
| `proxy/Caddyfile` | `deploy.sh <host> proxy` (recreates Caddy; a few seconds of downtime) |
| Backup script or schedule | `deploy.sh <host> backup` |
| New required env var in code | Add it to the host `.env` before deploying, or the container refuses to start and the old one keeps running |
| Database model change | Existing tables are not migrated (the app only runs `create_all`): new tables appear automatically, but a new column on an existing table needs a manual `ALTER TABLE` on the live database files. Back up first. |

Debug temporarily with more logs: set `LOG_LEVEL=INFO` in the host `.env`, run the `up -d` command above,
and set it back to `ERROR` afterwards.

Routine host care: security updates install themselves (unattended-upgrades). Now and then check
`ls /var/run/reboot-required`; if it exists, reboot in a quiet window. Containers restart on boot.

## Monitoring

Clap only collects stats; a separate machine pulls them and does the alerting (mail, Telegram).
No alert credentials or outbound calls live on clap.

- `monitor/clap-monitor.sh` runs every 5 minutes (`/etc/cron.d/clap-monitor`, root) and writes to
  `/var/lib/clap-monitor`: `stats-YYYY-MM-DD.csv` (host), `containers-YYYY-MM-DD.csv` (per container),
  and `latest.json` (newest sample plus computed `flags`). 30 days are kept on clap.
- Flags: `disk_high`, `inodes_high`, `mem_high`, `swap_active`, `load_high`, `container_down`,
  `backup_stale`, `cert_expiring`, `cert_unreadable`, `reboot_required`. `ok` is true when there are none.
- Install or update: `clap-deploy/deploy.sh <host> monitor`.
- `mba/pull-clap-stats.sh` (run on the monitoring machine every 10 minutes, cron line in
  `mba/clap-stats.cron`) rsyncs the folder into `~/clap-stats` and writes `pull-status.json`.
  A failed pull or a `latest.json` older than 15 minutes sets `ok:false` there, which also catches a dead clap.

- HTTP access log: Caddy writes one JSON line per request for `cl.lusidlogix.com` to
  `/var/lib/clap-monitor/access/access.log` (rotated at 5 MiB, gzipped, 7 days kept on clap). Fields include
  client IP, method, path, status, duration (seconds), bytes and user agent. The query string, `Authorization`
  and `Cookie` headers, TLS details and response headers are removed before writing. The pull copies the
  `access/` folder to `~/clap-stats/access/` on the monitoring machine, which keeps the full history for
  offline analysis (latency percentiles per route, clients, regions). Config: `proxy/Caddyfile` (`accesslog`
  snippet); apply with `deploy.sh <host> proxy`. Client IPs are personal data: keep that folder private.

The pull uses its own SSH key, restricted on clap to read-only access of that one folder. In
`/home/deploy/.ssh/authorized_keys` on clap, one line (public key from the monitoring machine):

```
restrict,command="/usr/bin/rrsync -ro /var/lib/clap-monitor" ssh-ed25519 AAAA... clap-monitor
```

## First-time host setup

1. Create the `deploy` user with an SSH key and passwordless sudo.
2. `sudo server/harden.sh deploy <leftover-account-to-lock>`
3. Point DNS (Cloudflare, DNS only) at the host, create the `.env` files, then
   `deploy.sh <host> proxy backup cadencelanes`.

## Backups

`/usr/local/sbin/clap-backup.sh` runs from `/etc/cron.d/clap-backup` at 20:30 UTC (02:00 IST), keeps 14 days of
`clap-data-<timestamp>.tar.gz` in `/home/deploy/backups` (mode 600). Pull them elsewhere:

```bash
rsync -a --ignore-existing deploy@<host>:/home/deploy/backups/ ~/clap-backups/
```

Restore: stop the app, copy the `.db` files from the archive into the volume, start the app.
