# Timings and personal bests

## Purpose
Coaches record a swimmer's time for a stroke and distance in a session (practice time trial or competition). The app maintains each swimmer's personal best (PB).

## Behaviour
Routes `/api/club/{club_id}/timings...`, any coach.
- `POST {session_id, student_id, swim_style_id, distance_event_id, time_seconds, notes?}` (201). `time_seconds` must be greater than 0 (422). 404 if the session does not exist. Returns the timing plus `is_new_pb` and `improvement` (seconds, only when an existing PB was beaten).
- A swimmer may have several timings for the same stroke/distance in the same session.
- PB logic (`backend/services/timing_service.py::record_timing`): one `PersonalBest` row per (student, style, distance). The first timing creates it. A later timing strictly faster than the PB updates it, keeps `previous_best`, and sets `achieved_at` and `timing_id`. Equal or slower times leave it alone.
- `GET ?student_id=&style_id=&distance_id=` list, newest session first, each row has `is_pb`. `GET /session/{session_id}` lists a session's timings.
- `PUT /{id} {time_seconds?, notes?}`, `DELETE /{id}`.
- Frontend: `TimingEntry.jsx` (quick poolside entry, remembers the last style and distance in localStorage as `qe_style`, `qe_dist`) and `TimingHistory.jsx`.

## Where it lives
`backend/routers/timings.py`, `backend/services/timing_service.py`, `backend/schemas/timing.py`, models `Timing`, `PersonalBest` in `club_models.py`.
Tests: `backend/tests/test_sessions_timings.py` (lifecycle, PB, validation, 8 coaches writing at once).

## Gotchas
- **Editing or deleting a timing does not recompute the PB.** If the PB timing is changed or removed, `personal_bests` still holds the old value. Fixing this means recalculating from the remaining timings.
- `student_id`, `swim_style_id` and `distance_event_id` are not validated for existence in the route; SQLite foreign keys are not enforced by default.
- All writes go through the single SQLite writer; concurrent coaches queue (see [architecture.md](../architecture.md)).
- Entering a timing needs the internet; there is no offline queue (see [decisions.md](../decisions.md)).
