from datetime import datetime

from sqlalchemy.orm import Session

from db.club_models import PersonalBest, Timing


def record_timing(db: Session, data, coach_id: str) -> tuple[Timing, bool, float | None]:
    """Insert a timing and auto-maintain the personal best.

    Returns (timing, is_new_pb, improvement_seconds).
    """
    timing = Timing(
        session_id=data.session_id,
        student_id=data.student_id,
        swim_style_id=data.swim_style_id,
        distance_event_id=data.distance_event_id,
        time_seconds=data.time_seconds,
        notes=data.notes,
        recorded_by=coach_id,
    )
    db.add(timing)
    db.flush()

    pb = db.query(PersonalBest).filter_by(
        student_id=timing.student_id,
        swim_style_id=timing.swim_style_id,
        distance_event_id=timing.distance_event_id,
    ).first()

    is_new_pb = False
    improvement = None

    if pb is None:
        db.add(PersonalBest(
            student_id=timing.student_id,
            swim_style_id=timing.swim_style_id,
            distance_event_id=timing.distance_event_id,
            best_time_seconds=timing.time_seconds,
            achieved_at=datetime.utcnow(),
            timing_id=timing.id,
            previous_best=None,
        ))
        is_new_pb = True
    elif timing.time_seconds < pb.best_time_seconds:
        improvement = round(pb.best_time_seconds - timing.time_seconds, 2)
        pb.previous_best = pb.best_time_seconds
        pb.best_time_seconds = timing.time_seconds
        pb.achieved_at = datetime.utcnow()
        pb.timing_id = timing.id
        is_new_pb = True

    db.commit()
    db.refresh(timing)
    return timing, is_new_pb, improvement


def recompute_personal_best(db: Session, student_id: str, swim_style_id: str, distance_event_id: str) -> None:
    """Rebuild one PB row from the remaining timings (call after a timing is edited or removed).

    Replays the same rule as record_timing: the first timing sets the PB and a strictly faster
    later timing replaces it, remembering the previous best. Does not commit.
    """
    timings = (
        db.query(Timing)
        .filter_by(student_id=student_id, swim_style_id=swim_style_id, distance_event_id=distance_event_id)
        .order_by(Timing.created_at.asc(), Timing.id.asc())
        .all()
    )
    pb = db.query(PersonalBest).filter_by(
        student_id=student_id, swim_style_id=swim_style_id, distance_event_id=distance_event_id,
    ).first()

    if not timings:
        if pb is not None:
            db.delete(pb)
        return

    best, previous = None, None
    for t in timings:
        if best is None:
            best = t
        elif t.time_seconds < best.time_seconds:
            previous, best = best.time_seconds, t

    if pb is None:
        pb = PersonalBest(student_id=student_id, swim_style_id=swim_style_id, distance_event_id=distance_event_id,
                          best_time_seconds=best.time_seconds, achieved_at=best.created_at)
        db.add(pb)
    pb.best_time_seconds = best.time_seconds
    pb.previous_best = previous
    pb.timing_id = best.id
    pb.achieved_at = best.created_at
