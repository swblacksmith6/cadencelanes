import random
from datetime import datetime, timedelta

from jose import jwt
from sqlalchemy.orm import Session

from config import settings
from db.control_models import OTPCode, User


def generate_otp(db: Session, phone: str) -> str:
    code = "".join(random.choices("0123456789", k=settings.OTP_LENGTH))
    db.add(OTPCode(
        phone=phone,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    ))
    db.commit()
    return code


def verify_otp(db: Session, phone: str, code: str) -> bool:
    otp = (
        db.query(OTPCode)
        .filter(OTPCode.phone == phone, OTPCode.is_used == False, OTPCode.expires_at > datetime.utcnow())  # noqa: E712
        .order_by(OTPCode.created_at.desc())
        .first()
    )
    if otp is None or otp.code != code:
        return False
    otp.is_used = True
    db.commit()
    return True


def create_jwt(user: User) -> str:
    payload = {
        "user_id": user.id,
        "phone": user.phone,
        "role": user.role,
        "club_id": user.club_id,
        "name": user.name,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
