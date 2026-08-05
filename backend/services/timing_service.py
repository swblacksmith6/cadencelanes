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
