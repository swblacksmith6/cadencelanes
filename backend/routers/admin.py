from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.control_models import Club, User
from db.engine import get_control_db
from middleware.auth import require_admin
from schemas.club import RejectRequest
from services import club_service

router = APIRouter(dependencies=[Depends(require_admin)])


def _club_out(c: Club) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "head_coach_name": c.head_coach_name,
        "head_coach_phone": c.head_coach_phone,
        "status": c.status,
        "rejection_reason": c.rejection_reason,
        "created_at": c.created_at.isoformat(),
        "approved_at": c.approved_at.isoformat() if c.approved_at else None,
    }


def _get_club(db: Session, club_id: str) -> Club:
    club = db.get(Club, club_id)
    if club is None:
        raise HTTPException(status_code=404, detail="Club not found")
    return club


@router.get("/clubs")
def list_clubs(status: str | None = None, db: Session = Depends(get_control_db)):
    q = db.query(Club).order_by(Club.created_at.desc())
    if status:
        q = q.filter(Club.status == status)
    return [_club_out(c) for c in q.all()]


@router.get("/clubs/{club_id}")
def club_detail(club_id: str, db: Session = Depends(get_control_db)):
    club = _get_club(db, club_id)
    out = _club_out(club)
    out["users"] = [
        {"id": u.id, "name": u.name, "phone": u.phone, "role": u.role, "is_active": u.is_active}
        for u in club.users
    ]
    return out


@router.post("/clubs/{club_id}/approve")
def approve(club_id: str, db: Session = Depends(get_control_db), admin: dict = Depends(require_admin)):
    club = _get_club(db, club_id)
    club_service.approve_club(db, club, admin["user_id"])
    return {"message": f"Club '{club.name}' approved"}


@router.post("/clubs/{club_id}/reject")
def reject(club_id: str, body: RejectRequest, db: Session = Depends(get_control_db), admin: dict = Depends(require_admin)):
    club = _get_club(db, club_id)
    club_service.reject_club(db, club, admin["user_id"], body.reason)
    return {"message": f"Club '{club.name}' rejected"}


@router.delete("/clubs/{club_id}")
def delete(club_id: str, db: Session = Depends(get_control_db), admin: dict = Depends(require_admin)):
    club = _get_club(db, club_id)
    name = club.name
    club_service.delete_club(db, club, admin["user_id"])
    return {"message": f"Club '{name}' deleted"}


@router.get("/users")
def list_users(db: Session = Depends(get_control_db)):
    return [
        {"id": u.id, "name": u.name, "phone": u.phone, "role": u.role, "club_id": u.club_id, "is_active": u.is_active}
        for u in db.query(User).order_by(User.created_at.desc()).all()
    ]
