import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.club_models import Coach
from db.control_models import AdminAuditLog, Club, User
from db.engine import create_club_database, delete_club_database, get_club_session_factory


def approve_club(control_db: Session, club: Club, admin_id: str):
    if club.status == "approved":
        raise HTTPException(status_code=409, detail="Club is already approved")
    if control_db.query(User).filter_by(phone=club.head_coach_phone).first():
        raise HTTPException(status_code=409, detail="Head coach phone is already registered as a user")

    club.status = "approved"
    club.approved_at = datetime.utcnow()
    club.rejection_reason = None

    user = User(
        phone=club.head_coach_phone,
        name=club.head_coach_name,
        role="head_coach",
        club_id=club.id,
    )
    control_db.add(user)
    control_db.flush()

    create_club_database(club.id)
    club_db = get_club_session_factory(club.id)()
    try:
        club_db.add(Coach(user_id=user.id, name=club.head_coach_name, phone=club.head_coach_phone, role="head_coach"))
        club_db.commit()
    finally:
        club_db.close()

    control_db.add(AdminAuditLog(
        admin_id=admin_id, action="club_approved", target_type="club", target_id=club.id,
        details=json.dumps({"club_name": club.name}),
    ))
    control_db.commit()


def reject_club(control_db: Session, club: Club, admin_id: str, reason: str):
    if club.status == "approved":
        raise HTTPException(status_code=409, detail="Cannot reject an approved club")
    club.status = "rejected"
    club.rejection_reason = reason
    control_db.add(AdminAuditLog(
        admin_id=admin_id, action="club_rejected", target_type="club", target_id=club.id,
        details=json.dumps({"reason": reason}),
    ))
    control_db.commit()


def delete_club(control_db: Session, club: Club, admin_id: str):
    delete_club_database(club.id)
    control_db.query(User).filter_by(club_id=club.id).delete()
    control_db.add(AdminAuditLog(
        admin_id=admin_id, action="club_deleted", target_type="club", target_id=club.id,
        details=json.dumps({"club_name": club.name}),
    ))
    control_db.delete(club)
    control_db.commit()
