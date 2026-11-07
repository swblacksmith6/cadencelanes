# Students, notes and skill assessments

## Purpose
The roster of swimmers for a club, with parent contacts, coach notes and per-stroke skill ratings.

## Behaviour
All routes `/api/club/{club_id}/students...`, any coach.
- `GET ?include_inactive=` list (active only by default), sorted by name. `GET /{id}`.
- `POST` body: `name`, `date_of_birth` (must be in the past), optional `address`, `parent_contacts` (1 or 2; relation `father|mother|guardian`; phone 10 to 15 chars; **exactly one** `is_primary`). 201.
- `PUT /{id}` partial update, including `is_active` and replacing `parent_contacts` (same primary rule).
- `DELETE /{id}` soft-deactivates (`is_active=false`); history is kept. Inactive students are not added to new sessions.
- Notes: `GET/POST /{id}/notes`, category `general|technique|fitness|behavior|goal`.
- Skill assessments: `GET/POST /{id}/assessments`, `rating` 1 to 5 (1 Beginner, 2 Elementary, 3 Intermediate, 4 Advanced, 5 Elite) for a swim style. Each assessment is a new history row, the latest is "current".
- On a phone each student is a card. The primary contact has call (`tel:`), WhatsApp (`wa.me`, 10-digit numbers get the 91 prefix) and text (`sms:`) icons, built in `frontend/src/utils/phone.js`. Progress, timings and edit are icon buttons. From tablet width the list is a table with text links.
- The UI shows exact age (`11y 2m 5d`, `frontend/src/utils/age.js`) so coaches can place swimmers in age categories (8 & Under, Group IV 9-10, III 11-12, II 13-14 in the demo data). Categories are not stored; they are a display convention.

## Where it lives
`backend/routers/students.py`, `backend/schemas/student.py`, `backend/db/club_models.py` (`Student`, `ParentContact`, `CoachNote`, `SkillAssessment`);
frontend `StudentList.jsx`, `StudentForm.jsx`. Tests: `backend/tests/test_students.py`, `frontend/src/utils/age.test.js`.

## Gotchas
- Students are scoped to their club by the database file, so cross-club access is blocked by the `club_id` check in the token dependency.
- Phones are not unique across students (siblings share parents).
