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

## First-time host setup

1. Create the `deploy` user with an SSH key and passwordless sudo.
2. `sudo server/harden.sh deploy <leftover-account-to-lock>`
3. Point DNS (Cloudflare, DNS only) at the host, create the `.env` files, then
   `deploy.sh <host> proxy backup cadencelanes`.

## Backups

`/usr/local/sbin/clap-backup.sh` runs from `/etc/cron.d/clap-backup` at 03:15 UTC, keeps 14 days of
`clap-data-<timestamp>.tar.gz` in `/home/deploy/backups` (mode 600). Pull them elsewhere:

```bash
rsync -a --ignore-existing deploy@<host>:/home/deploy/backups/ ~/clap-backups/
```

Restore: stop the app, copy the `.db` files from the archive into the volume, start the app.
