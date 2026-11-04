# Demo school and seeder

## Purpose
A realistic demo academy for demos and manual testing: "Aqua Stars Swim Academy". Full roster and talking points are in [DEMO_SCHOOL.md](../../DEMO_SCHOOL.md).

## Behaviour
`python3 seed_demo.py [port]` (default 8080) drives the real HTTP API, so PBs, streaks and trends are computed by the app:
registers and approves the club, adds an assistant coach, 24 students (6 in each of 4 age categories), four weeks of sessions, Friday time trials with improving times, one competition, skill assessments and coach notes.

- Logins: head coach `9800000001`, assistant `9800000002`, super admin `9999999999`.
- It needs the API to return the OTP, so run it against the **dev** stack (`OTP_IN_RESPONSE=true`). It stops with a clear message otherwise.
- Re-running: if the club exists with students it aborts without changes; if the club exists but has no students (an earlier run died) it resumes.
- Data lands in `./data` for the dev stack. To start over, stop the container and delete `data/control.db` and `data/clubs`.

## Where it lives
`seed_demo.py` (root), `DEMO_SCHOOL.md`.

## Gotchas
- Sessions are generated relative to today, so the demo always looks current when seeded.
- The OTP login note in `DEMO_SCHOOL.md` describes dev mode; production sends SMS.
