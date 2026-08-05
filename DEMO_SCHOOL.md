# Demo School — Aqua Stars Swim Academy

Pre-populated demo data for showing SwimAcademy to coaches and for manual
testing. Seeded via `seed_demo.py`, which drives the real API — every number
you see (attendance %, streaks, PBs, trends) is genuinely computed by the app.

---

## 1. Quick Start

```bash
./run.sh                     # start the app (default port 8080)
python3 seed_demo.py         # seed the demo school (only needed on a fresh DB)
```

Use `PORT=9000 ./run.sh` + `python3 seed_demo.py 9000` for a different port.
The seeder is safe to re-run: if the demo club already exists it aborts without
changing anything.

## 2. Login Credentials

OTP login only — the OTP is shown on screen after you enter the phone (MVP mode,
no real SMS). App: **http://localhost:8080**

| Role | Phone | Name | What they can do |
|---|---|---|---|
| Super admin | `9999999999` | Super Admin | Approve/reject/delete clubs, view users |
| Head coach | `9800000001` | Rajesh Menon | Everything in the club, incl. managing coaches |
| Assistant coach | `9800000002` | Divya Nair | Students, sessions, attendance, timings, notes |

## 3. Roster — 24 Students, 6 per Age Category

Categories follow SFI-style age groups (exact age shows under each student's
name as `12y 4m 24d` for category placement):

| Category | Students | Events seeded | Typical 50m FR | Ratings | Attendance |
|---|---|---|---|---|---|
| 8 & Under | Aarav Mehta, Diya Kapoor, Vivaan Singh, Anika Rao, Kabir Das, Ishita Menon | 25m FR, 25m BK | — (25m ~35s) | 1–2 ★ | ~80% |
| Group IV (9–10) | Arjun Nair, Saanvi Pillai, Reyansh Gupta, Myra Shetty, Advait Kulkarni, Kiara Bose | 25/50m FR, 50m BK | ~48–52s | 2–3 ★ | ~84% |
| Group III (11–12) | Ravi Kumar, Ananya Sharma, Aditya Iyer, Sneha Reddy, Rohan Verma, Tara Krishnan | 50m FR/BK/BR, 100m FR | ~38–42s | 2–4 ★ | ~88% |
| Group II (13–14) | Dev Malhotra, Nisha Patel, Karthik Rajan, Pooja Hegde, Siddharth Joshi, Lakshmi Iyer | 50/100/200m FR, 50m BF | ~31–34s | 3–5 ★ | ~91% |

## 4. What the Session Data Looks Like

- **44 sessions over 4 weeks** — morning + evening Mon–Fri, morning-only
  Saturday, Sundays off. Realistic coaching rhythm.
- **Weekly time trials every Friday morning** — each swimmer does 2 of their
  category's events, improving ~1–2% per week with natural jitter. ~160 timings
  total, so PB improvements and downward trend charts appear everywhere.
- **One competition session last Saturday** ("Inter-club meet — Groups II & III")
  with 12 race results that slightly beat training times — shows the dynamic
  session type and race-day PBs.
- **Absences scale by age** — younger kids miss ~1 in 5 sessions, teens ~1 in 10,
  so attendance rings differ believably across categories.
- **Skill assessments in two rounds** per rated stroke (progression visible),
  rating ranges matched to category.
- **12 coach notes** across all categories (technique / fitness / behavior /
  goal / general).

## 5. Suggested Demo Walkthrough

1. **Login as head coach** (`9800000001`) on a desktop → Analytics mode:
   dashboard stats, student table with exact ages.
2. **Students → "Progress" on Dev Malhotra** (Group II star) — attendance rings,
   PB table incl. the competition race, trend charts, 5★ butterfly. Try **Print**.
3. **Compare with Aarav Mehta** (8 & Under) — sparser data, 25m only, 1★ — shows
   the app fits beginners too.
4. **Flip the phone/desktop switch** (top-right icons) → Coach mode: big-button
   Today screen, bottom tabs — the poolside experience.
5. **Timings tab** — pick the set (style + distance chips), type a time faster
   than a PB, press Enter → instant "PB −x.xs 🎉".
6. **Sessions** — arrow back to last Saturday to show the competition card.
7. **Login as super admin** (`9999999999`) — club approval workflow.

## 6. Where the Data Lives

SQLite files are bind-mounted to the host — they survive container removal and
image rebuilds:

```
data/control.db          # clubs, users, OTP codes, audit log
data/clubs/club_<id>.db  # all Aqua Stars data (students, sessions, timings…)
```

Back up by copying the `data/` folder. The app runs in its own Docker network
(`swim-academy-net`) via docker compose, isolated from other dev containers.

## 7. Resetting

```bash
docker compose down         # stop the app
rm -rf data                 # wipe ALL data (demo school included)
./run.sh                    # start fresh on 8080 (recreates super admin)
python3 seed_demo.py        # re-seed the demo school
```

To tweak the demo (categories, event times, absence rates), edit the
`CATEGORIES` table at the top of `seed_demo.py` and re-seed on a fresh database.
