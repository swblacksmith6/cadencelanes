#!/usr/bin/env python3
"""Seed a realistic demo swim school into a running SwimAcademy instance via its API.

Usage: python3 seed_demo.py [port]   (default port 8080)

Creates "Aqua Stars Swim Academy" with 24 students — 6 in each SFI-style age
category — 4 weeks of sessions, weekly Friday time trials with times improving
~1-2% per week, one competition for the older groups, skill assessments and
coach notes. Everything goes through the real API, so PBs, streaks and trends
are genuinely computed by the app.
"""
import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

PORT = sys.argv[1] if len(sys.argv) > 1 else "8080"
BASE = f"http://localhost:{PORT}/api"

HEAD_COACH_PHONE = "9800000001"
ASSISTANT_PHONE = "9800000002"

# Age categories (as of 2026-08-05). Each: 6 students, category-appropriate
# events (style, distance, group base time in seconds, seconds gained per week),
# skill ratings range, and absence rate (miss ~1 in N sessions).
CATEGORIES = [
    {
        "name": "8 & Under",
        "students": [
            ("Aarav Mehta", "2019-04-14"), ("Diya Kapoor", "2018-11-03"),
            ("Vivaan Singh", "2019-08-22"), ("Anika Rao", "2020-01-19"),
            ("Kabir Das", "2018-09-30"), ("Ishita Menon", "2019-12-07"),
        ],
        "events": [("FR", "25m", 38.0, 0.8), ("BK", "25m", 44.0, 0.9)],
        "styles_rated": ["FR"],
        "rating_range": (1, 2),
        "miss_one_in": 5,
        "competes": False,
    },
    {
        "name": "Group IV (9-10)",
        "students": [
            ("Arjun Nair", "2016-05-11"), ("Saanvi Pillai", "2017-02-27"),
            ("Reyansh Gupta", "2016-10-09"), ("Myra Shetty", "2017-06-15"),
            ("Advait Kulkarni", "2016-03-04"), ("Kiara Bose", "2017-01-23"),
        ],
        "events": [("FR", "50m", 52.0, 0.9), ("BK", "50m", 62.0, 1.0), ("FR", "25m", 24.5, 0.4)],
        "styles_rated": ["FR", "BK"],
        "rating_range": (2, 3),
        "miss_one_in": 6,
        "competes": False,
    },
    {
        "name": "Group III (11-12)",
        "students": [
            ("Ravi Kumar", "2014-03-12"), ("Ananya Sharma", "2015-07-25"),
            ("Aditya Iyer", "2014-11-02"), ("Sneha Reddy", "2014-09-18"),
            ("Rohan Verma", "2015-04-06"), ("Tara Krishnan", "2014-07-29"),
        ],
        "events": [("FR", "50m", 42.0, 0.7), ("BK", "50m", 50.0, 0.7),
                   ("BR", "50m", 56.0, 0.8), ("FR", "100m", 96.0, 1.5)],
        "styles_rated": ["FR", "BK", "BR"],
        "rating_range": (2, 4),
        "miss_one_in": 8,
        "competes": True,
    },
    {
        "name": "Group II (13-14)",
        "students": [
            ("Dev Malhotra", "2012-06-17"), ("Nisha Patel", "2013-03-08"),
            ("Karthik Rajan", "2012-12-01"), ("Pooja Hegde", "2013-07-10"),
            ("Siddharth Joshi", "2012-02-14"), ("Lakshmi Iyer", "2013-05-30"),
        ],
        "events": [("FR", "50m", 33.5, 0.4), ("FR", "100m", 76.0, 0.9),
                   ("BF", "50m", 39.0, 0.5), ("FR", "200m", 165.0, 2.0)],
        "styles_rated": ["FR", "BK", "BF"],
        "rating_range": (3, 5),
        "miss_one_in": 10,
        "competes": True,
    },
]

RELATIONS = ["father", "mother", "guardian"]

NOTES = [
    ("Ravi Kumar", "Breathing rhythm on freestyle is much more consistent now.", "technique"),
    ("Ravi Kumar", "Target: under 38s on 50m freestyle before the district meet.", "goal"),
    ("Dev Malhotra", "Race pace holding well over 200m. Ready for state qualifiers.", "goal"),
    ("Nisha Patel", "Butterfly recovery arm slightly wide; drills assigned.", "technique"),
    ("Arjun Nair", "Completed full evening sets without breaks — stamina way up.", "fitness"),
    ("Diya Kapoor", "Much more confident putting face in water. Big milestone.", "general"),
    ("Aarav Mehta", "Kicks from the hip now instead of the knee.", "technique"),
    ("Tara Krishnan", "Encourages the younger group during warm-ups. Natural leader.", "behavior"),
    ("Sneha Reddy", "Flip turns losing nearly a second — turn drills twice a week.", "technique"),
    ("Kiara Bose", "Backstroke start improving; still hesitant on the push-off.", "general"),
    ("Siddharth Joshi", "Slight shoulder fatigue reported — monitoring load this week.", "fitness"),
    ("Pooja Hegde", "Goal set: qualify for Group II 100m free finals this season.", "goal"),
]


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def login(phone):
    s, r = call("POST", "/auth/request-otp", {"phone": phone})
    if s != 200:
        raise SystemExit(f"Cannot log in {phone}: {r}")
    if "otp" not in r:
        raise SystemExit("The API did not return the OTP. Start it with OTP_IN_RESPONSE=true (dev only).")
    s, r = call("POST", "/auth/verify-otp", {"phone": phone, "code": r["otp"]})
    return r["access_token"], r["user"]


def main():
    # 1. Register + approve the demo club
    s, r = call("POST", "/register-club", {
        "name": "Aqua Stars Swim Academy",
        "head_coach_name": "Rajesh Menon",
        "head_coach_phone": HEAD_COACH_PHONE,
    })
    if s == 409:
        # Club exists: resume only if an earlier run died before creating students.
        head, user = login(HEAD_COACH_PHONE)
        cid = user["club_id"]
        s, existing = call("GET", f"/club/{cid}/students", token=head)
        if existing:
            print("Demo club already exists with students — aborting (nothing changed).")
            return
        print("Demo club exists but has no students — resuming seed.")
    else:
        admin, _ = login("9999999999")
        s, clubs = call("GET", "/admin/clubs?status=pending", token=admin)
        club_id = next(c["id"] for c in clubs if c["head_coach_phone"] == HEAD_COACH_PHONE)
        call("POST", f"/admin/clubs/{club_id}/approve", token=admin)
        head, user = login(HEAD_COACH_PHONE)
        cid = user["club_id"]
        print("Club approved: Aqua Stars Swim Academy")

    call("POST", f"/club/{cid}/coaches", {"name": "Divya Nair", "phone": ASSISTANT_PHONE}, token=head)

    # 2. Students — 6 per category, phones deterministic
    phone_n = 9820000000
    roster = []  # (student_id, name, category_index, index_in_category)
    for ci, cat in enumerate(CATEGORIES):
        for i, (name, dob) in enumerate(cat["students"]):
            phone_n += 2
            contacts = [{"relation": RELATIONS[i % 3], "name": None, "phone": str(phone_n), "is_primary": True}]
            if i % 2 == 0:  # half the students get a second contact
                contacts.append({"relation": RELATIONS[(i + 1) % 3], "name": None,
                                 "phone": str(phone_n + 1), "is_primary": False})
            s, r = call("POST", f"/club/{cid}/students",
                        {"name": name, "date_of_birth": dob, "parent_contacts": contacts}, token=head)
            if s != 201:
                raise SystemExit(f"Failed to create {name}: {r}")
            roster.append((r["id"], name, ci, i))
    print(f"Students created: {len(roster)} (6 per category x {len(CATEGORIES)})")

    # 3. Reference data
    s, styles = call("GET", f"/club/{cid}/swim-styles", token=head)
    s, dists = call("GET", f"/club/{cid}/distance-events", token=head)
    style = {x["short_code"]: x["id"] for x in styles}
    dist = {x["label"]: x["id"] for x in dists}

    # 4. Four weeks of sessions: Mon-Fri morning+evening, Sat morning, Sun off.
    #    Weekly time trial every Friday morning; competition last Saturday.
    today = date.today()
    n_sessions = n_timings = 0
    day_index = 0
    trial_index = -1
    last_saturday = None
    for offset in range(27, -1, -1):
        d = today - timedelta(days=offset)
        wd = d.weekday()  # Mon=0 .. Sun=6
        if wd == 6:
            continue
        day_index += 1
        if wd == 5:
            last_saturday = d
        slots = ["morning"] if wd == 5 else ["morning", "evening"]
        for stype in slots:
            s, sess = call("POST", f"/club/{cid}/sessions",
                           {"session_date": d.isoformat(), "session_type": stype}, token=head)
            if s != 201:
                continue
            n_sessions += 1

            # attendance: each student misses ~1 in N sessions (younger miss more)
            absent = set()
            for sid, name, ci, i in roster:
                if (day_index * 31 + i * 17 + ci * 7 + (stype == "evening")) % CATEGORIES[ci]["miss_one_in"] == 0:
                    absent.add(sid)
            if absent:
                call("PUT", f"/club/{cid}/sessions/{sess['id']}/attendance",
                     {"updates": [{"student_id": x, "status": "absent"} for x in absent]}, token=head)

            # Friday morning = time trial: each swimmer does 2 of their category events
            if wd == 4 and stype == "morning":
                trial_index += 1
                for sid, name, ci, i in roster:
                    if sid in absent:
                        continue
                    events = CATEGORIES[ci]["events"]
                    picks = {(trial_index + i) % len(events), (trial_index + i + 1) % len(events)}
                    for e in picks:
                        code, label, base, weekly_gain = events[e]
                        spread = base * 0.04 * ((i % 6) - 2.5) / 2.5      # swimmer ability spread +/-4%
                        jitter = ((trial_index * 13 + i * 7 + e * 3) % 5 - 2) * base * 0.004
                        t = round(base + spread - trial_index * weekly_gain + jitter, 2)
                        s, r = call("POST", f"/club/{cid}/timings", {
                            "session_id": sess["id"], "student_id": sid,
                            "swim_style_id": style[code], "distance_event_id": dist[label],
                            "time_seconds": t,
                        }, token=head)
                        if s == 201:
                            n_timings += 1
    print(f"Sessions created: {n_sessions}, trial timings: {n_timings}")

    # 5. Competition (last Saturday) for the two older groups — near-PB race times
    if last_saturday:
        s, comp = call("POST", f"/club/{cid}/sessions",
                       {"session_date": last_saturday.isoformat(), "session_type": "competition",
                        "notes": "Inter-club meet — Groups II & III"}, token=head)
        if s == 201:
            n_comp = 0
            for sid, name, ci, i in roster:
                if not CATEGORIES[ci]["competes"]:
                    continue
                code, label, base, weekly_gain = CATEGORIES[ci]["events"][i % 2]  # main event
                spread = base * 0.04 * ((i % 6) - 2.5) / 2.5
                t = round(base + spread - 3 * weekly_gain - base * 0.008, 2)  # race adrenaline: beats training
                s, r = call("POST", f"/club/{cid}/timings", {
                    "session_id": comp["id"], "student_id": sid,
                    "swim_style_id": style[code], "distance_event_id": dist[label],
                    "time_seconds": t, "notes": "Race result",
                }, token=head)
                if s == 201:
                    n_comp += 1
            print(f"Competition session added ({n_comp} race results)")

    # 6. Skill assessments — two rounds per rated style, showing progression
    for sid, name, ci, i in roster:
        lo, hi = CATEGORIES[ci]["rating_range"]
        for si, code in enumerate(CATEGORIES[ci]["styles_rated"]):
            current = min(hi, lo + (i + si) % (hi - lo + 1))
            first = max(1, current - 1)
            call("POST", f"/club/{cid}/students/{sid}/assessments",
                 {"swim_style_id": style[code], "rating": first}, token=head)
            call("POST", f"/club/{cid}/students/{sid}/assessments",
                 {"swim_style_id": style[code], "rating": current,
                  "notes": "Improved over the last month"}, token=head)
    print("Skill assessments added")

    # 7. Coach notes
    by_name = {name: sid for sid, name, ci, i in roster}
    for name, note, category in NOTES:
        call("POST", f"/club/{cid}/students/{by_name[name]}/notes",
             {"note": note, "category": category}, token=head)
    print("Coach notes added")

    print(f"""
Demo school ready on http://localhost:{PORT}

  Head coach login : {HEAD_COACH_PHONE}  (Rajesh Menon)
  Assistant login  : {ASSISTANT_PHONE}  (Divya Nair)
  Super admin      : 9999999999

Categories: 8&Under, Group IV (9-10), Group III (11-12), Group II (13-14) — 6 students each.
Best demo: login as head coach -> Students -> "Progress" on Dev Malhotra or Ravi Kumar.""")


if __name__ == "__main__":
    main()
