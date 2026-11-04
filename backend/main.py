from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from db.control_models import ControlBase, User
from db.engine import ControlSessionLocal, control_engine
from routers import admin, auth, coaches, progress, reference, sessions, students, timings


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
