import csv
import io
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, Student, Faculty, Admin, FacultyWhitelist
from app.models.course import Course, Enrollment, TimetableEntry
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceWindow
from app.models.verification import AuditLog
from app.schemas.admin import (
    FacultyWhitelistItem, PendingFacultyResponse, FacultyApproveReject,
    CourseCreate, AuditLogItemResponse, AdminStatsResponse, CourseTimetableUpdate
)
from app.api.deps import get_current_user, require_role, get_password_hash

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/courses/{course_id}/timetable")
def get_course_timetable(course_id: str, current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    slots = db.query(TimetableEntry.day_of_week, TimetableEntry.start_time, TimetableEntry.end_time,
        TimetableEntry.room, TimetableEntry.session_type).filter(TimetableEntry.course_id == course_id).distinct().all()
    return [dict(slot._mapping) for slot in slots]

@router.put("/courses/{course_id}/timetable")
def update_course_timetable(course_id: str, payload: CourseTimetableUpdate, current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    students = [enrollment.student_id for enrollment in course.enrollments]
    if not students:
        raise HTTPException(status_code=400, detail="Import this course's roster before setting its timetable.")
    seen = set()
    for slot in payload.slots:
        if slot.end_time <= slot.start_time:
            raise HTTPException(status_code=400, detail="Each session must end after it starts.")
        key = (slot.day_of_week, slot.start_time, slot.end_time)
        if key in seen:
            raise HTTPException(status_code=400, detail="Remove duplicate timetable slots.")
        seen.add(key)
    for window in db.query(AttendanceWindow).filter_by(course_id=course_id, source="timetable").all():
        if window.session_id:
            session = db.get(AttendanceSession, window.session_id)
            if session.status == "in_progress":
                session.status = "expired"
        db.delete(window)
    db.query(TimetableEntry).filter(TimetableEntry.course_id == course_id).delete()
    for student_id in students:
        for slot in payload.slots:
            db.add(TimetableEntry(student_id=student_id, course_id=course_id, **slot.model_dump()))
    db.commit()
    return {"message": f"Timetable saved for {len(students)} enrolled students."}

@router.get("/faculty")
def list_verified_faculty(current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    return [{"id": faculty.id, "full_name": faculty.full_name, "email": faculty.user.email}
            for faculty in db.query(Faculty).filter(Faculty.id_verified == True).order_by(Faculty.full_name).all()]

@router.put("/courses/{course_id}")
def update_course(course_id: str, payload: CourseCreate, current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    validate_course(payload, db)
    class_fields = (payload.branch.strip().lower(), payload.semester.strip().lower(), payload.section.strip().lower())
    if all(class_fields) and any((enrollment.student.branch.strip().lower(), enrollment.student.semester.strip().lower(), enrollment.student.section.strip().lower()) != class_fields for enrollment in course.enrollments):
        raise HTTPException(status_code=400, detail="These class details do not match students already enrolled. Create a separate course for another class.")
    if db.query(Course).filter(Course.course_code == payload.course_code, Course.id != course_id).first():
        raise HTTPException(status_code=400, detail="Course code already exists.")
    for field in ("course_code", "course_name", "faculty_id", "room", "credits", "branch", "semester", "section"):
        value = getattr(payload, field)
        setattr(course, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return {"message": "Course updated successfully."}


def validate_course(payload, db):
    if payload.faculty_id:
        faculty = db.query(Faculty).filter(Faculty.id == payload.faculty_id, Faculty.id_verified == True).first()
        if not faculty:
            raise HTTPException(status_code=400, detail="Choose an approved faculty member.")

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    tot_students = db.query(Student).count()
    tot_faculty = db.query(Faculty).count()
    pending_approvals = db.query(Faculty).filter(Faculty.id_verified == False).count()
    tot_courses = db.query(Course).count()
    tot_sessions = db.query(AttendanceSession).filter(AttendanceSession.status == "completed").count()

    total_records = db.query(AttendanceRecord).count()
    present_records = db.query(AttendanceRecord).filter(AttendanceRecord.status == "present").count()
    avg_att = round((present_records / total_records * 100), 1) if total_records > 0 else 0.0

    return AdminStatsResponse(
        total_students=tot_students,
        total_faculty=tot_faculty,
        pending_faculty_approvals=pending_approvals,
        total_courses=tot_courses,
        total_attendance_sessions=tot_sessions,
        average_system_attendance=avg_att
    )

@router.post("/faculty-list/upload")
async def upload_faculty_whitelist(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Upload a UTF-8 CSV file.")
    csv_reader = csv.DictReader(io.StringIO(decoded))
    
    count = 0
    rows = list(csv_reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV must contain faculty records with employee_id, email and full_name columns.")
    for line, row in enumerate(rows, start=2):
        emp_id = row.get("employee_id") or row.get("Employee ID") or row.get("emp_id")
        email = row.get("email") or row.get("Email")
        name = row.get("full_name") or row.get("Name") or row.get("name")
        dept = row.get("department") or row.get("Department") or "Information Technology"
        desig = row.get("designation") or row.get("Designation") or "Assistant Professor"

        if not all(value and value.strip() for value in (emp_id, email, name)):
            raise HTTPException(status_code=400, detail=f"CSV row {line} requires employee_id, email and full_name.")
        emp_id, email, name = emp_id.strip(), email.strip().lower(), name.strip()
        try:
            TypeAdapter(EmailStr).validate_python(email)
        except ValidationError:
            raise HTTPException(status_code=400, detail=f"CSV row {line} has an invalid email address.")
        existing = db.query(FacultyWhitelist).filter(FacultyWhitelist.employee_id == emp_id).first()
        email_owner = db.query(FacultyWhitelist).filter(FacultyWhitelist.email == email).first()
        if (existing and existing.email != email) or (email_owner and email_owner.employee_id != emp_id):
            raise HTTPException(status_code=400, detail=f"CSV row {line} conflicts with an existing employee ID or email.")
        if not existing:
            db.add(FacultyWhitelist(employee_id=emp_id, email=email, full_name=name,
                department=dept.strip(), designation=desig.strip()))
            db.flush()
            count += 1
    db.commit()
    return {"message": f"Successfully imported {count} faculty whitelist records."}

@router.get("/faculty-verification-queue", response_model=List[PendingFacultyResponse])
def get_pending_faculty_queue(current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    pending = db.query(Faculty).filter(Faculty.id_verified == False).all()
    res = []
    for f in pending:
        res.append(PendingFacultyResponse(
            id=f.id,
            user_id=f.user_id,
            full_name=f.full_name,
            email=f.user.email,
            employee_id=f.employee_id,
            designation=f.designation,
            department=f.department,
            id_card_url=f.id_card_url,
            created_at=f.user.created_at,
            id_verified=f.id_verified
        ))
    return res

@router.post("/faculty-verification-queue/{faculty_id}/approve")
def approve_faculty(
    faculty_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found.")

    faculty.id_verified = True
    db.commit()
    return {"message": f"Faculty {faculty.full_name} approved successfully."}

@router.post("/faculty-verification-queue/{faculty_id}/reject")
def reject_faculty(
    faculty_id: str,
    payload: FacultyApproveReject,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found.")

    user = faculty.user
    if faculty.id_verified:
        raise HTTPException(status_code=409, detail="Only pending registrations can be rejected.")
    db.delete(faculty)
    db.delete(user)
    db.commit()
    return {"message": f"Faculty registration rejected and account removed."}

@router.get("/courses")
def get_all_courses(current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    courses = db.query(Course).all()
    res = []
    for c in courses:
        enrolled_cnt = db.query(Enrollment).filter(Enrollment.course_id == c.id).count()
        res.append({
            "id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "faculty_name": c.faculty.full_name if c.faculty else "Unassigned",
            "faculty_id": c.faculty_id,
            "room": c.room,
            "credits": c.credits,
            "enrolled_count": enrolled_cnt,
             "branch": c.branch, "semester": c.semester, "section": c.section
        })
    return res

@router.post("/courses")
def create_course(payload: CourseCreate, current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    validate_course(payload, db)
    existing = db.query(Course).filter(Course.course_code == payload.course_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course code already exists.")

    new_course = Course(
        course_code=payload.course_code,
        course_name=payload.course_name,
        faculty_id=payload.faculty_id,
        room=payload.room or "LH-204",
        credits=payload.credits or 4,
         branch=payload.branch.strip(), semester=payload.semester.strip(), section=payload.section.strip()
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return {"message": "Course created successfully.", "course_id": new_course.id}

@router.post("/rosters/upload")
async def bulk_upload_roster(
    course_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    contents = await file.read()
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Upload a UTF-8 CSV file.")
    csv_reader = csv.DictReader(io.StringIO(decoded))

    enrolled_count = 0
    unknown = []
    seen = set()
    for row in csv_reader:
        enroll_no = row.get("enrollment_no") or row.get("Enrollment No") or row.get("roll_no")
        if enroll_no:
            enroll_no = enroll_no.strip()
            if enroll_no in seen:
                continue
            seen.add(enroll_no)
            student = db.query(Student).filter(Student.enrollment_no == enroll_no.strip()).first()
            if student:
                # Check if already enrolled
                existing = db.query(Enrollment).filter(
                    Enrollment.student_id == student.id,
                    Enrollment.course_id == course.id
                ).first()
                if not existing:
                    enr = Enrollment(student_id=student.id, course_id=course.id)
                    db.add(enr)
                    template = db.query(TimetableEntry).filter(TimetableEntry.course_id == course.id).first()
                    if template:
                        slots = db.query(TimetableEntry).filter(TimetableEntry.course_id == course.id, TimetableEntry.student_id == template.student_id).all()
                        for slot in slots:
                            db.add(TimetableEntry(student_id=student.id, course_id=course.id, day_of_week=slot.day_of_week, start_time=slot.start_time, end_time=slot.end_time, room=slot.room, session_type=slot.session_type))
                    enrolled_count += 1
            else:
                unknown.append(enroll_no)
    if not seen:
        raise HTTPException(status_code=400, detail="CSV requires an enrollment_no column with student enrollment numbers.")
    db.commit()
    return {"message": f"Enrolled {enrolled_count} students into {course.course_name}. {len(unknown)} unknown enrollment numbers skipped.", "unknown_enrollment_numbers": unknown}

@router.get("/audit-logs", response_model=List[AuditLogItemResponse])
def get_audit_logs(current_user: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.changed_at.desc()).limit(100).all()
    res = []
    for l in logs:
        rec = l.record
        student_name = rec.student.full_name if rec and rec.student else "Student"
        course_name = rec.session.course.course_name if rec and rec.session and rec.session.course else "Course"
        changer_name = l.changer.email if l.changer else "System"

        res.append(AuditLogItemResponse(
            id=l.id,
            attendance_record_id=l.attendance_record_id,
            student_name=student_name,
            course_name=course_name,
            changed_by_name=changer_name,
            old_value=l.old_value,
            new_value=l.new_value,
            reason=l.reason,
            changed_at=l.changed_at
        ))
    return res
