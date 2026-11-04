import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.club_models import Coach
from db.control_models import User
from db.engine import get_control_db
from logging_config import get_logger, log_event
from middleware.auth import require_coach, require_head_coach
from routers.deps import club_db
from schemas.coach import CoachCreate, CoachUpdate

log = get_logger("app.coaches")
router = APIRouter()


def _coach_out(c: Coach) -> dict:
    return {"id": c.id, "name": c.name, "phone": c.phone, "role": c.role, "is_active": c.is_active}


@router.get("")
def list_coaches(db: Session = Depends(club_db), user: dict = Depends(require_coach)):
    return [_coach_out(c) for c in db.query(Coach).order_by(Coach.created_at.asc()).all()]


@router.post("", status_code=201)
def add_coach(
    club_id: str,
    body: CoachCreate,
    db: Session = Depends(club_db),
    control: Session = Depends(get_control_db),
    user: dict = Depends(require_head_coach),
):
    if control.query(User).filter_by(phone=body.phone).first():
        raise HTTPException(status_code=409, detail="Phone is already registered to another user")
    new_user = User(phone=body.phone, name=body.name, role="assistant_coach", club_id=club_id)
    control.add(new_user)
    control.commit()

    coach = Coach(user_id=new_user.id, name=body.name, phone=body.phone, role="assistant_coach")
    db.add(coach)
    db.commit()
    db.refresh(coach)
    return _coach_out(coach)


@router.put("/{coach_id}")
def update_coach(
    coach_id: str,
    body: CoachUpdate,
    db: Session = Depends(club_db),
    control: Session = Depends(get_control_db),
    user: dict = Depends(require_head_coach),
):
    coach = db.get(Coach, coach_id)
    if coach is None:
        raise HTTPException(status_code=404, detail="Coach not found")
    if body.name is not None:
        coach.name = body.name
    if body.is_active is not None:
        if coach.role == "head_coach" and not body.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate the head coach")
        coach.is_active = body.is_active
    db.commit()

    ctrl_user = control.get(User, coach.user_id)
    if ctrl_user:
        if body.name is not None:
            ctrl_user.name = body.name
        if body.is_active is not None:
            ctrl_user.is_active = body.is_active
        control.commit()
    return _coach_out(coach)


@router.delete("/{coach_id}")
def deactivate_coach(
    coach_id: str,
    db: Session = Depends(club_db),
    control: Session = Depends(get_control_db),
    user: dict = Depends(require_head_coach),
):
    coach = db.get(Coach, coach_id)
    if coach is None:
        raise HTTPException(status_code=404, detail="Coach not found")
    if coach.role == "head_coach":
        raise HTTPException(status_code=400, detail="Cannot remove the head coach")
    coach.is_active = False
    db.commit()
    ctrl_user = control.get(User, coach.user_id)
    if ctrl_user:
        ctrl_user.is_active = False
        control.commit()
    log_event(log, logging.INFO, "coach_deactivated", coach_id=coach_id, club_id=user.get("club_id"), by=user["user_id"])
    return {"message": "Coach deactivated"}
