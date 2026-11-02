"""Timetable windows use Indian campus time; persisted timestamps are UTC."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.exc import IntegrityError
from app.models.attendance import AttendanceSession, AttendanceWindow, AttendanceRecord, AbsenceAlert
from app.models.course import Course, TimetableEntry

CAMPUS_TZ = timezone(timedelta(hours=5, minutes=30))

def sync_windows(db, now=None):
    now = now or datetime.utcnow()
    local = now.replace(tzinfo=timezone.utc).astimezone(CAMPUS_TZ)
    slots = db.query(TimetableEntry.course_id, TimetableEntry.start_time,
        TimetableEntry.end_time, TimetableEntry.session_type).filter(
        TimetableEntry.day_of_week == local.strftime("%A")).distinct().all()
    for course_id, start, end, kind in slots:
        course = db.get(Course, course_id)
        if not course.faculty_id or not course.enrollments:
            continue
        try:
            starts = datetime.fromisoformat(f"{local.date()}T{start}").replace(tzinfo=CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)
            ends = datetime.fromisoformat(f"{local.date()}T{end}").replace(tzinfo=CAMPUS_TZ).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            continue
        if ends <= starts or now >= ends:
            continue
        key = f"{course_id}:{local.date()}:{start}:{end}:{kind}"
        if not db.query(AttendanceWindow).filter_by(slot_key=key).first():
            try:
                with db.begin_nested():
                    db.add(AttendanceWindow(course_id=course_id, starts_at=starts, ends_at=ends,
                        session_type=kind, slot_key=key))
                    db.flush()
            except IntegrityError:
                pass
    for window in db.query(AttendanceWindow).filter(AttendanceWindow.starts_at <= now,
            AttendanceWindow.ends_at > now, AttendanceWindow.session_id.is_(None)).all():
        course = db.get(Course, window.course_id)
        if not course.faculty_id or not course.enrollments:
            continue
        session = AttendanceSession(course_id=course.id, faculty_id=course.faculty_id,
            session_date=window.starts_at, session_type=window.session_type, image_count=0, status="in_progress")
        db.add(session)
        db.flush()
        claimed = db.query(AttendanceWindow).filter(AttendanceWindow.id == window.id,
            AttendanceWindow.session_id.is_(None)).update({AttendanceWindow.session_id: session.id}, synchronize_session=False)
        if not claimed:
            db.delete(session)
    for window in db.query(AttendanceWindow).filter(AttendanceWindow.ends_at <= now,
            AttendanceWindow.session_id.isnot(None)).all():
        session = db.get(AttendanceSession, window.session_id)
        if session and session.status == "in_progress":
            session.status = "expired"
    db.commit()

def save_absence_alerts(db, student_id=None):
    db.flush()
    query = db.query(AttendanceRecord).outerjoin(AbsenceAlert, AbsenceAlert.record_id == AttendanceRecord.id).filter(AttendanceRecord.status == "absent", AbsenceAlert.id.is_(None))
    if student_id:
        query = query.filter(AttendanceRecord.student_id == student_id)
    records = query.all()
    for record in records:
        if not db.query(AbsenceAlert).filter_by(record_id=record.id).first():
            try:
                with db.begin_nested():
                    db.add(AbsenceAlert(record_id=record.id, student_id=record.student_id))
                    db.flush()
            except IntegrityError:
                pass
