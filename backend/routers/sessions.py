from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from db.club_models import Attendance, Session, Timing
from middleware.auth import get_current_coach, require_coach, require_head_coach
from routers.deps import club_db
from schemas.attendance import AttendanceUpdate
from schemas.session import SessionCreate
from services.session_service import create_session_with_attendance
from services.timing_service import recompute_personal_best

router = APIRouter()


def _session_out(s: Session, with_attendance: bool = False) -> dict:
    present = sum(1 for a in s.attendance if a.status == "present")
    out = {
        "id": s.id,
        "session_date": s.session_date.isoformat(),
        "session_type": s.session_type,
        "notes": s.notes,
        "created_by_name": s.creator.name if s.creator else "",
        "total_count": len(s.attendance),
        "present_count": present,
        "absent_count": len(s.attendance) - present,
    }
    if with_attendance:
        out["attendance"] = _attendance_out(s)
    return out


def _attendance_out(s: Session) -> list[dict]:
    rows = sorted(s.attendance, key=lambda a: (a.student.name if a.student else ""))
    return [
        {
            "student_id": a.student_id,
            "student_name": a.student.name if a.student else "",
            "date_of_birth": a.student.date_of_birth.isoformat() if a.student else None,
            "status": a.status,
        }
        for a in rows
    ]


def _get_session(db: DBSession, session_id: str) -> Session:
    s = db.get(Session, session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


@router.get("", dependencies=[Depends(require_coach)])
def list_sessions(
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    db: DBSession = Depends(club_db),
):
    if from_ is None and to is None:
        from_ = date.today() - timedelta(days=30)
    q = db.query(Session)
    if from_:
        q = q.filter(Session.session_date >= from_)
    if to:
        q = q.filter(Session.session_date <= to)
    sessions = q.order_by(Session.session_date.desc(), Session.session_type.asc()).all()
    return [_session_out(s) for s in sessions]


@router.get("/{session_id}", dependencies=[Depends(require_coach)])
def get_session(session_id: str, db: DBSession = Depends(club_db)):
    return _session_out(_get_session(db, session_id), with_attendance=True)


@router.post("", status_code=201)
def create_session(body: SessionCreate, db: DBSession = Depends(club_db), user: dict = Depends(require_coach)):
    coach = get_current_coach(db, user)
    session = create_session_with_attendance(db, body, coach.id)
    return _session_out(session, with_attendance=True)


@router.delete("/{session_id}", dependencies=[Depends(require_head_coach)])
def delete_session(session_id: str, db: DBSession = Depends(club_db)):
    s = _get_session(db, session_id)
    keys = {(t.student_id, t.swim_style_id, t.distance_event_id) for t in db.query(Timing).filter_by(session_id=session_id)}
    db.delete(s)  # cascades to attendance + timings
    db.flush()
    for key in keys:  # personal bests may have come from this session's timings
        recompute_personal_best(db, *key)
    db.commit()
    return {"message": "Session deleted"}


# ── Attendance ──────────────────────────────────────

@router.get("/{session_id}/attendance", dependencies=[Depends(require_coach)])
def get_attendance(session_id: str, db: DBSession = Depends(club_db)):
    return _attendance_out(_get_session(db, session_id))


@router.put("/{session_id}/attendance")
def update_attendance(
    session_id: str, body: AttendanceUpdate, db: DBSession = Depends(club_db), user: dict = Depends(require_coach)
):
    _get_session(db, session_id)
    coach = get_current_coach(db, user)
    updated = 0
    for item in body.updates:
        row = db.query(Attendance).filter_by(session_id=session_id, student_id=item.student_id).first()
        if row and row.status != item.status:
            row.status = item.status
            row.marked_by = coach.id
            row.marked_at = datetime.utcnow()
            updated += 1
    db.commit()
    return {"message": "Attendance updated", "updated_count": updated}
