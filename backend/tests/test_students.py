from conftest import STUDENT


def test_student_crud(client, club):
    base = f"/api/club/{club['club_id']}/students"
    r = client.post(base, json=STUDENT, headers=club["h"])
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert any(s["id"] == sid for s in client.get(base, headers=club["h"]).json())
    r = client.put(f"{base}/{sid}", json={"name": "Renamed"}, headers=club["h"])
    assert r.status_code == 200 and r.json()["name"] == "Renamed"
    assert client.delete(f"{base}/{sid}", headers=club["h"]).status_code == 200
    assert all(s["id"] != sid for s in client.get(base, headers=club["h"]).json())


def test_student_validation(client, club):
    base = f"/api/club/{club['club_id']}/students"
    future = {**STUDENT, "date_of_birth": "2999-01-01"}
    assert client.post(base, json=future, headers=club["h"]).status_code == 422
    no_primary = {**STUDENT, "parent_contacts": [{"relation": "mother", "phone": "9811111111", "is_primary": False}]}
    assert client.post(base, json=no_primary, headers=club["h"]).status_code == 422


def test_clubs_are_isolated(client, club, other_club):
    mine = f"/api/club/{club['club_id']}/students"
    # other club's coach cannot read or write this club
    assert client.get(mine, headers=other_club["h"]).status_code == 403
    assert client.post(mine, json=STUDENT, headers=other_club["h"]).status_code == 403
