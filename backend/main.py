import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from logging_config import classify_exception, classify_http, get_logger, log_event, request_id_var, setup_logging
from db.control_models import ControlBase, User
from db.engine import ControlSessionLocal, control_engine
from routers import admin, auth, coaches, progress, reference, sessions, students, timings

setup_logging(settings.LOG_LEVEL)
log = get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ControlBase.metadata.create_all(bind=control_engine)
    db = ControlSessionLocal()
    try:
        if not db.query(User).filter_by(phone=settings.SUPER_ADMIN_PHONE).first():
            db.add(User(
                phone=settings.SUPER_ADMIN_PHONE,
                name=settings.SUPER_ADMIN_NAME,
                role="super_admin",
                club_id=None,
            ))
            db.commit()
    finally:
        db.close()
    log_event(log, logging.INFO, "startup", environment=settings.ENVIRONMENT, data_dir=settings.DATA_DIR,
              sms="msg91" if (settings.MSG91_AUTH_KEY and settings.MSG91_OTP_TEMPLATE_ID) else "disabled",
              jwt_expiry_days=settings.JWT_EXPIRY_DAYS, cors_origins=len(settings.CORS_ORIGINS))
    yield


_dev = settings.ENVIRONMENT == "dev"
app = FastAPI(
    title="SwimAcademy API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _dev else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _dev else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or (["*"] if settings.ENVIRONMENT == "dev" else []),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SKIP_REQUEST_LOG = ("/assets/",)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    """Assign a request id and log exactly one `event=request` line per request."""
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    token = request_id_var.set(rid)
    request.state.user_id = request.state.club_id = None
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:  # anything the route handlers did not turn into a response
        code, hint = classify_exception(exc)
        log_event(log, logging.ERROR, "unhandled_exception", method=request.method, path=request.url.path,
                  error_code=code, exc_type=type(exc).__name__, error=str(exc), hint=hint, exc_info=exc)
        response = JSONResponse({"detail": "Internal server error", "request_id": rid}, status_code=500)
    duration_ms = round((time.perf_counter() - start) * 1000)
    is_healthcheck = request.url.path == "/" and request.client is not None and request.client.host == "127.0.0.1"
    if not is_healthcheck and not request.url.path.startswith(SKIP_REQUEST_LOG):
        status = response.status_code
        level = logging.ERROR if status >= 500 else logging.WARNING if status >= 400 else logging.INFO
        log_event(log, level, "request", method=request.method, path=request.url.path, status=status,
                  duration_ms=duration_ms, user_id=request.state.user_id, club_id=request.state.club_id)
    response.headers["X-Request-ID"] = rid
    request_id_var.reset(token)
    return response


@app.exception_handler(StarletteHTTPException)
async def log_http_exception(request: Request, exc: StarletteHTTPException):
    code, hint = classify_http(exc.status_code)
    level = logging.ERROR if exc.status_code >= 500 else logging.WARNING
    log_event(log, level, "http_error", method=request.method, path=request.url.path, status=exc.status_code,
              error_code=code, detail=exc.detail, hint=hint)
    return await http_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def log_validation_error(request: Request, exc: RequestValidationError):
    code, hint = classify_http(422)
    fields = ",".join(".".join(str(p) for p in e["loc"]) + ":" + e["type"] for e in exc.errors())
    log_event(log, logging.WARNING, "validation_error", method=request.method, path=request.url.path,
              status=422, error_code=code, errors=fields, hint=hint)
    return await request_validation_exception_handler(request, exc)


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(auth.register_router, prefix="/api", tags=["Registration"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(coaches.router, prefix="/api/club/{club_id}/coaches", tags=["Coaches"])
app.include_router(students.router, prefix="/api/club/{club_id}/students", tags=["Students"])
app.include_router(progress.router, prefix="/api/club/{club_id}/students", tags=["Progress"])
app.include_router(sessions.router, prefix="/api/club/{club_id}/sessions", tags=["Sessions"])
app.include_router(timings.router, prefix="/api/club/{club_id}/timings", tags=["Timings"])
app.include_router(reference.router, prefix="/api/club/{club_id}", tags=["Reference"])

# ── Serve built React app (production / Docker) ─────
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # index.html, sw.js and the manifest must always be revalidated so a deploy reaches
    # installed PWAs; /assets files are content-hashed and safe to cache for a year.
    NO_CACHE = {"Cache-Control": "no-cache"}

    @app.middleware("http")
    async def asset_cache_headers(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        file = STATIC_DIR / full_path
        if full_path and file.is_file():
            return FileResponse(file, headers=NO_CACHE)
        return FileResponse(STATIC_DIR / "index.html", headers=NO_CACHE)
