# SwimAcademy MVP — Database Design Document (SQLAlchemy)

**Version:** 3.0
**Date:** 2026-08-04
**Status:** LOCKED — Ready to build
**Change from v2:** Added progress report models, made distance_meters mandatory in Timing

---

## 1. Database Strategy

**Multi-tenant isolation via separate SQLite files:**

| Database | File | Purpose |
|---|---|---|
| Control DB | `data/control.db` | Auth, club registry, user accounts, super admin |
| Club DB | `data/clubs/club_{club_id}.db` | Students, coaches, sessions, attendance, timings, progress |

**SQLAlchemy approach:**
- Two separate `Base` classes — `ControlBase` and `ClubBase`
- Control DB has one engine, always open
- Club DBs use a factory function: `get_club_engine(club_id)` → returns engine for that club's file
- `ClubBase.metadata.create_all(engine)` creates all tables in a new club DB on approval
- No manual SQL migrations — SQLAlchemy handles schema from model definitions

**Conventions:**
- UUIDs generated via Python `uuid.uuid4()`, stored as `String(36)`
- Timestamps via `DateTime` with `default=datetime.utcnow` (SQLite stores as ISO strings)
- Booleans via `Boolean` (SQLAlchemy maps to INTEGER 0/1 for SQLite)
- All relationships defined with `relationship()` for easy eager/lazy loading
- `Enum` types enforced at the Python level, stored as strings in SQLite

---

## 2. Project Structure

```
app/
├── db/
│   ├── __init__.py
│   ├── engine.py              # Engine factory, session makers
│   ├── control_models.py      # ControlBase + all control DB models
│   └── club_models.py         # ClubBase + all club DB models
├── data/
│   ├── control.db
│   └── clubs/
│       ├── club_abc123.db
│       └── club_def456.db
```

---

## 3. Engine & Session Management

```python
# db/engine.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
from functools import lru_cache

DATA_DIR = Path("data")
CLUBS_DIR = DATA_DIR / "clubs"

# ── Control DB ──────────────────────────────────────
CONTROL_DB_URL = f"sqlite:///{DATA_DIR}/control.db"

control_engine = create_engine(
    CONTROL_DB_URL,
    connect_args={"check_same_thread": False},  # needed for FastAPI
    echo=False,
)

ControlSessionLocal = sessionmaker(
    bind=control_engine,
    autocommit=False,
    autoflush=False,
)


def get_control_db() -> Session:
    """FastAPI dependency for control DB sessions."""
    db = ControlSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Club DB (per-tenant) ───────────────────────────
@lru_cache(maxsize=50)
def get_club_engine(club_id: str):
    """Returns (or creates + caches) an engine for a specific club DB."""
    CLUBS_DIR.mkdir(parents=True, exist_ok=True)
    db_path = CLUBS_DIR / f"club_{club_id}.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    return engine


def get_club_session_factory(club_id: str) -> sessionmaker:
    engine = get_club_engine(club_id)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_club_db(club_id: str) -> Session:
    """FastAPI dependency for club DB sessions. club_id comes from JWT."""
    factory = get_club_session_factory(club_id)
    db = factory()
    try:
        yield db
    finally:
        db.close()


def create_club_database(club_id: str):
    """Called when super admin approves a club. Creates file + all tables."""
    from .club_models import ClubBase
    engine = get_club_engine(club_id)
    ClubBase.metadata.create_all(bind=engine)
    _seed_swim_styles(engine)
    _seed_distance_events(engine)


def _seed_swim_styles(engine):
    """Insert default swim styles into a freshly created club DB."""
    from .club_models import SwimStyle
    Session = sessionmaker(bind=engine)
    db = Session()
    defaults = [
        SwimStyle(name="Freestyle",         short_code="FR", sort_order=1),
        SwimStyle(name="Backstroke",        short_code="BK", sort_order=2),
        SwimStyle(name="Breaststroke",      short_code="BR", sort_order=3),
        SwimStyle(name="Butterfly",         short_code="BF", sort_order=4),
        SwimStyle(name="Individual Medley", short_code="IM", sort_order=5),
    ]
    db.add_all(defaults)
    db.commit()
    db.close()


def _seed_distance_events(engine):
    """Insert standard competition distances."""
    from .club_models import DistanceEvent
    Session = sessionmaker(bind=engine)
    db = Session()
    defaults = [
        DistanceEvent(distance_meters=25,  label="25m",  sort_order=1),
        DistanceEvent(distance_meters=50,  label="50m",  sort_order=2),
        DistanceEvent(distance_meters=100, label="100m", sort_order=3),
        DistanceEvent(distance_meters=200, label="200m", sort_order=4),
        DistanceEvent(distance_meters=400, label="400m", sort_order=5),
        DistanceEvent(distance_meters=800, label="800m", sort_order=6),
        DistanceEvent(distance_meters=1500,label="1500m",sort_order=7),
    ]
    db.add_all(defaults)
    db.commit()
    db.close()
```

---

## 4. Control Database Models (`control_models.py`)

```python
# db/control_models.py

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Boolean, ForeignKey, Text, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship


class ControlBase(DeclarativeBase):
    pass


# ── Mixins ──────────────────────────────────────────
class TimestampMixin:
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UUIDMixin:
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


# ── Club ────────────────────────────────────────────
class Club(ControlBase, UUIDMixin, TimestampMixin):
    __tablename__ = "clubs"

    name             = Column(String(200), nullable=False)
    head_coach_name  = Column(String(200), nullable=False)
    head_coach_phone = Column(String(20), nullable=False, unique=True)
    status           = Column(String(20), nullable=False, default="pending")
        # pending | approved | rejected
    rejection_reason = Column(Text, nullable=True)
    approved_at      = Column(DateTime, nullable=True)

    # relationships
    users = relationship("User", back_populates="club")

    def __repr__(self):
        return f"<Club {self.name} ({self.status})>"


# ── User ────────────────────────────────────────────
class User(ControlBase, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    phone     = Column(String(20), nullable=False, unique=True, index=True)
    name      = Column(String(200), nullable=False)
    role      = Column(String(20), nullable=False)
        # super_admin | head_coach | assistant_coach
    club_id   = Column(String(36), ForeignKey("clubs.id"), nullable=True)
        # NULL for super_admin
    is_active = Column(Boolean, nullable=False, default=True)

    # relationships
    club       = relationship("Club", back_populates="users")
    audit_logs = relationship("AdminAuditLog", back_populates="admin")

    def __repr__(self):
        return f"<User {self.name} ({self.role})>"


# ── OTP ─────────────────────────────────────────────
class OTPCode(ControlBase, UUIDMixin):
    __tablename__ = "otp_codes"

    phone      = Column(String(20), nullable=False, index=True)
    code       = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used    = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<OTP {self.phone} ({'used' if self.is_used else 'active'})>"


# ── Admin Audit Log ─────────────────────────────────
class AdminAuditLog(ControlBase, UUIDMixin):
    __tablename__ = "admin_audit_log"

    admin_id    = Column(String(36), ForeignKey("users.id"), nullable=False)
    action      = Column(String(50), nullable=False)
        # club_approved | club_rejected | club_deleted | user_deactivated
    target_type = Column(String(20), nullable=False)  # club | user
    target_id   = Column(String(36), nullable=False)
    details     = Column(Text, nullable=True)  # JSON string
    created_at  = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    admin = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("idx_audit_target", "target_type", "target_id"),
    )

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.target_type}:{self.target_id}>"
```

---

## 5. Club Database Models (`club_models.py`)

```python
# db/club_models.py

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Date, Boolean, Float, Integer,
    ForeignKey, Text, Index, UniqueConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship


class ClubBase(DeclarativeBase):
    pass


# ── Mixins ──────────────────────────────────────────
class TimestampMixin:
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class UUIDMixin:
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


# ═══════════════════════════════════════════════════
#  PEOPLE
# ═══════════════════════════════════════════════════

# ── Coach ───────────────────────────────────────────
class Coach(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "coaches"

    user_id   = Column(String(36), nullable=False, unique=True)
        # maps to control.db users.id (not a real FK, cross-DB)
    name      = Column(String(200), nullable=False)
    phone     = Column(String(20), nullable=False)
    role      = Column(String(20), nullable=False)
        # head_coach | assistant_coach
    is_active = Column(Boolean, nullable=False, default=True)

    # relationships
    sessions_created    = relationship("Session", back_populates="creator")
    attendance_marked   = relationship("Attendance", back_populates="marker")
    timings_recorded    = relationship("Timing", back_populates="recorder")
    students_created    = relationship("Student", back_populates="creator")
    coach_notes         = relationship("CoachNote", back_populates="coach")
    skill_assessments   = relationship("SkillAssessment", back_populates="assessed_by_coach")

    def __repr__(self):
        return f"<Coach {self.name} ({self.role})>"


# ── Student ─────────────────────────────────────────
class Student(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "students"

    name          = Column(String(200), nullable=False)       # mandatory
    date_of_birth = Column(Date, nullable=False)              # mandatory
    address       = Column(Text, nullable=True)               # optional
    is_active     = Column(Boolean, nullable=False, default=True)
    created_by    = Column(String(36), ForeignKey("coaches.id"), nullable=False)

    # relationships
    creator           = relationship("Coach", back_populates="students_created")
    parent_contacts   = relationship("ParentContact", back_populates="student",
                                     cascade="all, delete-orphan")
    attendance        = relationship("Attendance", back_populates="student",
                                     cascade="all, delete-orphan")
    timings           = relationship("Timing", back_populates="student",
                                     cascade="all, delete-orphan")
    personal_bests    = relationship("PersonalBest", back_populates="student",
                                     cascade="all, delete-orphan")
    coach_notes       = relationship("CoachNote", back_populates="student",
                                     cascade="all, delete-orphan")
    skill_assessments = relationship("SkillAssessment", back_populates="student",
                                     cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Student {self.name}>"


# ── Parent Contact ──────────────────────────────────
class ParentContact(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "parent_contacts"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False)
    relation   = Column(String(20), nullable=False)
        # father | mother | guardian
    name       = Column(String(200), nullable=True)    # parent/guardian name
    phone      = Column(String(20), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False)

    # relationships
    student = relationship("Student", back_populates="parent_contacts")

    def __repr__(self):
        return f"<ParentContact {self.relation} ({self.phone}) primary={self.is_primary}>"


# ═══════════════════════════════════════════════════
#  REFERENCE DATA
# ═══════════════════════════════════════════════════

# ── Swim Style ──────────────────────────────────────
class SwimStyle(ClubBase, UUIDMixin):
    __tablename__ = "swim_styles"

    name       = Column(String(100), nullable=False, unique=True)
    short_code = Column(String(10), nullable=False, unique=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    timings         = relationship("Timing", back_populates="swim_style")
    personal_bests  = relationship("PersonalBest", back_populates="swim_style")
    skill_assessments = relationship("SkillAssessment", back_populates="swim_style")

    def __repr__(self):
        return f"<SwimStyle {self.name} ({self.short_code})>"


# ── Distance Event ──────────────────────────────────
class DistanceEvent(ClubBase, UUIDMixin):
    __tablename__ = "distance_events"

    distance_meters = Column(Integer, nullable=False, unique=True)  # 25, 50, 100...
    label           = Column(String(20), nullable=False)            # "25m", "50m"...
    sort_order      = Column(Integer, nullable=False, default=0)
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    timings        = relationship("Timing", back_populates="distance_event")
    personal_bests = relationship("PersonalBest", back_populates="distance_event")

    def __repr__(self):
        return f"<DistanceEvent {self.label}>"


# ═══════════════════════════════════════════════════
#  SESSIONS & ATTENDANCE
# ═══════════════════════════════════════════════════

# ── Session ─────────────────────────────────────────
class Session(ClubBase, UUIDMixin):
    __tablename__ = "sessions"

    session_date = Column(Date, nullable=False)
    session_type = Column(String(10), nullable=False)
        # morning | evening
    notes        = Column(Text, nullable=True)
    created_by   = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    created_at   = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    creator    = relationship("Coach", back_populates="sessions_created")
    attendance = relationship("Attendance", back_populates="session",
                              cascade="all, delete-orphan")
    timings    = relationship("Timing", back_populates="session",
                              cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("session_date", "session_type",
                         name="uq_session_date_type"),
    )

    def __repr__(self):
        return f"<Session {self.session_date} {self.session_type}>"


# ── Attendance ──────────────────────────────────────
class Attendance(ClubBase, UUIDMixin):
    __tablename__ = "attendance"

    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"),
                        nullable=False)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False)
    status     = Column(String(10), nullable=False, default="present")
        # present | absent
    marked_by  = Column(String(36), ForeignKey("coaches.id"), nullable=True)
    marked_at  = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    session = relationship("Session", back_populates="attendance")
    student = relationship("Student", back_populates="attendance")
    marker  = relationship("Coach", back_populates="attendance_marked")

    __table_args__ = (
        UniqueConstraint("session_id", "student_id",
                         name="uq_attendance_session_student"),
    )

    def __repr__(self):
        return f"<Attendance {self.student_id} → {self.status}>"


# ═══════════════════════════════════════════════════
#  TIMINGS & PERFORMANCE
# ═══════════════════════════════════════════════════

# ── Timing ──────────────────────────────────────────
class Timing(ClubBase, UUIDMixin, TimestampMixin):
    __tablename__ = "timings"

    session_id        = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"),
                               nullable=False)
    student_id        = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                               nullable=False)
    swim_style_id     = Column(String(36), ForeignKey("swim_styles.id"),
                               nullable=False)
    distance_event_id = Column(String(36), ForeignKey("distance_events.id"),
                               nullable=False)  # ← NOW MANDATORY (was optional int in v2)
    time_seconds      = Column(Float, nullable=False)   # e.g. 32.45
    notes             = Column(Text, nullable=True)
    recorded_by       = Column(String(36), ForeignKey("coaches.id"), nullable=False)

    # relationships
    session        = relationship("Session", back_populates="timings")
    student        = relationship("Student", back_populates="timings")
    swim_style     = relationship("SwimStyle", back_populates="timings")
    distance_event = relationship("DistanceEvent", back_populates="timings")
    recorder       = relationship("Coach", back_populates="timings_recorded")

    __table_args__ = (
        Index("idx_timings_student_style", "student_id", "swim_style_id"),
        Index("idx_timings_student_style_dist", "student_id", "swim_style_id",
              "distance_event_id"),
    )

    def __repr__(self):
        return f"<Timing {self.student_id} {self.time_seconds}s>"


# ── Personal Best ───────────────────────────────────
class PersonalBest(ClubBase, UUIDMixin, TimestampMixin):
    """
    Auto-maintained table. Updated by the API whenever a new Timing
    is recorded that beats the existing best for the same
    student + swim_style + distance combo.

    One row per unique (student, swim_style, distance_event).
    """
    __tablename__ = "personal_bests"

    student_id        = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                               nullable=False)
    swim_style_id     = Column(String(36), ForeignKey("swim_styles.id"),
                               nullable=False)
    distance_event_id = Column(String(36), ForeignKey("distance_events.id"),
                               nullable=False)
    best_time_seconds = Column(Float, nullable=False)
    achieved_at       = Column(DateTime, nullable=False)      # when the PB was set
    timing_id         = Column(String(36), ForeignKey("timings.id"),
                               nullable=True)                 # FK to the actual timing record
    previous_best     = Column(Float, nullable=True)          # what the old PB was (for showing improvement)

    # relationships
    student        = relationship("Student", back_populates="personal_bests")
    swim_style     = relationship("SwimStyle", back_populates="personal_bests")
    distance_event = relationship("DistanceEvent", back_populates="personal_bests")

    __table_args__ = (
        UniqueConstraint("student_id", "swim_style_id", "distance_event_id",
                         name="uq_pb_student_style_distance"),
    )

    def __repr__(self):
        return f"<PersonalBest {self.student_id} {self.best_time_seconds}s>"


# ═══════════════════════════════════════════════════
#  PROGRESS & ASSESSMENT
# ═══════════════════════════════════════════════════

# ── Coach Note ──────────────────────────────────────
class CoachNote(ClubBase, UUIDMixin):
    """
    Free-text observations from a coach about a student.
    Not tied to a specific session — these are periodic
    assessments like "Breathing technique improving" or
    "Needs work on flip turns".
    """
    __tablename__ = "coach_notes"

    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False)
    coach_id   = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    note       = Column(Text, nullable=False)
    category   = Column(String(30), nullable=False, default="general")
        # general | technique | fitness | behavior | goal
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    student = relationship("Student", back_populates="coach_notes")
    coach   = relationship("Coach", back_populates="coach_notes")

    __table_args__ = (
        Index("idx_coach_notes_student", "student_id"),
        Index("idx_coach_notes_date", "created_at"),
    )

    def __repr__(self):
        return f"<CoachNote {self.student_id} [{self.category}]>"


# ── Skill Assessment ────────────────────────────────
class SkillAssessment(ClubBase, UUIDMixin):
    """
    Periodic rating of a student's proficiency in a swim style.
    Coach rates 1-5. Tracked over time to show skill progression.

    1 = Beginner (learning basics)
    2 = Elementary (can do the stroke but inconsistent)
    3 = Intermediate (consistent technique)
    4 = Advanced (competition-ready)
    5 = Elite (exceptional)
    """
    __tablename__ = "skill_assessments"

    student_id    = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"),
                           nullable=False)
    swim_style_id = Column(String(36), ForeignKey("swim_styles.id"),
                           nullable=False)
    rating        = Column(Integer, nullable=False)    # 1–5
    notes         = Column(Text, nullable=True)        # why this rating
    assessed_by   = Column(String(36), ForeignKey("coaches.id"), nullable=False)
    assessed_at   = Column(DateTime, nullable=False, default=datetime.utcnow)

    # relationships
    student            = relationship("Student", back_populates="skill_assessments")
    swim_style         = relationship("SwimStyle", back_populates="skill_assessments")
    assessed_by_coach  = relationship("Coach", back_populates="skill_assessments")

    __table_args__ = (
        Index("idx_skill_student_style", "student_id", "swim_style_id"),
        Index("idx_skill_date", "assessed_at"),
    )

    def __repr__(self):
        return f"<SkillAssessment {self.student_id} {self.swim_style_id} → {self.rating}/5>"
```

---

## 6. Relationships Map

```
CONTROL.DB (ControlBase)               CLUB_{ID}.DB (ClubBase)
========================               =======================

Club ◄──┐                              Coach
  │     │                                │
  │   User ── OTPCode                    ├─creates──► Student
  │     │                                │               │
  │   AdminAuditLog                      │               ├──► ParentContact (max 2, 1 primary)
  │                                      │               │
  │  user_id ·····················►  coach.user_id       ├──► CoachNote (from Coach)
  │  (conceptual link, not FK)           │               │
                                         │               ├──► SkillAssessment (from Coach, per SwimStyle)
                                         │               │
                                    Session ◄────────────┘
                                      │
                                      ├──► Attendance (auto-created, default present)
                                      │
                                      └──► Timing ──► SwimStyle
                                              │    └──► DistanceEvent
                                              │
                                              └──► PersonalBest (auto-maintained)
                                                      │
                                                      ├──► SwimStyle
                                                      └──► DistanceEvent
```

---

## 7. Progress Report — What It Computes

The progress report is **not a stored table** — it's computed on-the-fly from existing data via API queries. Here's what each section pulls:

### 7.1 Student Overview
- **Source:** `Student` table
- **Shows:** Name, age (from DOB), enrollment date, active/inactive

### 7.2 Attendance Summary
- **Source:** `Attendance` + `Session` tables
- **Computed:**
  - Total sessions available (count of sessions in date range)
  - Sessions attended (count where status = present)
  - Attendance % = attended / total × 100
  - Streak: current consecutive present count
- **Periods:** Last 7 days, last 30 days, last 90 days, all-time

### 7.3 Personal Bests
- **Source:** `PersonalBest` table
- **Shows per swim style + distance combo:**
  - Current best time
  - Previous best time
  - Improvement (seconds shaved off)
  - Date achieved

### 7.4 Timing Trends
- **Source:** `Timing` table, grouped by (swim_style, distance_event)
- **Computed:**
  - All recorded times in chronological order → line chart data
  - Average time over last 5 recordings vs first 5 recordings → improvement %
  - Best / worst / average for any date range
- **Demo killer feature:** Show a simple line chart of times going down over weeks

### 7.5 Skill Progression
- **Source:** `SkillAssessment` table
- **Shows per swim style:**
  - Current rating (1-5) with label
  - Rating history over time → progression chart
  - Date of last assessment
- **Demo feature:** Radar/spider chart showing proficiency across all styles

### 7.6 Coach Notes Timeline
- **Source:** `CoachNote` table
- **Shows:** Chronological feed of observations, filterable by category

### 7.7 Overall Progress Score (Optional — nice for demo)
- **Computed from:**
  - Attendance % (weighted 20%)
  - PB improvements in last 30 days (weighted 30%)
  - Average skill rating (weighted 30%)
  - Consistency: timing std deviation decreasing (weighted 20%)
- **Result:** A single 0-100 score that coaches can glance at

---

## 8. API Endpoints for Progress

```
GET /club/{club_id}/students/{student_id}/progress
    ?from_date=2026-01-01
    &to_date=2026-08-04

Response:
{
    "student": { name, age, enrolled_since },
    "attendance": {
        "last_7_days": { total, attended, percentage },
        "last_30_days": { total, attended, percentage },
        "all_time": { total, attended, percentage },
        "current_streak": 12
    },
    "personal_bests": [
        {
            "style": "Freestyle", "distance": "50m",
            "best_time": 32.45, "previous_best": 34.10,
            "improvement": 1.65, "achieved_at": "2026-07-28"
        }
    ],
    "timing_trends": {
        "Freestyle_50m": [
            { "date": "2026-06-01", "time": 38.2 },
            { "date": "2026-06-15", "time": 36.8 },
            ...
        ]
    },
    "skill_ratings": {
        "Freestyle": { "current": 3, "label": "Intermediate", "history": [...] },
        "Backstroke": { "current": 2, "label": "Elementary", "history": [...] }
    },
    "recent_notes": [
        { "date": "2026-07-25", "coach": "John", "category": "technique",
          "note": "Breathing rhythm improving on freestyle" }
    ],
    "overall_score": 72
}
```

---

## 9. Business Rules (Enforced at API Level)

| # | Rule | How |
|---|---|---|
| 1 | Student name + DOB mandatory | `nullable=False` + Pydantic validation |
| 2 | Max 2 parent contacts per student | API checks count before insert |
| 3 | Exactly 1 primary parent contact | API validates on create/update |
| 4 | Relation ∈ {father, mother, guardian} | Pydantic `Literal` |
| 5 | One morning + one evening session/day | `UniqueConstraint` |
| 6 | Attendance defaults to present | Bulk insert on session create |
| 7 | Only head coach adds assistants | JWT role check |
| 8 | Head + assistants manage students | JWT role check |
| 9 | One phone = one club | `unique=True` on head_coach_phone |
| 10 | One phone = one user | `unique=True` on User.phone |
| 11 | Timings need style + distance | Both FKs are `nullable=False` |
| 12 | PB auto-updates on timing insert | API logic: compare new time vs existing PB |
| 13 | Skill rating must be 1-5 | Pydantic `ge=1, le=5` |
| 14 | Coach notes need a category | Default "general", validated against allowed list |
| 15 | Soft delete for students & coaches | `is_active` flag |

---

## 10. PB Auto-Update Logic (Pseudocode)

```python
def record_timing(db, timing_data):
    """Called when a coach saves a new timing entry."""
    # 1. Insert the timing record
    timing = Timing(**timing_data)
    db.add(timing)
    db.flush()  # get timing.id

    # 2. Check for existing PB
    existing_pb = db.query(PersonalBest).filter_by(
        student_id=timing.student_id,
        swim_style_id=timing.swim_style_id,
        distance_event_id=timing.distance_event_id,
    ).first()

    if existing_pb is None:
        # First ever timing for this combo → it's the PB
        pb = PersonalBest(
            student_id=timing.student_id,
            swim_style_id=timing.swim_style_id,
            distance_event_id=timing.distance_event_id,
            best_time_seconds=timing.time_seconds,
            achieved_at=datetime.utcnow(),
            timing_id=timing.id,
            previous_best=None,
        )
        db.add(pb)

    elif timing.time_seconds < existing_pb.best_time_seconds:
        # New PB! Update the record
        existing_pb.previous_best = existing_pb.best_time_seconds
        existing_pb.best_time_seconds = timing.time_seconds
        existing_pb.achieved_at = datetime.utcnow()
        existing_pb.timing_id = timing.id
        existing_pb.updated_at = datetime.utcnow()

    # else: not a PB, do nothing

    db.commit()
    return timing
```

---

## 11. DB Lifecycle

| Event | Action |
|---|---|
| App starts | `ControlBase.metadata.create_all(control_engine)` + seed super admin |
| Club registers | Insert `Club(status="pending")` |
| Admin approves | Update status → `create_club_database(club_id)` → seed styles + distances → insert Coach + User |
| Admin rejects | Update status + rejection_reason |
| Admin deletes club | Delete `.db` file + remove Club/Users from control DB + clear engine cache |
| Head coach adds assistant | Insert User in control DB + Coach in club DB |
| Session created | Insert Session → bulk insert Attendance for all active students as "present" |
| Timing recorded | Insert Timing → check & update PersonalBest |
| Skill assessed | Insert SkillAssessment (keeps history, no upsert) |
| Coach adds note | Insert CoachNote |
| Progress report requested | Query across Attendance, Timing, PersonalBest, SkillAssessment, CoachNote → compute & return JSON |

---

## 12. Seed Data

### Super Admin (control.db)

```python
User(
    id="SA-001",
    phone="9999999999",
    name="Super Admin",
    role="super_admin",
    club_id=None,
    is_active=True,
)
```

### Default Swim Styles (per club DB)

Freestyle (FR), Backstroke (BK), Breaststroke (BR), Butterfly (BF), Individual Medley (IM)

### Default Distance Events (per club DB)

25m, 50m, 100m, 200m, 400m, 800m, 1500m

---

## 13. Table Count Summary

| Database | Tables | Purpose |
|---|---|---|
| control.db | 4 | clubs, users, otp_codes, admin_audit_log |
| club_{id}.db | 10 | coaches, students, parent_contacts, swim_styles, distance_events, sessions, attendance, timings, personal_bests, coach_notes, skill_assessments |

**Total: 14 tables across both databases.**

---

## 14. Open Questions

None — all resolved. Schema is locked for MVP.

---

## 15. Future Enhancements (Post-MVP)

- Student photo upload
- Multiple clubs per coach (one phone → many academies)
- Parent login / parent-facing portal
- Batch/group management (beginner / intermediate / advanced)
- Computed overall progress score (0-100)
- Fee management / payments
- Competition event tracking
- Notifications (SMS/email to parents)
- File uploads (certificates, medical docs)
- Multi-location per club
- Schedule templates (recurring weekly timetable)

---

*Schema is defined entirely in Python models. Delete `.db` files and restart to recreate from scratch during MVP. Progress reports are computed, not stored — no separate migration needed for report changes.*
