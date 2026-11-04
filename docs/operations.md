# Operations

## Environment variables

Defined in `backend/config.py`. Production reads them from a `.env` file next to `docker-compose.prod.yml` (git-ignored; never commit it).

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `dev` | Anything other than `dev` is production mode: startup fails unless the secrets below are set, `/docs` is off, CORS is closed unless `CORS_ORIGINS` is set |
| `JWT_SECRET` | dev value | Required in production, at least 32 characters (`openssl rand -hex 32`). Changing it logs everyone out |
| `JWT_EXPIRY_DAYS` | `30` | Login lifetime |
| `MSG91_AUTH_KEY` | empty | Required in production |
| `MSG91_OTP_TEMPLATE_ID` | empty | Required in production |
| `SMS_APP_NAME` | `CadenceLanes` | Fills the `##name##` slot of the SMS |
| `SMS_COUNTRY_CODE` | `91` | Prefixed to the 10-digit phone |
| `OTP_IN_RESPONSE` | `false` | Dev only: return the OTP in the API response. Startup fails if true outside dev |
| `SUPER_ADMIN_PHONE` | `9999999999` | Must be a real phone able to receive SMS in production |
| `CORS_ORIGINS` | empty | Comma-separated origins; in dev empty means `*` |
| `DATA_DIR` | `data` | `/data` in Docker |
| `LOG_LEVEL` | `INFO` | |
| `PORT` | `8080` | Compose host port (dev and `local-prod` only) |

OTP limits (5 requests per hour per phone, 5 wrong attempts, 5 minute validity, 6 digits) are constants in `config.py`.

## Running

| Goal | Command |
|---|---|
| Dev stack (OTP shown in response, data in `./data`) | `docker compose up -d --build` |
| Production-style stack locally | `docker network create web` once, then `docker compose -f docker-compose.prod.yml -f docker-compose.local-prod.yml up -d --build` |
| Seed demo school (dev stack) | `python3 seed_demo.py [port]` |
| All tests | `./run_tests.sh` |

Dev compose (`docker-compose.yml`) sets `ENVIRONMENT=dev` and `OTP_IN_RESPONSE=true` and mounts `./data:/data`.
The production-style stack needs `.env` with `JWT_SECRET`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, so every login sends a real SMS.
`seed_demo.py` cannot log in on that stack because it needs the OTP in the response.

## Container hardening (prod compose)

Runs as uid 10001, read-only root filesystem with `/tmp` as tmpfs, all capabilities dropped, `no-new-privileges`,
768 MB memory and 256 pids limits, named volume `cadencelanes-data` at `/data`, no published ports.
The Dockerfile starts uvicorn with `--no-access-log` (the app logs requests itself) and a healthcheck on `/`.

## Production topology

Caddy (`clap-deploy/proxy`) terminates TLS for `cl.lusidlogix.com` and proxies to the `cadencelanes` container on the external Docker network `web`.
It adds HSTS and security headers and caps request bodies at 10 MB.
The site is behind basic auth (`auth.caddy`, kept only on the server) except the PWA files, which the browser must fetch without credentials.
`clap-deploy/pkndr` is a different app that shares the same proxy; leave it alone.

## Constraints

- **One uvicorn process.** Per-club engines and the SQLite write lock assume it.
- **Data lives in one volume.** Back up with `sqlite3 <file> ".backup out.db"`, not by copying files, because WAL adds `-wal` and `-shm` files.
- Do not put `DATA_DIR` on a network filesystem (SQLite locking).
- No migrations; see [architecture.md](architecture.md).
- After changing code, rebuild the image; running containers keep the old code.
