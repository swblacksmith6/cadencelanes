"""Uniform, grep-friendly logging.

Every line is logfmt:  <utc ts> level=.. logger=.. request_id=.. event=.. key=value ...

* One `event=request` line per HTTP request (method, path, status, duration_ms, user_id, club_id).
* Every failure carries `error_code` and `hint` (what it means and how to fix it).
* Follow one request end to end with:  grep request_id=<id>   (also returned as X-Request-ID).
* Errors only:  grep -E 'level=(WARNING|ERROR)'     Server errors:  grep 'level=ERROR'
"""
import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError, OperationalError

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# event names used by the app (keep them stable: people grep for them)
APP_LOGGER = "app"


def _fmt(value) -> str:
    if value is None:
        return "-"
    s = str(value)
    if s == "" or any(c in s for c in ' ="\n\t'):
        return json.dumps(s)
    return s


class LogfmtFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        parts = [ts, f"level={record.levelname}", f"logger={record.name}", f"request_id={request_id_var.get()}"]
        event = getattr(record, "event", None)
        if event:
            parts.append(f"event={event}")
            for k, v in getattr(record, "fields", {}).items():
                parts.append(f"{k}={_fmt(v)}")
        else:  # third-party / uvicorn lines
            parts.append(f"event=log msg={_fmt(record.getMessage())}")
        line = " ".join(parts)
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line


def get_logger(name: str = APP_LOGGER) -> logging.Logger:
    return logging.getLogger(name)


def log_event(logger: logging.Logger, level: int, event: str, **fields) -> None:
    """Log one structured event. Pass error_code= and hint= for anything that is a problem."""
    exc_info = fields.pop("exc_info", None)
    logger.log(level, event, extra={"event": event, "fields": fields}, exc_info=exc_info)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(LogfmtFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # uvicorn installs its own handlers; route everything through ours and drop its access log
    # (the request middleware logs one structured line per request instead).
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
        lg.setLevel(level.upper())
    logging.getLogger("uvicorn.access").disabled = True
    for noisy in ("watchfiles", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ── error classification: code + how to fix ────────────────────────────────────
HTTP_HINTS = {
    401: ("AUTH_REQUIRED", "Token missing, expired, invalid or user deactivated. Client should log in again; check JWT_SECRET did not change."),
    403: ("FORBIDDEN", "Role or club does not match this route. Check the user's role and that club_id in the URL is their club."),
    404: ("NOT_FOUND", "Resource id or phone does not exist. Check the id in the URL and that the record is active."),
    409: ("CONFLICT", "Duplicate record (phone, session or similar). Fetch the existing record instead of creating it again."),
    422: ("VALIDATION_FAILED", "Request body or params failed validation. See `errors` for the fields."),
    429: ("RATE_LIMITED", "Too many OTP requests for this phone. Wait an hour or raise OTP_MAX_REQUESTS_PER_HOUR."),
    502: ("UPSTREAM_FAILED", "A downstream service failed. For SMS see the sms_send_failed event with the same request_id."),
}


def classify_http(status: int) -> tuple[str, str]:
    if status in HTTP_HINTS:
        return HTTP_HINTS[status]
    if status >= 500:
        return "SERVER_ERROR", "Unexpected server error. Search this request_id for the traceback."
    return "BAD_REQUEST", "Request was rejected. See detail."


def classify_exception(exc: BaseException) -> tuple[str, str]:
    msg = str(exc).lower()
    if isinstance(exc, OperationalError):
        if "database is locked" in msg:
            return "DB_LOCKED", "A write held the SQLite lock for over 15s. Look for slow requests (duration_ms) just before this one; avoid long transactions."
        if "no such table" in msg or "no such column" in msg:
            return "DB_SCHEMA_MISMATCH", "The database file is older than the models. There are no migrations: ALTER TABLE to add the column, or recreate the DB (dev only)."
        if "unable to open database" in msg or "readonly" in msg:
            return "DB_FILE_ACCESS", "Cannot open or write the DB file. Check DATA_DIR exists, the volume is mounted and writable by uid 10001."
        return "DB_ERROR", "Database operation failed. See the traceback."
    if isinstance(exc, IntegrityError):
        return "DB_INTEGRITY", "A unique or foreign-key constraint was violated. The caller should check for an existing record first."
    if isinstance(exc, PermissionError):
        return "FILE_PERMISSION", "Permission denied. In Docker the app runs as uid 10001; check ownership of the /data volume."
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return "NETWORK_ERROR", "A network call failed or timed out. Check outbound connectivity and the provider status."
    return "UNHANDLED_EXCEPTION", "Unexpected bug. Use this request_id to find the traceback and reproduce."
