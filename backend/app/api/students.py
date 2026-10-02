import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Student
from app.models.course import Course, Enrollment, TimetableEntry
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.verification import Dispute
from app.schemas.student import (
    StudentProfileResponse, StudentProfileUpdate,
    CourseAttendanceSummary, StudentOverallAttendance,
    SessionHistoryItem, TimetableCreate, TimetableResponse,
    DisputeCreate, DisputeResponse
)
from app.api.deps import get_current_user
from app.api.access import resolve_student
from app.services.face_recognition import face_service

router = APIRouter(prefix="/students", tags=["Students"])

def calculate_bunk_and_recovery(attended: int, total: int):
    """Calculates safe bunk buffer and classes needed to recover to 75%."""
    if total == 0:
        return 0, 0, 100.0, "safe"
    pct = round((attended / total) * 100, 1)
    if attended / total >= 0.75:
        # How many classes can be missed: attended / (total + k) >= 0.75
        safe_bunk = max(0, math.floor((attended - 0.75 * total) / 0.75))
        recovery = 0
        status_label = "safe" if pct >= 80.0 else "warning"
    else:
        safe_bunk = 0
        # How many consecutive classes needed: (attended + m) / (total + m) >= 0.75
        # m >= (0.75 * total - attended) / 0.25 = 3 * total - 4 * attended
        recovery = max(1, math.ceil(3 * total - 4 * attended))
        status_label = "critical"
    return safe_bunk, recovery, pct, status_label

@router.get("/{student_id}/profile", response_model=StudentProfileResponse)
def get_student_profile(student_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = resolve_student(db, student_id, current_user)
    student_id = student.id
    
    return StudentProfileResponse(
        id=student.id,
        user_id=student.user_id,
        email=student.user.email,
        full_name=student.full_name,
        enrollment_no=student.enrollment_no,
        semester=student.semester,
        branch=student.branch,
        section=student.section,
        phone=student.phone,
        face_enrolled=student.face_enrolled and student.face_model == face_service.model_name,
        photo_url=student.photo_url
    )

@router.put("/{student_id}/profile")
def update_student_profile(student_id: str, payload: StudentProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = resolve_student(db, student_id, current_user)
    student_id = student.id

    if payload.phone is not None:
        student.phone = payload.phone
    if payload.semester is not None:
        student.semester = payload.semester
    if payload.section is not None:
        student.section = payload.section

    db.commit()
    return {"message": "Profile updated successfully."}

@router.get("/{student_id}/attendance", response_model=StudentOverallAttendance)
def get_student_attendance(student_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student = resolve_student(db, student_id, current_user)
    student_id = student.id

    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()

    course_summaries = []
    grand_total_classes = 0
    grand_total_attended = 0

    for enr in enrollments:
        course = enr.course
        # Get all sessions for this course
        sessions = db.query(AttendanceSession).filter(AttendanceSession.course_id == course.id, AttendanceSession.status == "completed").all()
        session_ids = [s.id for s in sessions]
        
        # Get student records for these sessions
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.session_id.in_(session_ids)
        ).all() if session_ids else []

        attended_count = sum(1 for r in records if r.status == "present")
        total_conducted = len(records)

        safe_bunk, recovery, pct, status_label = calculate_bunk_and_recovery(attended_count, total_conducted)

        faculty_name = course.faculty.full_name if course.faculty else "Faculty"

        course_summaries.append(CourseAttendanceSummary(
            course_id=course.id,
            course_code=course.course_code,
            course_name=course.course_name,
            faculty_name=faculty_name,
            total_classes=total_conducted,
            attended_classes=attended_count,
            percentage=pct,
            status=status_label,
            safe_bunk_count=safe_bunk,
            classes_needed_to_recover=recovery
        ))

        grand_total_classes += total_conducted
        grand_total_attended += attended_count

    overall_pct = round((grand_total_attended / grand_total_classes * 100), 1) if grand_total_classes > 0 else 100.0

    return StudentOverallAttendance(
        total_conducted=grand_total_classes,
        total_attended=grand_total_attended,
        overall_percentage=overall_pct,
        at_risk=grand_total_classes > 0 and grand_total_attended / grand_total_classes < 0.75,
        courses=course_summaries
    )

@router.get("/{student_id}/sessions", response_model=List[SessionHistoryItem])
def get_student_session_history(student_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student_id = resolve_student(db, student_id, current_user).id
    records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).order_by(AttendanceRecord.marked_at.desc()).all()

    items = []
    for r in records:
        session = r.session
        course = session.course
        dispute = db.query(Dispute).filter(Dispute.attendance_record_id == r.id).first()

        items.append(SessionHistoryItem(
            record_id=r.id,
            session_id=session.id,
            course_code=course.course_code,
            course_name=course.course_name,
            session_date=session.session_date,
            session_type=session.session_type,
            status=r.status,
            confidence_score=r.confidence_score,
            auto_marked=r.auto_marked,
            faculty_verified=r.faculty_verified,
            dispute_status=dispute.status if dispute else None
        ))

    return items

@router.get("/{student_id}/timetable", response_model=List[TimetableResponse])
def get_student_timetable(student_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student_id = resolve_student(db, student_id, current_user).id
    entries = db.query(TimetableEntry).filter(TimetableEntry.student_id == student_id).all()
    res = []
    for e in entries:
        res.append(TimetableResponse(
            id=e.id,
            course_id=e.course_id,
            course_code=e.course.course_code,
            course_name=e.course.course_name,
            day_of_week=e.day_of_week,
            start_time=e.start_time,
            end_time=e.end_time,
            room=e.room,
            session_type=e.session_type
        ))
    return res

@router.post("/{student_id}/timetable", response_model=TimetableResponse)
def add_timetable_entry(student_id: str, payload: TimetableCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    student_id = resolve_student(db, student_id, current_user).id
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    new_entry = TimetableEntry(
        student_id=student_id,
        course_id=payload.course_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room=payload.room or course.room,
        session_type=payload.session_type or "Lecture"
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return TimetableResponse(
        id=new_entry.id,
        course_id=new_entry.course_id,
        course_code=course.course_code,
        course_name=course.course_name,
        day_of_week=new_entry.day_of_week,
        start_time=new_entry.start_time,
        end_time=new_entry.end_time,
        room=new_entry.room,
        session_type=new_entry.session_type
    )

@router.post("/disputes", response_model=DisputeResponse)
def raise_attendance_dispute(payload: DisputeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == payload.attendance_record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    resolve_student(db, record.student_id, current_user)
    if record.status != "absent":
        raise HTTPException(status_code=400, detail="Only absent records can be disputed.")
    existing = db.query(Dispute).filter(Dispute.attendance_record_id == payload.attendance_record_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A dispute has already been submitted for this session.")

    new_dispute = Dispute(
        attendance_record_id=record.id,
        student_id=record.student_id,
        reason=payload.reason,
        status="pending"
    )
    db.add(new_dispute)
    db.commit()
    db.refresh(new_dispute)

    session = record.session
    return DisputeResponse(
        id=new_dispute.id,
        attendance_record_id=new_dispute.attendance_record_id,
        student_id=new_dispute.student_id,
        course_name=session.course.course_name,
        session_date=session.session_date,
        reason=new_dispute.reason,
        status=new_dispute.status,
        raised_at=new_dispute.raised_at
    )
