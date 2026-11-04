# Coaches

## Purpose
A club has one head coach and any number of assistant coaches. Coaches are the only people who use the app inside a club; parents and students do not log in.

## Behaviour
- `GET /api/club/{club_id}/coaches` (any coach): list.
- `POST /coaches {name, phone}` (head coach): creates an `assistant_coach` in both databases (`users` in control.db, `coaches` in the club DB). 409 if the phone is already any user's.
- `PUT /coaches/{id} {name?, is_active?}` (head coach): updates both databases.
- `DELETE /coaches/{id}` (head coach): deactivates (not deleted) in both databases. 400 for the head coach. The coach is logged out on their next request because the active check hits control.db.
- Records keep the coach id (who created a student, marked attendance, recorded a timing).

## Where it lives
`backend/routers/coaches.py`, `backend/schemas/coach.py`; frontend `CoachList.jsx`, `CoachForm.jsx` (head coach only route `/coaches`).
Tests: `backend/tests/test_auth.py::test_deactivated_coach_loses_access_immediately`.

## Logs
`coach_deactivated` (coach_id, club_id, by).

## Gotchas
- The two databases are updated one after the other, not in one transaction. A crash between them can leave them out of sync.
- A deactivated coach's phone stays taken; it cannot be reused for a new coach.
