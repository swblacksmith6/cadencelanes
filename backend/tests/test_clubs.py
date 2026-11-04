from conftest import new_phone


def test_register_duplicate_phone_is_409(client, club):
    r = client.post("/api/register-club", json={"name": "Dup", "head_coach_name": "X", "head_coach_phone": club["phone"]})
    assert r.status_code == 409


def test_pending_club_head_cannot_login_until_approved(client, admin_token, api):
    phone = new_phone()
    client.post("/api/register-club", json={"name": "Pending", "head_coach_name": "P", "head_coach_phone": phone})
    assert client.post("/api/auth/request-otp", json={"phone": phone}).status_code == 404


def test_admin_routes_need_super_admin(client, club, admin_token, api):
    assert client.get("/api/admin/clubs", headers=club["h"]).status_code == 403
    assert client.get("/api/admin/clubs").status_code == 401
    assert client.get("/api/admin/clubs", headers=api.h(admin_token)).status_code == 200


def test_reject_club(client, admin_token, api):
    phone = new_phone()
    cid = client.post("/api/register-club", json={"name": "Rej", "head_coach_name": "R", "head_coach_phone": phone}).json()["club_id"]
    r = client.post(f"/api/admin/clubs/{cid}/reject", json={"reason": "incomplete"}, headers=api.h(admin_token))
    assert r.status_code == 200
    assert client.get(f"/api/admin/clubs/{cid}", headers=api.h(admin_token)).json()["status"] == "rejected"


def test_double_approve_is_409(client, club, api, admin_token):
    r = client.post(f"/api/admin/clubs/{club['club_id']}/approve", headers=api.h(admin_token))
    assert r.status_code == 409


def test_new_club_is_seeded_with_reference_data(client, club):
    base = f"/api/club/{club['club_id']}"
    assert len(client.get(f"{base}/swim-styles", headers=club["h"]).json()) == 5
    assert len(client.get(f"{base}/distance-events", headers=club["h"]).json()) == 7
