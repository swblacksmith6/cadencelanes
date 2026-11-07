# Progress reports

## Purpose
One read-only report per student combining attendance, PBs, timing trends, skill ratings and recent notes.

## Behaviour
`GET /api/club/{club_id}/students/{student_id}/progress?from_date=&to_date=` (any coach, 404 if the student is missing).
The date range filters **timing trends only**. Response (`build_progress_report` in `backend/services/progress_service.py`):
- `student`: id, name, age (years), date_of_birth, enrolled_since.
- `attendance`: `last_7_days`, `last_30_days`, `all_time` as `{total, attended, percentage}` plus `current_streak` (consecutive `present` sessions counting back from the latest session).
- `personal_bests`: style, distance, best_time, previous_best, improvement, achieved_at.
- `timing_trends`: keyed `<STYLE_CODE>_<distance label>` (for example `FR_50m`), each with `label` and `data` points `{date, time, session_type}` ascending by date.
- `skill_ratings`: per style the `current` rating, its label and the dated `history`.
- `recent_notes`: the 20 newest coach notes.

## Where it lives
`backend/routers/progress.py` (mounted under the students prefix), `backend/services/progress_service.py`; frontend `ProgressReport.jsx` (charts with recharts) and a Print icon button (`window.print()`; elements with the `no-print` class are hidden when printing). The timing trend is chosen with radio-button chips, one per style and distance, each showing that swim's personal best in brackets, for example `Freestyle 50m (PB 30.69s)` (the fastest recorded time if no personal best row exists). On a phone the attendance rings and personal bests are compact so both show on the first screen; personal bests are a list there and a table from tablet width up.

## Gotchas
- Attendance and streak only count sessions that have an attendance row for the student.
- PBs shown are the stored `personal_bests` rows, kept correct by [timings-pbs.md](timings-pbs.md).
- Tests: `backend/tests/test_progress.py` (attendance and streak, trends and date filter, PB improvement, skill ratings, notes).
