import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import settings
from db.control_models import Club, User
from db.engine import get_control_db
from schemas.auth import OTPRequest, OTPVerify, TokenResponse
from schemas.club import ClubRegister
from services import auth_service

logger = logging.getLogger("uvicorn.error")

router = APIRouter()
register_router = APIRouter()


@router.post("/request-otp")
def request_otp(body: OTPRequest, db: Session = Depends(get_control_db)):
    user = db.query(User).filter_by(phone=body.phone, is_active=True).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Phone not registered")
    try:
        code = auth_service.generate_otp(db, body.phone)
    except auth_service.OTPRateLimited:
        raise HTTPException(status_code=429, detail="Too many OTP requests, try again later")
    # No SMS provider yet: the code is logged for the operator, and returned only when OTP_IN_RESPONSE (dev).
    logger.info("OTP for ...%s: %s", body.phone[-4:], code)
    if settings.OTP_IN_RESPONSE:
        return {"message": "OTP sent", "otp": code}
    return {"message": "OTP sent"}


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(body: OTPVerify, db: Session = Depends(get_control_db)):
    if not auth_service.verify_otp(db, body.phone, body.code):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    user = db.query(User).filter_by(phone=body.phone, is_active=True).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    token = auth_service.create_jwt(user)
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "club_id": user.club_id,
            "club_name": user.club.name if user.club else None,
        },
    }


@register_router.post("/register-club", status_code=201)
def register_club(body: ClubRegister, db: Session = Depends(get_control_db)):
    if db.query(User).filter_by(phone=body.head_coach_phone).first():
        raise HTTPException(status_code=409, detail="Phone is already registered")
    if db.query(Club).filter_by(head_coach_phone=body.head_coach_phone).first():
        raise HTTPException(status_code=409, detail="A club is already registered with this phone")
    club = Club(name=body.name, head_coach_name=body.head_coach_name, head_coach_phone=body.head_coach_phone)
    db.add(club)
    db.commit()
    print(f"[MVP stub] In production, email sent to super admin about new club: {club.name}")
    return {"message": "Registration submitted! You'll be notified once approved.", "club_id": club.id}
