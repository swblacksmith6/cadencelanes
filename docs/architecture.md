# Architecture

SwimAcademy (repo name cadencelanes) is a multi-tenant app for swim academies: coaches log attendance,
race/practice timings and progress notes for their students.

## Stack

- **Backend:** FastAPI, SQLAlchemy 2 (sync), SQLite, Pydantic 2, python-jose (JWT). Python 3.12. One uvicorn process.
- **Frontend:** React 18, Vite 5, Tailwind 4, react-router 6, axios, recharts, lucide-react. A PWA (see [features/pwa-offline.md](features/pwa-offline.md)).
- **SMS:** MSG91 Flow API for login OTPs.
- **Packaging:** one Docker image. The frontend is built in stage 1 and served by FastAPI from `/app/static`.
- **Production:** Caddy proxy in front, TLS and security headers; see [operations.md](operations.md).

## Multi-tenancy: a SQLite file per club

- `DATA_DIR/control.db` holds platform data: `clubs`, `users`, `otp_codes`, `active_sessions`, `admin_audit_log`. Models: `backend/db/control_models.py`.
  `active_sessions` has one row per user (`user_id` primary key and foreign key to `users.id`, `session_id` uuid, `created_at`).
  A login overwrites the row and the JWT carries the same id as `sid`, so only the newest login works.
  Existing databases get the table automatically at startup (`create_all`); if you prefer to create it by hand:
  `CREATE TABLE active_sessions (user_id VARCHAR(36) NOT NULL PRIMARY KEY REFERENCES users(id), session_id VARCHAR(36) NOT NULL, created_at DATETIME NOT NULL);`
- `DATA_DIR/clubs/club_<club_id>.db` holds one club's data: coaches, students, parent contacts, sessions,
  attendance, timings, personal bests, notes, skill assessments, swim styles, distance events.
  Models: `backend/db/club_models.py`.
- A club DB is created when the super admin approves the club and deleted when the club is deleted
  (`backend/db/engine.py`). Engines are cached per club (`lru_cache`, 50).
- `club_models.Coach.user_id` points at `control.users.id` but is not a real foreign key (different files).
  Anything that changes a coach (deactivate, rename) must update both databases.
- All SQLite connections use WAL, `synchronous=NORMAL` and a 15 s busy timeout (`_tune_sqlite`).
  Writers queue; they do not fail. This is why the app must run as a single process.
- There are **no migrations**. `create_all` only creates missing tables. Adding a column to an existing
  database needs a manual `ALTER TABLE`, or recreate the DB in dev. The log reports `DB_SCHEMA_MISMATCH`.

## Request flow

1. `request_logging` middleware (`backend/main.py`) assigns `request_id`, times the request, logs `event=request`.
2. Route dependencies: `get_current_user` (`backend/middleware/auth.py`) decodes the JWT, **checks the user is still active in control.db and that the token's `sid` is the user's current `active_sessions` row** (else 401 `SESSION_REPLACED`).
   Then `require_admin`, `require_coach` or `require_head_coach` check the role, and `_check_club` checks that the
   `club_id` in the URL equals the token's club (super admin passes).
3. `club_db` (`backend/routers/deps.py`) opens the club's SQLite session from the `club_id` path parameter.
4. Router calls a service function for anything beyond simple CRUD (`backend/services/`).
5. Errors go through the exception handlers in `main.py`, which log `error_code` and `hint`.

## Roles

| Role | Scope |
|---|---|
| `super_admin` | Whole platform; phone from `SUPER_ADMIN_PHONE`, created at startup; no club |
| `head_coach` | One club, everything including managing coaches and deleting sessions |
| `assistant_coach` | One club, students, sessions, attendance, timings, notes |

## API shape

All JSON under `/api`. Club routes are `/api/club/{club_id}/...`. Routers and prefixes are registered in `backend/main.py`:
`auth`, `admin`, `coaches`, `students`, `progress` (under students), `sessions`, `timings`, `reference` (swim styles, distances).
`/docs` and `/openapi.json` exist only when `ENVIRONMENT=dev`.

## Frontend

- Routes in `frontend/src/App.jsx`: public (`/`, `/login`, `/register`), coach area under `Layout` (`/dashboard`, `/students`, `/sessions`, `/timings/entry`, ...),
  head coach only (`/coaches`), super admin (`/admin`). `ProtectedRoute` enforces roles.
- Auth state: `AuthContext` keeps `access_token` and `user` in `localStorage`. `src/api/client.js` adds the bearer header and, on any 401 outside `/login`, clears storage and goes to `/login`.
- Two UI modes (`ModeContext`): **coach** (phone, bottom tabs, poolside) and **analytics** (desktop, sidebar). Default by screen width (under 768 px is coach mode).
- `OfflineScreen` covers the whole app while the device is offline.

## Folder map

```
backend/
  main.py              app, middleware, handlers, static serving
  config.py            Settings (env vars)
  logging_config.py    logfmt logging, error classification
  db/                  engine.py, control_models.py, club_models.py
  routers/             HTTP layer, one file per area
  services/            business logic (auth, sms, club, session, timing, progress)
  schemas/             Pydantic request models
  middleware/auth.py   JWT + role dependencies
  tests/               pytest suite
frontend/
  src/pages, components, context, api, utils, test
  vite.config.js (build + PWA), vitest.config.js (tests)
clap-deploy/           Caddy proxy and another app's stack (pkndr) used on the server
docker-compose.yml             dev
docker-compose.prod.yml        production-style
docker-compose.local-prod.yml  publishes a port so prod-style runs locally
run_tests.sh, seed_demo.py, run.sh
```
