import logging

from fastapi import APIRouter
from sqlalchemy.exc import OperationalError

from logging_config import LogfmtFormatter, classify_exception, classify_http, log_event, request_id_var
from main import app


def _events(caplog, name):
    return [r for r in caplog.records if getattr(r, "event", None) == name]


def test_every_request_logs_one_structured_line_with_request_id(client, club, caplog):
    caplog.set_level(logging.INFO)
    r = client.get(f"/api/club/{club['club_id']}/students", headers={**club["h"], "X-Request-ID": "trace-abc"})
    assert r.headers["X-Request-ID"] == "trace-abc"
    lines = _events(caplog, "request")
    assert len(lines) == 1
    f = lines[0].fields
    assert (f["method"], f["status"], f["club_id"]) == ("GET", 200, club["club_id"])
    assert f["user_id"] == club["user"]["id"] and f["duration_ms"] >= 0


def test_request_id_is_generated_when_absent(client):
    assert len(client.get("/api/admin/clubs").headers["X-Request-ID"]) >= 8


def test_http_errors_carry_code_and_hint(client, club, caplog):
    caplog.set_level(logging.INFO)
    client.get(f"/api/club/{club['club_id']}/students/nope", headers=club["h"])
    err = _events(caplog, "http_error")[0]
    assert err.fields["status"] == 404 and err.fields["error_code"] == "NOT_FOUND" and err.fields["hint"]
    assert err.levelno == logging.WARNING


def test_validation_errors_list_fields(client, club, caplog):
    caplog.set_level(logging.INFO)
    client.post(f"/api/club/{club['club_id']}/students", json={"name": ""}, headers=club["h"])
    err = _events(caplog, "validation_error")[0]
    assert err.fields["error_code"] == "VALIDATION_FAILED" and "body.name" in err.fields["errors"]


def test_unhandled_exception_returns_500_with_request_id_and_logs_hint(client, caplog):
    boom = APIRouter()

    @boom.get("/api/_test/boom")
    def _boom():
        raise OperationalError("select", {}, Exception("database is locked"))

    app.include_router(boom)
    caplog.set_level(logging.INFO)
    r = client.get("/api/_test/boom", headers={"X-Request-ID": "rid-500"})
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error", "request_id": "rid-500"}
    ev = _events(caplog, "unhandled_exception")[0]
    assert ev.fields["error_code"] == "DB_LOCKED" and ev.fields["hint"] and ev.exc_info
    assert _events(caplog, "request")[-1].levelno == logging.ERROR


def test_sensitive_values_never_logged(client, api, admin_token, caplog):
    caplog.set_level(logging.DEBUG)
    api.login("9999999999")
    text = " ".join(LogfmtFormatter().format(r) for r in caplog.records)
    assert "Bearer" not in text and "access_token" not in text


def test_formatter_is_logfmt_and_quotes_values():
    token = request_id_var.set("rid-1")
    try:
        rec = logging.LogRecord("app.test", logging.WARNING, __file__, 1, "x", None, None)
        rec.event, rec.fields = "demo_event", {"detail": "has spaces", "n": 3, "none": None}
        line = LogfmtFormatter().format(rec)
    finally:
        request_id_var.reset(token)
    assert "level=WARNING logger=app.test request_id=rid-1 event=demo_event" in line
    assert 'detail="has spaces" n=3 none=-' in line


def test_classifiers():
    assert classify_http(401)[0] == "AUTH_REQUIRED"
    assert classify_http(503)[0] == "SERVER_ERROR"
    assert classify_exception(OperationalError("s", {}, Exception("no such column: x")))[0] == "DB_SCHEMA_MISMATCH"
    assert classify_exception(PermissionError())[0] == "FILE_PERMISSION"
    assert classify_exception(ValueError())[0] == "UNHANDLED_EXCEPTION"
