import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import settings
from db.control_models import Club, User
from db.engine import get_control_db
from logging_config import get_logger, log_event
from schemas.auth import OTPRequest, OTPVerify, TokenResponse
from schemas.club import ClubRegister
from services import auth_service, club_service, sms_service

log = get_logger("app.auth")

router = APIRouter()
register_router = APIRouter()


@router.post("/request-otp")
def request_otp(body: OTPRequest, db: Session = Depends(get_control_db)):
    user = db.query(User).filter_by(phone=body.phone, is_active=True).first()
    if user is None:
        log_event(log, logging.WARNING, "otp_request_unknown_phone", phone_tail=body.phone[-4:])
        raise HTTPException(status_code=404, detail="Phone not registered")
    try:
        code = auth_service.generate_otp(db, body.phone)
    except auth_service.OTPRateLimited:
        log_event(log, logging.WARNING, "otp_rate_limited", phone_tail=body.phone[-4:])
        raise HTTPException(status_code=429, detail="Too many OTP requests, try again later")
    if sms_service.sms_enabled():
        try:
            sms_service.send_otp(body.phone, code)
        except sms_service.SMSSendError:
            raise HTTPException(status_code=502, detail="Could not send the OTP SMS, try again")
    else:
        # Dev only (no SMS provider configured): the operator reads the code from the log.
        log_event(log, logging.INFO, "otp_generated_dev", phone_tail=body.phone[-4:], otp=code)
    if settings.OTP_IN_RESPONSE:
        return {"message": "OTP sent", "otp": code}
    return {"message": "OTP sent"}


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(body: OTPVerify, db: Session = Depends(get_control_db)):
    if not auth_service.verify_otp(db, body.phone, body.code):
        log_event(log, logging.WARNING, "otp_verify_failed", phone_tail=body.phone[-4:])
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    user = db.query(User).filter_by(phone=body.phone, is_active=True).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    sid, replaced = auth_service.start_session(db, user)
    token = auth_service.create_jwt(user, sid)
    log_event(log, logging.INFO, "login_ok", user_id=user.id, role=user.role, club_id=user.club_id,
              replaced_other_session=replaced)
    return {
        "access_token": token,
        "other_sessions_ended": replaced,
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
    club_service.ensure_phone_available(db, body.head_coach_phone)
    club = Club(name=body.name, head_coach_name=body.head_coach_name, head_coach_phone=body.head_coach_phone)
    db.add(club)
    db.commit()
    print(f"[MVP stub] In production, email sent to super admin about new club: {club.name}")
    return {"message": "Registration submitted! You'll be notified once approved.", "club_id": club.id}
