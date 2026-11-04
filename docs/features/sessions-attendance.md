# Sessions and attendance

## Purpose
A session is one training or competition slot on a date. Attendance records who was there.

## Behaviour
Routes `/api/club/{club_id}/sessions...`.
- `POST {session_date, session_type, notes?}` (any coach, 201). `session_type` is lowercased and trimmed; letters, digits, space, `-`, `_` only (422 otherwise). Standard types are `morning` and `evening`; any custom type such as `competition` is allowed.
- One session per (date, type): a second one is 409 (database unique constraint plus a check in `session_service`).
- Creating a session adds an `Attendance` row for **every active student** with status `present`. Coaches only change the exceptions (mark absent).
- `GET ?from=&to=` list; with no filters it returns the last 30 days. `GET /{id}` includes attendance.
- `GET /{id}/attendance`; `PUT /{id}/attendance {updates: [{student_id, status}]}` with status `present|absent`. Returns `updated_count` (only rows whose status actually changed; it records `marked_by` and `marked_at`).
- `DELETE /{id}` is **head coach only** and cascades to the session's attendance and timings.

## Where it lives
`backend/routers/sessions.py`, `backend/services/session_service.py`, `backend/schemas/session.py` and `attendance.py`;
frontend `SessionList.jsx`, `SessionCreate.jsx`, `AttendanceView.jsx`. Tests: `backend/tests/test_sessions_timings.py`.

## Gotchas
- A student added after a session was created has **no attendance row** for that session; it will not count toward their attendance percentage.
- `PUT attendance` silently ignores student ids that have no row in the session.
- Deleting a session also deletes its timings and recomputes the affected personal bests (see [timings-pbs.md](timings-pbs.md)).
