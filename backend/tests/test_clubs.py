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


# ── super admin creates a club directly ──────────────────────────────────

def _create(client, admin_token, api, phone, name="Admin Made"):
    return client.post("/api/admin/clubs", headers=api.h(admin_token),
                       json={"name": name, "head_coach_name": "Made Head", "head_coach_phone": phone})


def test_admin_can_create_an_approved_club_and_head_coach_can_log_in(client, api, admin_token):
    phone = new_phone()
    r = _create(client, admin_token, api, phone)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "approved" and body["head_coach_phone"] == phone

    token, user = api.login(phone)  # works immediately, no approval step
    assert user["role"] == "head_coach" and user["club_id"] == body["id"] and user["club_name"] == "Admin Made"

    base = f"/api/club/{body['id']}"
    assert len(client.get(f"{base}/swim-styles", headers=api.h(token)).json()) == 5
    coaches = client.get(f"{base}/coaches", headers=api.h(token)).json()
    assert [c["role"] for c in coaches] == ["head_coach"]
    detail = client.get(f"/api/admin/clubs/{body['id']}", headers=api.h(admin_token)).json()
    assert [u["role"] for u in detail["users"]] == ["head_coach"]


def test_created_club_appears_in_the_approved_list(client, api, admin_token):
    cid = _create(client, admin_token, api, new_phone(), "Listed Club").json()["id"]
    approved = client.get("/api/admin/clubs", params={"status": "approved"}, headers=api.h(admin_token)).json()
    assert any(c["id"] == cid for c in approved)


def test_admin_create_rejects_a_phone_already_in_use(client, api, admin_token, club):
    assert _create(client, admin_token, api, club["phone"]).status_code == 409
    pending = new_phone()
    client.post("/api/register-club", json={"name": "Pending Dup", "head_coach_name": "P", "head_coach_phone": pending})
    assert _create(client, admin_token, api, pending).status_code == 409
    assert _create(client, admin_token, api, "9999999999").status_code == 409  # the super admin's own phone


def test_admin_create_validates_input(client, api, admin_token):
    r = client.post("/api/admin/clubs", headers=api.h(admin_token),
                    json={"name": "", "head_coach_name": "X", "head_coach_phone": "123"})
    assert r.status_code == 422


def test_only_super_admin_can_create_a_club(client, club, api):
    body = {"name": "Nope", "head_coach_name": "N", "head_coach_phone": new_phone()}
    assert client.post("/api/admin/clubs", json=body, headers=club["h"]).status_code == 403
    assert client.post("/api/admin/clubs", json=body).status_code == 401
