from fastapi import Depends, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from db.club_models import Coach

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


def _check_club(user: dict, club_id: str):
    if user.get("role") == "super_admin":
        return
    if user.get("club_id") != club_id:
        raise HTTPException(status_code=403, detail="You don't have access to this club")


def require_coach(club_id: str = Path(...), user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("head_coach", "assistant_coach"):
        raise HTTPException(status_code=403, detail="Coach access required")
    _check_club(user, club_id)
    return user


def require_head_coach(club_id: str = Path(...), user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "head_coach":
        raise HTTPException(status_code=403, detail="Head coach access required")
    _check_club(user, club_id)
    return user


def get_current_coach(db: Session, user: dict) -> Coach:
    """Resolve the club-DB Coach row for the authenticated user."""
    coach = db.query(Coach).filter_by(user_id=user["user_id"]).first()
    if coach is None:
        raise HTTPException(status_code=403, detail="Coach record not found in this club")
    return coach
