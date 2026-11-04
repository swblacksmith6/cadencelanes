# Clubs and onboarding

## Purpose
An academy registers itself and the super admin approves it, or the super admin adds a club and its head coach directly. Either way approval creates the head coach login and the club's own database.

## Behaviour
1. `POST /api/register-club {name, head_coach_name, head_coach_phone}` (public). 409 if the phone is already a user or already registered for a club. Creates a `pending` club; no user exists yet, so the head coach cannot log in.
2. Super admin (`/api/admin/...`, role `super_admin`):
   - `GET /clubs?status=`, `GET /clubs/{id}` (includes users), `GET /users`
   - `POST /clubs {name, head_coach_name, head_coach_phone}` (201): the super admin adds a club and head coach directly. The club is created already `approved` in one step (same code path as approve, so the club DB, seeded reference data, head `Coach` row and audit entry are all created). 409 if the phone belongs to any user, a registered club, or the super admin; 422 on bad input. The head coach can log in at once.
   - `POST /clubs/{id}/approve`: 409 if already approved or the phone is already a user. Sets `approved`, creates the head coach `User`, creates the club DB with seeded swim styles and distance events, adds the head `Coach` row, writes an audit log.
   - `POST /clubs/{id}/reject {reason}`: 409 if already approved.
   - `DELETE /clubs/{id}`: deletes the club DB file, its users, the club row; audit logged.
3. Seeded reference data per club: swim styles (Freestyle FR, Backstroke BK, Breaststroke BR, Butterfly BF, Individual Medley IM) and distances 25, 50, 100, 200, 400, 800, 1500 m.

## Where it lives
- `backend/routers/auth.py` (`register_router`), `backend/routers/admin.py`, `backend/services/club_service.py`, `backend/db/engine.py` (`create_club_database`, `delete_club_database`).
- Phone checks shared by registration and admin create: `club_service.ensure_phone_available`.
- Frontend: `RegisterClub.jsx`, `AdminDashboard.jsx` (Add club button opens a form, then shows the Approved tab), `AdminClubDetail.jsx`.
- Tests: `backend/tests/test_clubs.py`, `frontend/src/pages/AdminDashboard.test.jsx`.

## Logs
`club_approved`, `club_rejected`, `club_deleted`, `club_created_by_admin` (club_id, club_name, by).

## Gotchas
- Delete is permanent and removes the club's SQLite file.
- The club DB is created inside the approval request; a failure partway can leave an approved club without a DB. Check `DB_FILE_ACCESS` in the logs.
