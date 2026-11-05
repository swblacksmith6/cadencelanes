import secrets
import uuid
from datetime import datetime, timedelta

from jose import jwt
from sqlalchemy.orm import Session

from config import settings
from db.control_models import ActiveSession, OTPCode, User


class OTPRateLimited(Exception):
    pass


def generate_otp(db: Session, phone: str) -> str:
    since = datetime.utcnow() - timedelta(hours=1)
    recent = db.query(OTPCode).filter(OTPCode.phone == phone, OTPCode.created_at > since).count()
    if recent >= settings.OTP_MAX_REQUESTS_PER_HOUR:
        raise OTPRateLimited()
    code = "".join(secrets.choice("0123456789") for _ in range(settings.OTP_LENGTH))
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
    if otp is None or otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        return False
    if not secrets.compare_digest(otp.code, code):
        otp.attempts += 1
        db.commit()
        return False
    otp.is_used = True
    db.commit()
    return True


def start_session(db: Session, user: User) -> tuple[str, bool]:
    """Make this login the user's only live session. Returns (session_id, replaced_another)."""
    sid = str(uuid.uuid4())
    row = db.get(ActiveSession, user.id)
    replaced = row is not None
    if row is None:
        db.add(ActiveSession(user_id=user.id, session_id=sid))
    else:
        row.session_id = sid
        row.created_at = datetime.utcnow()
    db.commit()
    return sid, replaced


def create_jwt(user: User, session_id: str) -> str:
    payload = {
        "sid": session_id,
        "user_id": user.id,
        "phone": user.phone,
        "role": user.role,
        "club_id": user.club_id,
        "name": user.name,
        "exp": datetime.utcnow() + timedelta(days=settings.JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
