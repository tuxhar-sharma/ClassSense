from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import require_role
from app.api.access import require_course_access
from app.models.user import User
from app.models.course import Course, TimetableEntry
from app.models.attendance import AttendanceWindow, AttendanceRecord, AbsenceAlert
from app.services.session_windows import sync_windows, save_absence_alerts, CAMPUS_TZ

router = APIRouter()

class ExtraClass(BaseModel):
    starts_at: datetime
    ends_at: datetime
    session_type: Literal["Lecture", "Lab", "Tutorial"] = "Lecture"

@router.get("/courses/{course_id}/windows")
def windows(course_id: str, user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "Course not found")
    require_course_access(course, user)
    sync_windows(db)
    return [{"id": w.id, "starts_at": w.starts_at.isoformat()+"Z", "ends_at": w.ends_at.isoformat()+"Z",
        "source": w.source, "session_id": w.session_id,
        "open": w.starts_at <= datetime.utcnow() < w.ends_at}
        for w in db.query(AttendanceWindow).filter(AttendanceWindow.course_id == course_id,
            AttendanceWindow.ends_at > datetime.utcnow()).order_by(AttendanceWindow.starts_at).all()]

@router.post("/courses/{course_id}/extra-classes")
def extra_class(course_id: str, payload: ExtraClass, user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "Course not found")
    require_course_access(course, user)
    if not course.faculty_id or not course.enrollments:
        raise HTTPException(400, "Assign faculty and enroll students before scheduling a class.")
    if payload.starts_at.tzinfo is None or payload.ends_at.tzinfo is None:
        raise HTTPException(422, "Include a timezone for extra-class times.")
    start = payload.starts_at.astimezone(timezone.utc).replace(tzinfo=None)
    end = payload.ends_at.astimezone(timezone.utc).replace(tzinfo=None)
    if end <= start or end <= datetime.utcnow() or (end-start).total_seconds() > 12*3600:
        raise HTTPException(400, "Choose a valid upcoming window of at most 12 hours.")
    local_start = start.replace(tzinfo=timezone.utc).astimezone(CAMPUS_TZ)
    local_end = end.replace(tzinfo=timezone.utc).astimezone(CAMPUS_TZ)
    for day in {local_start.date(), local_end.date()}:
        for slot in db.query(TimetableEntry).filter_by(course_id=course_id, day_of_week=day.strftime("%A")).all():
            slot_start = datetime.fromisoformat(f"{day}T{slot.start_time}").replace(tzinfo=CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)
            slot_end = datetime.fromisoformat(f"{day}T{slot.end_time}").replace(tzinfo=CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)
            if slot_start < end and slot_end > start:
                raise HTTPException(409, "This extra class overlaps a timetable period.")
    sync_windows(db)
    if db.query(AttendanceWindow).filter(AttendanceWindow.course_id == course_id,
        AttendanceWindow.starts_at < end, AttendanceWindow.ends_at > start).first():
        raise HTTPException(409, "This class overlaps an existing attendance window.")
    db.add(AttendanceWindow(course_id=course_id, starts_at=start, ends_at=end,
        source="extra", session_type=payload.session_type))
    db.commit()
    sync_windows(db)
    return {"message": "Extra class scheduled."}

@router.get("/students/notifications")
def notifications(user: User = Depends(require_role(["student"])), db: Session = Depends(get_db)):
    save_absence_alerts(db, user.student_profile.id)
    db.commit()
    alerts = db.query(AbsenceAlert).filter_by(student_id=user.student_profile.id).order_by(AbsenceAlert.created_at.desc()).limit(100).all()
    result = []
    for alert in alerts:
        record = db.get(AttendanceRecord, alert.record_id)
        if record.status != "absent":
            continue
        result.append({"id": alert.id, "record_id": record.id, "read": alert.read_at is not None,
            "message": f"Marked absent in {record.session.course.course_name}. Were you present during the photos? Request a correction.",
            "disputed": any(d.status == "pending" for d in record.disputes)})
    return result

@router.post("/students/notifications/{alert_id}/read")
def read_notification(alert_id: str, user: User = Depends(require_role(["student"])), db: Session = Depends(get_db)):
    alert = db.query(AbsenceAlert).filter_by(id=alert_id, student_id=user.student_profile.id).first()
    if not alert:
        raise HTTPException(404, "Notification not found")
    alert.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Read"}
