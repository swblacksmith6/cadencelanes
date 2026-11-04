import threading
from datetime import date, timedelta

from conftest import STUDENT


def _student(client, club):
    return client.post(f"/api/club/{club['club_id']}/students", json=STUDENT, headers=club["h"]).json()["id"]


def _session(client, club, d, kind="morning"):
    return client.post(f"/api/club/{club['club_id']}/sessions",
                       json={"session_date": d.isoformat(), "session_type": kind}, headers=club["h"])


def test_session_unique_per_date_and_type(client, club):
    d = date.today() - timedelta(days=200)
    assert _session(client, club, d).status_code == 201
    assert _session(client, club, d).status_code == 409
    assert _session(client, club, d, "evening").status_code == 201


def test_session_type_validation(client, club):
    d = date.today() - timedelta(days=201)
    assert _session(client, club, d, "bad/type!").status_code == 422


def test_timing_lifecycle_and_personal_best(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    s1 = _session(client, club, date.today() - timedelta(days=300)).json()["id"]
    s2 = _session(client, club, date.today() - timedelta(days=299)).json()["id"]

    def post(session_id, t):
        return client.post(f"{base}/timings", headers=club["h"], json={
            "session_id": session_id, "student_id": sid, "swim_style_id": reference["style"],
            "distance_event_id": reference["dist"], "time_seconds": t})

    first = post(s1, 40.0)
    assert first.status_code == 201 and first.json()["is_new_pb"] is True
    slower = post(s2, 41.0)
    assert slower.json()["is_new_pb"] is False
    faster = post(s2 if False else s1, 39.0)  # same session may hold more than one attempt
    assert faster.status_code == 201

    rows = client.get(f"{base}/timings", params={"student_id": sid}, headers=club["h"]).json()
    assert len(rows) == 3
    tid = rows[0]["id"]
    assert client.put(f"{base}/timings/{tid}", json={"time_seconds": 38.5}, headers=club["h"]).status_code == 200
    assert client.delete(f"{base}/timings/{tid}", headers=club["h"]).status_code == 200


def test_timing_rejects_bad_input(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    body = {"session_id": "missing", "student_id": sid, "swim_style_id": reference["style"],
            "distance_event_id": reference["dist"], "time_seconds": 30}
    assert client.post(f"{base}/timings", json=body, headers=club["h"]).status_code == 404
    assert client.post(f"{base}/timings", json={**body, "time_seconds": 0}, headers=club["h"]).status_code == 422


def test_concurrent_coaches_can_all_write(client, club, reference):
    """Several coaches saving at once must queue on the SQLite lock, not fail."""
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    ses = _session(client, club, date.today() - timedelta(days=400)).json()["id"]
    results = []

    def write(n):
        for i in range(10):
            r = client.post(f"{base}/timings", headers=club["h"], json={
                "session_id": ses, "student_id": sid, "swim_style_id": reference["style"],
                "distance_event_id": reference["dist"], "time_seconds": 30 + n + i / 10})
            results.append(r.status_code)

    threads = [threading.Thread(target=write, args=(n,)) for n in range(8)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert results.count(201) == 80, f"non-201 statuses: {[r for r in results if r != 201]}"


# ── personal best stays correct when timings change ──────────────────────

def _pb(client, club, sid):
    report = client.get(f"/api/club/{club['club_id']}/students/{sid}/progress", headers=club["h"]).json()
    return report["personal_bests"]


def _add(client, club, reference, sid, session_id, t):
    r = client.post(f"/api/club/{club['club_id']}/timings", headers=club["h"], json={
        "session_id": session_id, "student_id": sid, "swim_style_id": reference["style"],
        "distance_event_id": reference["dist"], "time_seconds": t})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_deleting_the_pb_timing_falls_back_to_the_next_best(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    ses = _session(client, club, date.today() - timedelta(days=500)).json()["id"]
    _add(client, club, reference, sid, ses, 40.0)
    best = _add(client, club, reference, sid, ses, 38.0)
    pbs = _pb(client, club, sid)
    assert len(pbs) == 1 and pbs[0]["best_time"] == 38.0 and pbs[0]["previous_best"] == 40.0

    assert client.delete(f"{base}/timings/{best}", headers=club["h"]).status_code == 200
    pbs = _pb(client, club, sid)
    assert pbs[0]["best_time"] == 40.0 and pbs[0]["previous_best"] is None


def test_editing_a_timing_updates_the_pb_both_ways(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    ses = _session(client, club, date.today() - timedelta(days=501)).json()["id"]
    first = _add(client, club, reference, sid, ses, 40.0)
    second = _add(client, club, reference, sid, ses, 42.0)

    client.put(f"{base}/timings/{second}", json={"time_seconds": 36.5}, headers=club["h"])
    assert _pb(client, club, sid)[0]["best_time"] == 36.5
    # correcting a mistyped fast time back to a slow one lifts the PB again
    client.put(f"{base}/timings/{second}", json={"time_seconds": 45.0}, headers=club["h"])
    assert _pb(client, club, sid)[0]["best_time"] == 40.0
    assert first  # still the PB holder


def test_deleting_the_last_timing_removes_the_pb(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    ses = _session(client, club, date.today() - timedelta(days=502)).json()["id"]
    only = _add(client, club, reference, sid, ses, 41.0)
    assert len(_pb(client, club, sid)) == 1
    client.delete(f"{base}/timings/{only}", headers=club["h"])
    assert _pb(client, club, sid) == []


def test_deleting_a_session_recomputes_pbs_from_its_timings(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    keep = _session(client, club, date.today() - timedelta(days=503)).json()["id"]
    drop = _session(client, club, date.today() - timedelta(days=504)).json()["id"]
    _add(client, club, reference, sid, keep, 45.0)
    _add(client, club, reference, sid, drop, 43.0)
    assert _pb(client, club, sid)[0]["best_time"] == 43.0
    assert client.delete(f"{base}/sessions/{drop}", headers=club["h"]).status_code == 200
    assert _pb(client, club, sid)[0]["best_time"] == 45.0


def test_timing_rejects_unknown_student_style_or_distance(client, club, reference):
    base = f"/api/club/{club['club_id']}"
    sid = _student(client, club)
    ses = _session(client, club, date.today() - timedelta(days=505)).json()["id"]
    good = {"session_id": ses, "student_id": sid, "swim_style_id": reference["style"],
            "distance_event_id": reference["dist"], "time_seconds": 30}
    for field, label in (("student_id", "Student"), ("swim_style_id", "Swim style"), ("distance_event_id", "Distance")):
        r = client.post(f"{base}/timings", json={**good, field: "does-not-exist"}, headers=club["h"])
        assert r.status_code == 404 and label in r.json()["detail"]
