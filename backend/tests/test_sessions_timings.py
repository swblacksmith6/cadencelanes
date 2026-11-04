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
