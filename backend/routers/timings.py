from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from db.club_models import PersonalBest, Session, Timing
from middleware.auth import get_current_coach, require_coach
from routers.deps import club_db
from schemas.timing import TimingCreate, TimingUpdate
from services.timing_service import record_timing

router = APIRouter(dependencies=[Depends(require_coach)])


def _timing_out(t: Timing) -> dict:
    return {
        "id": t.id,
        "session_id": t.session_id,
        "session_date": t.session.session_date.isoformat() if t.session else None,
        "session_type": t.session.session_type if t.session else None,
        "student_id": t.student_id,
        "student_name": t.student.name if t.student else "",
        "swim_style_id": t.swim_style_id,
        "style": t.swim_style.name if t.swim_style else "",
        "style_short": t.swim_style.short_code if t.swim_style else "",
        "distance_event_id": t.distance_event_id,
        "distance": t.distance_event.label if t.distance_event else "",
        "time_seconds": t.time_seconds,
        "notes": t.notes,
    }


@router.post("", status_code=201)
def create_timing(body: TimingCreate, db: DBSession = Depends(club_db), user: dict = Depends(require_coach)):
    if db.get(Session, body.session_id) is None:
        raise HTTPException(status_code=404, detail="Session not found")
    coach = get_current_coach(db, user)
    timing, is_new_pb, improvement = record_timing(db, body, coach.id)
    out = _timing_out(timing)
    out["is_new_pb"] = is_new_pb
    out["improvement"] = improvement
    return out


@router.get("")
def list_timings(
    student_id: str | None = None,
    style_id: str | None = None,
    distance_id: str | None = None,
    db: DBSession = Depends(club_db),
):
    q = db.query(Timing).join(Session, Timing.session_id == Session.id)
    if student_id:
        q = q.filter(Timing.student_id == student_id)
    if style_id:
        q = q.filter(Timing.swim_style_id == style_id)
    if distance_id:
        q = q.filter(Timing.distance_event_id == distance_id)
    timings = q.order_by(Session.session_date.desc()).all()

    pb_timing_ids = {
        pb.timing_id for pb in db.query(PersonalBest).all() if pb.timing_id
    }
    out = []
    for t in timings:
        row = _timing_out(t)
        row["is_pb"] = t.id in pb_timing_ids
        out.append(row)
    return out


@router.get("/session/{session_id}")
def session_timings(session_id: str, db: DBSession = Depends(club_db)):
    timings = db.query(Timing).filter_by(session_id=session_id).all()
    return [_timing_out(t) for t in timings]


@router.put("/{timing_id}")
def update_timing(timing_id: str, body: TimingUpdate, db: DBSession = Depends(club_db)):
    t = db.get(Timing, timing_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Timing not found")
    if body.time_seconds is not None:
        t.time_seconds = body.time_seconds
    if body.notes is not None:
        t.notes = body.notes
    db.commit()
    return _timing_out(t)


@router.delete("/{timing_id}")
def delete_timing(timing_id: str, db: DBSession = Depends(club_db)):
    t = db.get(Timing, timing_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Timing not found")
    db.delete(t)
    db.commit()
    return {"message": "Timing deleted"}
