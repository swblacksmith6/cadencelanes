from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession

from db.club_models import Attendance, Session, Student


def create_session_with_attendance(db: DBSession, data, coach_id: str) -> Session:
    exists = db.query(Session).filter_by(session_date=data.session_date, session_type=data.session_type).first()
    if exists:
        raise HTTPException(status_code=409, detail=f"A {data.session_type} session already exists for {data.session_date}")

    session = Session(
        session_date=data.session_date,
        session_type=data.session_type,
        notes=data.notes,
        created_by=coach_id,
    )
    db.add(session)
    db.flush()

    active_students = db.query(Student).filter_by(is_active=True).all()
    for student in active_students:
        db.add(Attendance(session_id=session.id, student_id=student.id, status="present"))

    db.commit()
    db.refresh(session)
    return session
