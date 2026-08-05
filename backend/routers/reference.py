from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.club_models import DistanceEvent, SwimStyle
from middleware.auth import require_coach
from routers.deps import club_db

router = APIRouter(dependencies=[Depends(require_coach)])


@router.get("/swim-styles")
def swim_styles(db: Session = Depends(club_db)):
    rows = db.query(SwimStyle).filter_by(is_active=True).order_by(SwimStyle.sort_order.asc()).all()
    return [{"id": s.id, "name": s.name, "short_code": s.short_code} for s in rows]


@router.get("/distance-events")
def distance_events(db: Session = Depends(club_db)):
    rows = db.query(DistanceEvent).filter_by(is_active=True).order_by(DistanceEvent.sort_order.asc()).all()
    return [{"id": d.id, "distance_meters": d.distance_meters, "label": d.label} for d in rows]
