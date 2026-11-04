# Clubs and onboarding

## Purpose
An academy registers itself; the super admin approves it; approval creates the head coach login and the club's own database.

## Behaviour
1. `POST /api/register-club {name, head_coach_name, head_coach_phone}` (public). 409 if the phone is already a user or already registered for a club. Creates a `pending` club; no user exists yet, so the head coach cannot log in.
2. Super admin (`/api/admin/...`, role `super_admin`):
   - `GET /clubs?status=`, `GET /clubs/{id}` (includes users), `GET /users`
   - `POST /clubs/{id}/approve`: 409 if already approved or the phone is already a user. Sets `approved`, creates the head coach `User`, creates the club DB with seeded swim styles and distance events, adds the head `Coach` row, writes an audit log.
   - `POST /clubs/{id}/reject {reason}`: 409 if already approved.
   - `DELETE /clubs/{id}`: deletes the club DB file, its users, the club row; audit logged.
3. Seeded reference data per club: swim styles (Freestyle FR, Backstroke BK, Breaststroke BR, Butterfly BF, Individual Medley IM) and distances 25, 50, 100, 200, 400, 800, 1500 m.

## Where it lives
- `backend/routers/auth.py` (`register_router`), `backend/routers/admin.py`, `backend/services/club_service.py`, `backend/db/engine.py` (`create_club_database`, `delete_club_database`).
- Frontend: `RegisterClub.jsx`, `AdminDashboard.jsx`, `AdminClubDetail.jsx`.
- Tests: `backend/tests/test_clubs.py`.

## Logs
`club_approved`, `club_rejected`, `club_deleted` (club_id, club_name, by).

## Gotchas
- Delete is permanent and removes the club's SQLite file.
- The club DB is created inside the approval request; a failure partway can leave an approved club without a DB. Check `DB_FILE_ACCESS` in the logs.
