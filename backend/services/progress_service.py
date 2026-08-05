from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session as DBSession

from db.club_models import (
    Attendance, CoachNote, PersonalBest, Session, SkillAssessment, Student, Timing,
)

RATING_LABELS = {1: "Beginner", 2: "Elementary", 3: "Intermediate", 4: "Advanced", 5: "Elite"}


def _age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _attendance_window(rows, since: date | None):
    windowed = [r for r in rows if since is None or r["date"] >= since]
    total = len(windowed)
    attended = sum(1 for r in windowed if r["status"] == "present")
    return {
        "total": total,
        "attended": attended,
        "percentage": round(attended / total * 100, 1) if total else 0.0,
    }


def build_progress_report(db: DBSession, student: Student, from_date: date | None, to_date: date | None) -> dict:
    today = date.today()

    # ── Attendance ──
    att_rows = (
        db.query(Attendance, Session)
        .join(Session, Attendance.session_id == Session.id)
        .filter(Attendance.student_id == student.id)
        .order_by(Session.session_date.asc(), Session.session_type.asc())
        .all()
    )
    rows = [{"date": s.session_date, "status": a.status} for a, s in att_rows]

    streak = 0
    for r in reversed(rows):
        if r["status"] == "present":
            streak += 1
        else:
            break

    attendance = {
        "last_7_days": _attendance_window(rows, today - timedelta(days=7)),
        "last_30_days": _attendance_window(rows, today - timedelta(days=30)),
        "all_time": _attendance_window(rows, None),
        "current_streak": streak,
    }

    # ── Personal bests ──
    pbs = db.query(PersonalBest).filter_by(student_id=student.id).all()
    personal_bests = [
        {
            "style": pb.swim_style.name,
            "style_short": pb.swim_style.short_code,
            "distance": pb.distance_event.label,
            "best_time": pb.best_time_seconds,
            "previous_best": pb.previous_best,
            "improvement": round(pb.previous_best - pb.best_time_seconds, 2) if pb.previous_best else None,
            "achieved_at": pb.achieved_at.date().isoformat(),
        }
        for pb in pbs
    ]

    # ── Timing trends ──
    timings_q = (
        db.query(Timing, Session)
        .join(Session, Timing.session_id == Session.id)
        .filter(Timing.student_id == student.id)
    )
    if from_date:
        timings_q = timings_q.filter(Session.session_date >= from_date)
    if to_date:
        timings_q = timings_q.filter(Session.session_date <= to_date)
    timings = timings_q.order_by(Session.session_date.asc()).all()

    trends: dict[str, dict] = {}
    for t, s in timings:
        key = f"{t.swim_style.short_code}_{t.distance_event.label}"
        trends.setdefault(key, {
            "label": f"{t.swim_style.name} {t.distance_event.label}",
            "data": [],
        })["data"].append({
            "date": s.session_date.isoformat(),
            "time": t.time_seconds,
            "session_type": s.session_type,
        })

    # ── Skill ratings ──
    assessments = (
        db.query(SkillAssessment)
        .filter_by(student_id=student.id)
        .order_by(SkillAssessment.assessed_at.asc())
        .all()
    )
    skill_ratings: dict[str, dict] = {}
    for a in assessments:
        style = a.swim_style.name
        entry = skill_ratings.setdefault(style, {"current": None, "label": None, "history": []})
        entry["history"].append({"date": a.assessed_at.date().isoformat(), "rating": a.rating})
        entry["current"] = a.rating
        entry["label"] = RATING_LABELS[a.rating]

    # ── Recent notes ──
    notes = (
        db.query(CoachNote)
        .filter_by(student_id=student.id)
        .order_by(CoachNote.created_at.desc())
        .limit(20)
        .all()
    )
    recent_notes = [
        {
            "date": n.created_at.date().isoformat(),
            "coach": n.coach.name if n.coach else "",
            "category": n.category,
            "note": n.note,
        }
        for n in notes
    ]

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "age": _age(student.date_of_birth),
            "date_of_birth": student.date_of_birth.isoformat(),
            "enrolled_since": student.created_at.date().isoformat(),
        },
        "attendance": attendance,
        "personal_bests": personal_bests,
        "timing_trends": trends,
        "skill_ratings": skill_ratings,
        "recent_notes": recent_notes,
    }
