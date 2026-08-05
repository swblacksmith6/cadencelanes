import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class ClubBase(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UUIDMixin:
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


# ═══════════════════════ PEOPLE ═══════════════════════

class Coach(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "coaches"

    user_id = Column(String(36), nullable=False, unique=True)  # control.db users.id (cross-DB, not a real FK)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=False)
    role = Column(String(20), nullable=False)  # head_coach | assistant_coach
    is_active = Column(Boolean, nullable=False, default=True)

    sessions_created = relationship("Session", back_populates="creator")
    attendance_marked = relationship("Attendance", back_populates="marker")
    timings_recorded = relationship("Timing", back_populates="recorder")
    students_created = relationship("Student", back_populates="creator")
    coach_notes = relationship("CoachNote", back_populates="coach")
    skill_assessments = relationship("SkillAssessment", back_populates="assessed_by_coach")


class Student(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "students"

    name = Column(String(200), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(36), ForeignKey("coaches.id"), nullable=False)

    creator = relationship("Coach", back_populates="students_created")
    parent_contacts = relationship("ParentContact", back_populates="student", cascade="all, delete-orphan")
    attendance = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    timings = relationship("Timing", back_populates="student", cascade="all, delete-orphan")
    personal_bests = relationship("PersonalBest", back_populates="student", cascade="all, delete-orphan")
    coach_notes = relationship("CoachNote", back_populates="student", cascade="all, delete-orphan")
    skill_assessments = relationship("SkillAssessment", back_populates="student", cascade="all, delete-orphan")


class ParentContact(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "parent_contacts"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    relation = Column(String(20), nullable=False)  # father | mother | guardian
    name = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False)

    student = relationship("Student", back_populates="parent_contacts")


# ═══════════════════════ REFERENCE DATA ═══════════════════════

class SwimStyle(ClubBase, UUIDMixin):
    __tablename__ = "swim_styles"

    name = Column(String(100), nullable=False, unique=True)
    short_code = Column(String(10), nullable=False, unique=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    timings = relationship("Timing", back_populates="swim_style")
    personal_bests = relationship("PersonalBest", back_populates="swim_style")
    skill_assessments = relationship("SkillAssessment", back_populates="swim_style")


class DistanceEvent(ClubBase, UUIDMixin):
    __tablename__ = "distance_events"

    distance_meters = Column(Integer, nullable=False, unique=True)
    label = Column(String(20), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    timings = relationship("Timing", back_populates="distance_event")
    personal_bests = relationship("PersonalBest", back_populates="distance_event")


# ═══════════════════════ SESSIONS & ATTENDANCE ═══════════════════════

class Session(ClubBase, UUIDMixin):
    __tablename__ = "sessions"

    session_date = Column(Date, nullable=False)
    session_type = Column(String(30), nullable=False)  # morning | evening | any custom type (e.g. competition)
    notes = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    creator = relationship("Coach", back_populates="sessions_created")
    attendance = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")
    timings = relationship("Timing", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("session_date", "session_type", name="uq_session_date_type"),)


class Attendance(ClubBase, UUIDMixin):
    __tablename__ = "attendance"

    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(10), nullable=False, default="present")  # present | absent
    marked_by = Column(String(36), ForeignKey("coaches.id"), nullable=True)
    marked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    session = relationship("Session", back_populates="attendance")
    student = relationship("Student", back_populates="attendance")
    marker = relationship("Coach", back_populates="attendance_marked")

    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),)


# ═══════════════════════ TIMINGS & PERFORMANCE ═══════════════════════

class Timing(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "timings"

    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    swim_style_id = Column(String(36), ForeignKey("swim_styles.id"), nullable=False)
    distance_event_id = Column(String(36), ForeignKey("distance_events.id"), nullable=False)
    time_seconds = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    recorded_by = Column(String(36), ForeignKey("coaches.id"), nullable=False)

    session = relationship("Session", back_populates="timings")
    student = relationship("Student", back_populates="timings")
    swim_style = relationship("SwimStyle", back_populates="timings")
    distance_event = relationship("DistanceEvent", back_populates="timings")
    recorder = relationship("Coach", back_populates="timings_recorded")

    __table_args__ = (
        Index("idx_timings_student_style", "student_id", "swim_style_id"),
        Index("idx_timings_student_style_dist", "student_id", "swim_style_id", "distance_event_id"),
    )


class PersonalBest(ClubBase, UUIDMixin, TimestampMixin):
    """One row per (student, swim_style, distance_event). Auto-maintained on timing insert."""
    __tablename__ = "personal_bests"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    swim_style_id = Column(String(36), ForeignKey("swim_styles.id"), nullable=False)
    distance_event_id = Column(String(36), ForeignKey("distance_events.id"), nullable=False)
    best_time_seconds = Column(Float, nullable=False)
    achieved_at = Column(DateTime, nullable=False)
    timing_id = Column(String(36), ForeignKey("timings.id"), nullable=True)
    previous_best = Column(Float, nullable=True)

    student = relationship("Student", back_populates="personal_bests")
    swim_style = relationship("SwimStyle", back_populates="personal_bests")
    distance_event = relationship("DistanceEvent", back_populates="personal_bests")

    __table_args__ = (
        UniqueConstraint("student_id", "swim_style_id", "distance_event_id", name="uq_pb_student_style_distance"),
    )


# ═══════════════════════ PROGRESS & ASSESSMENT ═══════════════════════

class CoachNote(ClubBase, UUIDMixin):
    __tablename__ = "coach_notes"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    coach_id = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    note = Column(Text, nullable=False)
    category = Column(String(30), nullable=False, default="general")  # general | technique | fitness | behavior | goal
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    student = relationship("Student", back_populates="coach_notes")
    coach = relationship("Coach", back_populates="coach_notes")

    __table_args__ = (
        Index("idx_coach_notes_student", "student_id"),
        Index("idx_coach_notes_date", "created_at"),
    )


class SkillAssessment(ClubBase, UUIDMixin):
    """1=Beginner 2=Elementary 3=Intermediate 4=Advanced 5=Elite"""
    __tablename__ = "skill_assessments"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    swim_style_id = Column(String(36), ForeignKey("swim_styles.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    notes = Column(Text, nullable=True)
    assessed_by = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    assessed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    student = relationship("Student", back_populates="skill_assessments")
    swim_style = relationship("SwimStyle", back_populates="skill_assessments")
    assessed_by_coach = relationship("Coach", back_populates="skill_assessments")

    __table_args__ = (
        Index("idx_skill_student_style", "student_id", "swim_style_id"),
        Index("idx_skill_date", "assessed_at"),
    )
