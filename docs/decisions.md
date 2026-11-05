# Decisions

Short record of why things are the way they are. Add a dated entry when you change one.

## 2026-11: SQLite file per club, WAL, single process
Each academy gets its own SQLite file for isolation and simple backup or delete; platform data is in `control.db`. WAL plus a 15 s busy timeout lets several coaches write at once (writes queue for milliseconds). Revisit (Postgres) only for hundreds of concurrent writers.

## 2026-11: Login by OTP via MSG91, no passwords
Coaches log in with phone and SMS OTP. The MSG91 Flow API is used with a DLT-approved template whose variables are `code`, `name`, `min`. SMS is required outside dev; dev can show the OTP in the response.

## 2026-11: 30-day login with a per-request active check
To limit SMS cost, a login lasts 30 days (`JWT_EXPIRY_DAYS`). Because tokens live long and there is no revocation list, every request checks the user is active in control.db so deactivation is immediate.

## 2026-11: Everything needs the internet
The PWA opens offline but only shows a red offline screen. No data caching and no offline write queue, to avoid sync conflicts and stale data. Revisit only if poolside connectivity proves a real problem.

## 2026-11: Uniform logging with request ids
logfmt lines, one `event=request` per request, `error_code` and `hint` on every failure, `X-Request-ID` on responses. See [testing-and-logs.md](testing-and-logs.md).

## 2026-11: Tests run manually, no hooks or CI
`./run_tests.sh` is run before every commit in the working session. Git hooks and GitHub Actions were removed on request (to avoid CI cost and surprise blocking).

## 2026-11: No database migrations (yet)
`create_all` only. Schema changes to existing databases are manual. Accepted for the MVP; add a migration tool before storing data that cannot be recreated.

## 2026-11: One active session per user
A new login ends the user's other session (`active_sessions` table, `sid` in the JWT). Simpler to reason about for a small academy and limits a shared or stolen login; the cost is that a coach cannot use a phone and a tablet at the same time. The new table is created by `create_all`, so no manual migration is needed.

