from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.club_models import CoachNote, ParentContact, SkillAssessment, Student, SwimStyle
from middleware.auth import get_current_coach, require_coach
from routers.deps import club_db
from schemas.student import AssessmentCreate, NoteCreate, StudentCreate, StudentUpdate
from services.progress_service import RATING_LABELS

router = APIRouter(dependencies=[Depends(require_coach)])


def _age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _student_out(s: Student) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "date_of_birth": s.date_of_birth.isoformat(),
        "age": _age(s.date_of_birth),
        "address": s.address,
        "is_active": s.is_active,
        "created_at": s.created_at.date().isoformat(),
        "parent_contacts": [
            {"id": c.id, "relation": c.relation, "name": c.name, "phone": c.phone, "is_primary": c.is_primary}
            for c in s.parent_contacts
        ],
    }


def _get_student(db: Session, student_id: str) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.get("")
def list_students(include_inactive: bool = False, db: Session = Depends(club_db)):
    q = db.query(Student).order_by(Student.name.asc())
    if not include_inactive:
        q = q.filter(Student.is_active == True)  # noqa: E712
    return [_student_out(s) for s in q.all()]


@router.get("/{student_id}")
def get_student(student_id: str, db: Session = Depends(club_db)):
    return _student_out(_get_student(db, student_id))


@router.post("", status_code=201)
def create_student(body: StudentCreate, db: Session = Depends(club_db), user: dict = Depends(require_coach)):
    coach = get_current_coach(db, user)
    student = Student(
        name=body.name,
        date_of_birth=body.date_of_birth,
        address=body.address,
        created_by=coach.id,
    )
    db.add(student)
    db.flush()
    for c in body.parent_contacts:
        db.add(ParentContact(student_id=student.id, relation=c.relation, name=c.name,
                             phone=c.phone, is_primary=c.is_primary))
    db.commit()
    db.refresh(student)
    return _student_out(student)


@router.put("/{student_id}")
def update_student(student_id: str, body: StudentUpdate, db: Session = Depends(club_db)):
    student = _get_student(db, student_id)
    if body.name is not None:
        student.name = body.name
    if body.date_of_birth is not None:
        student.date_of_birth = body.date_of_birth
    if body.address is not None:
        student.address = body.address
    if body.is_active is not None:
        student.is_active = body.is_active
    if body.parent_contacts is not None:
        db.query(ParentContact).filter_by(student_id=student.id).delete()
        for c in body.parent_contacts:
            db.add(ParentContact(student_id=student.id, relation=c.relation, name=c.name,
                                 phone=c.phone, is_primary=c.is_primary))
    db.commit()
    db.refresh(student)
    return _student_out(student)


@router.delete("/{student_id}")
def deactivate_student(student_id: str, db: Session = Depends(club_db)):
    student = _get_student(db, student_id)
    student.is_active = False
    db.commit()
    return {"message": "Student deactivated"}


# ── Coach notes ─────────────────────────────────────

@router.get("/{student_id}/notes")
def list_notes(student_id: str, db: Session = Depends(club_db)):
    _get_student(db, student_id)
    notes = (
        db.query(CoachNote).filter_by(student_id=student_id)
        .order_by(CoachNote.created_at.desc()).all()
    )
    return [
        {
            "id": n.id,
            "note": n.note,
            "category": n.category,
            "coach_name": n.coach.name if n.coach else "",
            "created_at": n.created_at.isoformat(),
        }
        for n in notes
    ]


@router.post("/{student_id}/notes", status_code=201)
def add_note(student_id: str, body: NoteCreate, db: Session = Depends(club_db), user: dict = Depends(require_coach)):
    _get_student(db, student_id)
    coach = get_current_coach(db, user)
    note = CoachNote(student_id=student_id, coach_id=coach.id, note=body.note, category=body.category)
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id, "note": note.note, "category": note.category,
        "coach_name": coach.name, "created_at": note.created_at.isoformat(),
    }


# ── Skill assessments ───────────────────────────────

@router.get("/{student_id}/assessments")
def list_assessments(student_id: str, db: Session = Depends(club_db)):
    _get_student(db, student_id)
    rows = (
        db.query(SkillAssessment).filter_by(student_id=student_id)
        .order_by(SkillAssessment.assessed_at.desc()).all()
    )
    return [
        {
            "id": a.id,
            "swim_style": a.swim_style.name if a.swim_style else "",
            "rating": a.rating,
            "rating_label": RATING_LABELS[a.rating],
            "notes": a.notes,
            "assessed_by": a.assessed_by_coach.name if a.assessed_by_coach else "",
            "assessed_at": a.assessed_at.isoformat(),
        }
        for a in rows
    ]


@router.post("/{student_id}/assessments", status_code=201)
def add_assessment(
    student_id: str, body: AssessmentCreate, db: Session = Depends(club_db), user: dict = Depends(require_coach)
):
    _get_student(db, student_id)
    if db.get(SwimStyle, body.swim_style_id) is None:
        raise HTTPException(status_code=404, detail="Swim style not found")
    coach = get_current_coach(db, user)
    a = SkillAssessment(
        student_id=student_id, swim_style_id=body.swim_style_id,
        rating=body.rating, notes=body.notes, assessed_by=coach.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {
        "id": a.id, "swim_style": a.swim_style.name, "rating": a.rating,
        "rating_label": RATING_LABELS[a.rating], "notes": a.notes,
        "assessed_by": coach.name, "assessed_at": a.assessed_at.isoformat(),
    }
