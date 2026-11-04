import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, relationship


class ControlBase(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UUIDMixin:
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


class Club(ControlBase, UUIDMixin, TimestampMixin):
    __tablename__ = "clubs"

    name = Column(String(200), nullable=False)
    head_coach_name = Column(String(200), nullable=False)
    head_coach_phone = Column(String(20), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    rejection_reason = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    users = relationship("User", back_populates="club")

    def __repr__(self):
        return f"<Club {self.name} ({self.status})>"


class User(ControlBase, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    phone = Column(String(20), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)  # super_admin | head_coach | assistant_coach
    club_id = Column(String(36), ForeignKey("clubs.id"), nullable=True)  # NULL for super_admin
    is_active = Column(Boolean, nullable=False, default=True)

    club = relationship("Club", back_populates="users")
    audit_logs = relationship("AdminAuditLog", back_populates="admin")

    def __repr__(self):
        return f"<User {self.name} ({self.role})>"


class OTPCode(ControlBase, UUIDMixin):
    __tablename__ = "otp_codes"

    phone = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AdminAuditLog(ControlBase, UUIDMixin):
    __tablename__ = "admin_audit_log"

    admin_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # club_approved | club_rejected | club_deleted | user_deactivated
    target_type = Column(String(20), nullable=False)  # club | user
    target_id = Column(String(36), nullable=False)
    details = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    admin = relationship("User", back_populates="audit_logs")

    __table_args__ = (Index("idx_audit_target", "target_type", "target_id"),)
