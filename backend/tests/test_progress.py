from datetime import date, timedelta

from conftest import STUDENT


def _setup(client, club, reference, days_ago_start):
    base = f"/api/club/{club['club_id']}"
    sid = client.post(f"{base}/students", json=STUDENT, headers=club["h"]).json()["id"]
    sessions = []
    for i in range(4):  # oldest first; the last one is the most recent
        d = date.today() - timedelta(days=days_ago_start - i)
        sessions.append(client.post(f"{base}/sessions", json={"session_date": d.isoformat(), "session_type": "morning"},
                                    headers=club["h"]).json()["id"])
    return base, sid, sessions


def _report(client, base, sid, club, **params):
    r = client.get(f"{base}/students/{sid}/progress", params=params, headers=club["h"])
    assert r.status_code == 200, r.text
    return r.json()


def test_unknown_student_is_404(client, club):
    r = client.get(f"/api/club/{club['club_id']}/students/nope/progress", headers=club["h"])
    assert r.status_code == 404


def test_report_requires_login(client, club):
    assert client.get(f"/api/club/{club['club_id']}/students/x/progress").status_code == 401


def test_attendance_percentage_and_streak(client, club, reference):
    base, sid, sessions = _setup(client, club, reference, 3)  # sessions on days -3, -2, -1, 0
    # mark the second session absent: 3 of 4 present, current streak = 2 (the two most recent)
    client.put(f"{base}/sessions/{sessions[1]}/attendance",
               json={"updates": [{"student_id": sid, "status": "absent"}]}, headers=club["h"])
    att = _report(client, base, sid, club)["attendance"]
    assert att["all_time"] == {"total": 4, "attended": 3, "percentage": 75.0}
    assert att["last_7_days"]["total"] == 4
    assert att["current_streak"] == 2


def test_trends_are_grouped_per_stroke_and_distance_and_date_filtered(client, club, reference):
    base, sid, sessions = _setup(client, club, reference, 40)  # days -40 .. -37
    for ses, t in zip(sessions, (50.0, 49.0, 48.5, 47.0)):
        client.post(f"{base}/timings", headers=club["h"], json={
            "session_id": ses, "student_id": sid, "swim_style_id": reference["style"],
            "distance_event_id": reference["dist"], "time_seconds": t})
    trends = _report(client, base, sid, club)["timing_trends"]
    assert len(trends) == 1
    series = next(iter(trends.values()))
    assert [p["time"] for p in series["data"]] == [50.0, 49.0, 48.5, 47.0]
    assert series["data"] == sorted(series["data"], key=lambda p: p["date"])

    since = (date.today() - timedelta(days=38)).isoformat()
    filtered = next(iter(_report(client, base, sid, club, from_date=since)["timing_trends"].values()))
    assert [p["time"] for p in filtered["data"]] == [48.5, 47.0]


def test_personal_bests_show_improvement(client, club, reference):
    base, sid, sessions = _setup(client, club, reference, 60)
    for ses, t in zip(sessions[:2], (40.0, 38.5)):
        client.post(f"{base}/timings", headers=club["h"], json={
            "session_id": ses, "student_id": sid, "swim_style_id": reference["style"],
            "distance_event_id": reference["dist"], "time_seconds": t})
    pb = _report(client, base, sid, club)["personal_bests"][0]
    assert (pb["best_time"], pb["previous_best"], pb["improvement"]) == (38.5, 40.0, 1.5)


def test_skill_ratings_use_latest_and_keep_history(client, club, reference):
    base, sid, _ = _setup(client, club, reference, 80)
    for rating in (2, 4):
        r = client.post(f"{base}/students/{sid}/assessments", headers=club["h"],
                        json={"swim_style_id": reference["style"], "rating": rating})
        assert r.status_code == 201
    skills = _report(client, base, sid, club)["skill_ratings"]
    entry = next(iter(skills.values()))
    assert entry["current"] == 4 and entry["label"] == "Advanced"
    assert [h["rating"] for h in entry["history"]] == [2, 4]
    bad = client.post(f"{base}/students/{sid}/assessments", headers=club["h"],
                      json={"swim_style_id": reference["style"], "rating": 6})
    assert bad.status_code == 422


def test_recent_notes_newest_first(client, club, reference):
    base, sid, _ = _setup(client, club, reference, 90)
    for text in ("first", "second"):
        assert client.post(f"{base}/students/{sid}/notes", json={"note": text, "category": "technique"},
                           headers=club["h"]).status_code == 201
    notes = _report(client, base, sid, club)["recent_notes"]
    assert [n["note"] for n in notes] == ["second", "first"]
    assert notes[0]["category"] == "technique"
