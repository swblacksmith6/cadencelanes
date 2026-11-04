"""Backend test setup: an isolated temp DATA_DIR and dev-mode settings, set before the app imports."""
import itertools
import os
import sys
import tempfile
from pathlib import Path

_TMP = tempfile.mkdtemp(prefix="cadence-tests-")
os.environ.update({
    "DATA_DIR": _TMP,
    "ENVIRONMENT": "dev",
    "OTP_IN_RESPONSE": "true",
    "MSG91_AUTH_KEY": "",
    "MSG91_OTP_TEMPLATE_ID": "",
    "SUPER_ADMIN_PHONE": "9999999999",
    "LOG_LEVEL": "INFO",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

_phones = itertools.count(9700000000)


def new_phone() -> str:
    return str(next(_phones))


class Api:
    """Thin helper around TestClient so tests read like the user flow."""

    def __init__(self, client: TestClient):
        self.c = client

    def login(self, phone: str) -> tuple[str, dict]:
        r = self.c.post("/api/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200, r.text
        r = self.c.post("/api/auth/verify-otp", json={"phone": phone, "code": r.json()["otp"]})
        assert r.status_code == 200, r.text
        return r.json()["access_token"], r.json()["user"]

    @staticmethod
    def h(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def api(client):
    return Api(client)


@pytest.fixture(scope="session")
def admin_token(api):
    return api.login("9999999999")[0]


def make_club(api: Api, admin_token: str, name: str = "Test Academy") -> dict:
    """Register + approve a club and return its head coach login."""
    phone = new_phone()
    r = api.c.post("/api/register-club", json={"name": name, "head_coach_name": "Head Coach", "head_coach_phone": phone})
    assert r.status_code == 201, r.text
    club_id = r.json()["club_id"]
    r = api.c.post(f"/api/admin/clubs/{club_id}/approve", headers=api.h(admin_token))
    assert r.status_code == 200, r.text
    token, user = api.login(phone)
    return {"club_id": club_id, "phone": phone, "token": token, "user": user, "h": api.h(token)}


@pytest.fixture(scope="session")
def club(api, admin_token):
    return make_club(api, admin_token)


@pytest.fixture(scope="session")
def other_club(api, admin_token):
    return make_club(api, admin_token, "Other Academy")


@pytest.fixture(scope="session")
def reference(api, club):
    base = f"/api/club/{club['club_id']}"
    styles = api.c.get(f"{base}/swim-styles", headers=club["h"]).json()
    dists = api.c.get(f"{base}/distance-events", headers=club["h"]).json()
    return {"style": styles[0]["id"], "dist": dists[0]["id"]}


STUDENT = {
    "name": "Test Swimmer",
    "date_of_birth": "2015-03-01",
    "parent_contacts": [{"relation": "mother", "phone": "9811111111", "is_primary": True}],
}
