from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import settings

DATA_DIR = Path(settings.DATA_DIR)
CLUBS_DIR = DATA_DIR / "clubs"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Control DB ──────────────────────────────────────
CONTROL_DB_URL = f"sqlite:///{DATA_DIR}/control.db"

control_engine = create_engine(
    CONTROL_DB_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

ControlSessionLocal = sessionmaker(bind=control_engine, autocommit=False, autoflush=False)


def get_control_db():
    """FastAPI dependency for control DB sessions."""
    db = ControlSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Club DB (per-tenant) ───────────────────────────
@lru_cache(maxsize=50)
def get_club_engine(club_id: str):
    """Returns (or creates + caches) an engine for a specific club DB."""
    CLUBS_DIR.mkdir(parents=True, exist_ok=True)
    db_path = CLUBS_DIR / f"club_{club_id}.db"
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )


def get_club_session_factory(club_id: str) -> sessionmaker:
    return sessionmaker(bind=get_club_engine(club_id), autocommit=False, autoflush=False)


def get_club_db(club_id: str):
    """FastAPI dependency for club DB sessions. club_id comes from the URL path."""
    db = get_club_session_factory(club_id)()
    try:
        yield db
    finally:
        db.close()


def create_club_database(club_id: str):
    """Called when super admin approves a club. Creates file + all tables + seed data."""
    from .club_models import ClubBase

    engine = get_club_engine(club_id)
    ClubBase.metadata.create_all(bind=engine)
    _seed_swim_styles(engine)
    _seed_distance_events(engine)


def delete_club_database(club_id: str):
    """Called when super admin deletes a club. Disposes engine + removes the file."""
    engine = get_club_engine(club_id)
    engine.dispose()
    get_club_engine.cache_clear()
    db_path = CLUBS_DIR / f"club_{club_id}.db"
    if db_path.exists():
        db_path.unlink()


def _seed_swim_styles(engine):
    from .club_models import SwimStyle

    db = sessionmaker(bind=engine)()
    if db.query(SwimStyle).count() == 0:
        db.add_all([
            SwimStyle(name="Freestyle", short_code="FR", sort_order=1),
            SwimStyle(name="Backstroke", short_code="BK", sort_order=2),
            SwimStyle(name="Breaststroke", short_code="BR", sort_order=3),
            SwimStyle(name="Butterfly", short_code="BF", sort_order=4),
            SwimStyle(name="Individual Medley", short_code="IM", sort_order=5),
        ])
        db.commit()
    db.close()


def _seed_distance_events(engine):
    from .club_models import DistanceEvent

    db = sessionmaker(bind=engine)()
    if db.query(DistanceEvent).count() == 0:
        db.add_all([
            DistanceEvent(distance_meters=25, label="25m", sort_order=1),
            DistanceEvent(distance_meters=50, label="50m", sort_order=2),
            DistanceEvent(distance_meters=100, label="100m", sort_order=3),
            DistanceEvent(distance_meters=200, label="200m", sort_order=4),
            DistanceEvent(distance_meters=400, label="400m", sort_order=5),
            DistanceEvent(distance_meters=800, label="800m", sort_order=6),
            DistanceEvent(distance_meters=1500, label="1500m", sort_order=7),
        ])
        db.commit()
    db.close()
