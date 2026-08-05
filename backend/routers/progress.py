from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.club_models import Student
from middleware.auth import require_coach
from routers.deps import club_db
from services.progress_service import build_progress_report

router = APIRouter(dependencies=[Depends(require_coach)])


@router.get("/{student_id}/progress")
def student_progress(
    student_id: str,
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(club_db),
):
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return build_progress_report(db, student, from_date, to_date)
