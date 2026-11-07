# Docs index

Context for people and coding agents working on this repo. These docs describe what the code does today.
`docs/archive/` holds the original plan and may be out of date; trust these docs and the code first.

**Rule:** change behaviour, change the matching doc in the same commit. Run `./run_tests.sh` before every commit.

| Doc | Read it when |
|---|---|
| [architecture.md](architecture.md) | You need the big picture: stack, tenancy, request flow, folder map |
| [conventions.md](conventions.md) | You are adding an endpoint, schema, test, log event or page |
| [operations.md](operations.md) | You are running, deploying or configuring the app (env vars live here) |
| [testing-and-logs.md](testing-and-logs.md) | You are debugging a failure or writing tests |
| [decisions.md](decisions.md) | You wonder why something is the way it is |

## Features

| Doc | Covers |
|---|---|
| [features/auth-otp-msg91.md](features/auth-otp-msg91.md) | OTP login, MSG91 SMS, 30-day sessions, access checks |
| [features/clubs-onboarding.md](features/clubs-onboarding.md) | Register, approve, reject, delete a club; super admin |
| [features/coaches.md](features/coaches.md) | Head vs assistant coach, adding and deactivating |
| [features/students.md](features/students.md) | Students, parent contacts, notes, skill assessments |
| [features/sessions-attendance.md](features/sessions-attendance.md) | Sessions and attendance |
| [features/timings-pbs.md](features/timings-pbs.md) | Timing entry and personal bests |
| [features/progress-reports.md](features/progress-reports.md) | Per-student progress report |
| [features/profile-settings.md](features/profile-settings.md) | Avatar in the top bar, profile screen, text size and layout settings, log out |
| [features/pwa-offline.md](features/pwa-offline.md) | Installable app and the offline screen |
| [features/demo-seed.md](features/demo-seed.md) | The demo school and `seed_demo.py` |
