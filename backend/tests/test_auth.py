import base64
import json
import time

from conftest import STUDENT, new_phone
from config import settings
from services import sms_service


def _exp_days(token: str) -> float:
    payload = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    return (payload["exp"] - time.time()) / 86400


def test_unknown_phone_is_404(client):
    assert client.post("/api/auth/request-otp", json={"phone": "9000000001"}).status_code == 404


def test_login_returns_token_valid_for_30_days(api, club):
    assert 29.9 < _exp_days(club["token"]) <= 30.0
    assert club["user"]["role"] == "head_coach"
    assert club["user"]["club_id"] == club["club_id"]


def test_wrong_otp_is_rejected(client, club):
    client.post("/api/auth/request-otp", json={"phone": club["phone"]})
    r = client.post("/api/auth/verify-otp", json={"phone": club["phone"], "code": "000000"})
    assert r.status_code in (401, 403)


def test_otp_attempts_are_capped(client, api, admin_token):
    from conftest import make_club
    c = make_club(api, admin_token, "Attempts Academy")
    otp = client.post("/api/auth/request-otp", json={"phone": c["phone"]}).json()["otp"]
    wrong = "111111" if otp != "111111" else "222222"
    for _ in range(settings.OTP_MAX_ATTEMPTS):
        client.post("/api/auth/verify-otp", json={"phone": c["phone"], "code": wrong})
    # even the correct code is refused once attempts are used up
    assert client.post("/api/auth/verify-otp", json={"phone": c["phone"], "code": otp}).status_code == 401


def test_otp_request_is_rate_limited(client, api, admin_token):
    from conftest import make_club
    c = make_club(api, admin_token, "Rate Academy")  # make_club already used 1 request
    codes = [client.post("/api/auth/request-otp", json={"phone": c["phone"]}).status_code
             for _ in range(settings.OTP_MAX_REQUESTS_PER_HOUR)]
    assert 429 in codes


def test_otp_not_returned_when_flag_off(client, club, monkeypatch):
    monkeypatch.setattr(settings, "OTP_IN_RESPONSE", False)
    from conftest import make_club
    # use a fresh coach so the rate limit is not hit
    r = client.post("/api/auth/request-otp", json={"phone": "9999999999"})
    assert r.status_code == 200
    assert "otp" not in r.json()


def test_missing_and_bad_token(client, club):
    base = f"/api/club/{club['club_id']}/students"
    assert client.get(base).status_code == 401
    assert client.get(base, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_deactivated_coach_loses_access_immediately(client, api, club):
    base = f"/api/club/{club['club_id']}"
    phone = new_phone()
    r = client.post(f"{base}/coaches", json={"name": "Temp Coach", "phone": phone}, headers=club["h"])
    assert r.status_code == 201, r.text
    coach_id = r.json()["id"]
    token, _ = api.login(phone)
    assert client.get(f"{base}/students", headers=api.h(token)).status_code == 200
    assert client.delete(f"{base}/coaches/{coach_id}", headers=club["h"]).status_code == 200
    assert client.get(f"{base}/students", headers=api.h(token)).status_code == 401


def test_new_login_ends_the_older_session(client, api, admin_token):
    from conftest import make_club
    c = make_club(api, admin_token, "Single Session Academy")
    base = f"/api/club/{c['club_id']}/students"
    assert client.get(base, headers=c["h"]).status_code == 200

    r = client.post("/api/auth/request-otp", json={"phone": c["phone"]})
    r = client.post("/api/auth/verify-otp", json={"phone": c["phone"], "code": r.json()["otp"]})
    assert r.status_code == 200
    assert r.json()["other_sessions_ended"] is True
    new_h = api.h(r.json()["access_token"])

    old = client.get(base, headers=c["h"])
    assert old.status_code == 401
    assert old.json()["detail"] == "SESSION_REPLACED"
    assert client.get(base, headers=new_h).status_code == 200


def test_first_login_reports_no_other_session(client, api, admin_token):
    from conftest import make_club
    phone = new_phone()
    r = client.post("/api/register-club", json={"name": "Fresh", "head_coach_name": "H", "head_coach_phone": phone})
    client.post(f"/api/admin/clubs/{r.json()['club_id']}/approve", headers=api.h(admin_token))
    r = client.post("/api/auth/request-otp", json={"phone": phone})
    r = client.post("/api/auth/verify-otp", json={"phone": phone, "code": r.json()["otp"]})
    assert r.json()["other_sessions_ended"] is False


def test_token_without_session_id_is_rejected(client, club):
    from jose import jwt
    legacy = jwt.encode(
        {"user_id": club["user"]["id"], "role": "head_coach", "club_id": club["club_id"],
         "exp": int(time.time()) + 600},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    r = client.get(f"/api/club/{club['club_id']}/students", headers={"Authorization": f"Bearer {legacy}"})
    assert r.status_code == 401
    assert r.json()["detail"] != "SESSION_REPLACED"


class _FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return json.dumps(self._body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _enable_sms(monkeypatch):
    monkeypatch.setattr(settings, "MSG91_AUTH_KEY", "test-key")
    monkeypatch.setattr(settings, "MSG91_OTP_TEMPLATE_ID", "tmpl123")
    monkeypatch.setattr(settings, "OTP_IN_RESPONSE", False)


def test_sms_payload_uses_template_variables(client, api, admin_token, monkeypatch):
    from conftest import make_club
    c = make_club(api, admin_token, "Sms Academy")
    _enable_sms(monkeypatch)
    sent = {}

    def fake_urlopen(req, timeout=None):
        sent["url"] = req.full_url
        sent["headers"] = {k.lower(): v for k, v in req.header_items()}
        sent["body"] = json.loads(req.data)
        return _FakeResponse({"type": "success", "message": "abc"})

    monkeypatch.setattr(sms_service.urllib.request, "urlopen", fake_urlopen)
    r = client.post("/api/auth/request-otp", json={"phone": c["phone"]})
    assert r.status_code == 200 and "otp" not in r.json()
    assert sent["url"] == "https://control.msg91.com/api/v5/flow"
    assert sent["headers"]["authkey"] == "test-key"
    body = sent["body"]
    assert body["template_id"] == "tmpl123"
    rec = body["recipients"][0]
    assert rec["mobiles"] == "91" + c["phone"]
    assert set(rec) == {"mobiles", "code", "name", "min"}
    assert len(rec["code"]) == settings.OTP_LENGTH
    assert rec["min"] == str(settings.OTP_EXPIRY_MINUTES)


def test_sms_provider_error_returns_502(client, api, admin_token, monkeypatch):
    from conftest import make_club
    c = make_club(api, admin_token, "Sms Fail Academy")
    _enable_sms(monkeypatch)
    monkeypatch.setattr(sms_service.urllib.request, "urlopen",
                        lambda req, timeout=None: _FakeResponse({"type": "error", "message": "bad template"}))
    r = client.post("/api/auth/request-otp", json={"phone": c["phone"]})
    assert r.status_code == 502
    assert "otp" not in r.text
