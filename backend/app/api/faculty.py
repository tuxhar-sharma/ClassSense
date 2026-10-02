from datetime import datetime
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.user import User, Faculty, Student
from app.models.course import Course, Enrollment, TimetableEntry
from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceSessionRevision
from app.models.verification import VerificationQueue, Dispute, AuditLog
from app.schemas.faculty import (
    FacultyProfileResponse, CourseItemResponse, SessionCreate,
    SessionCaptureRequest, SessionResultsResponse, StudentMatchResult,
    VerificationQueueItemResponse, VerificationResolveRequest,
    AttendanceOverrideRequest, FacultyAnalyticsResponse, TrendPoint, AtRiskStudentItem, DisputeResolveRequest, CourseEnrollmentRequest, SessionRetakeRequest
)
from app.api.deps import get_current_user, require_role
from app.api.access import resolve_faculty, require_course_access
from app.services.aggregation import aggregation_service
from app.services.face_recognition import face_service, RecognitionUnavailable

router = APIRouter(tags=["Faculty"])

@router.get("/courses/{course_id}/sessions")
def list_course_sessions(course_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    owned_course(course_id, current_user, db)
    sessions = db.query(AttendanceSession).filter(AttendanceSession.course_id == course_id).order_by(AttendanceSession.session_date.desc()).all()
    return [{"session_id": session.id, "session_date": session.session_date, "session_type": session.session_type,
        "status": session.status, "revision": session.revision, "image_count": session.image_count,
        "total_students": len(session.records),
        "present_count": sum(record.status == "present" for record in session.records),
        "absent_count": sum(record.status == "absent" for record in session.records),
        "review_count": sum(record.status == "pending_review" for record in session.records)} for session in sessions]

@router.get("/sessions/{session_id}/revisions")
def session_revisions(session_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    require_course_access(session.course, current_user)
    return [{"revision": revision.revision, "reason": revision.reason, "replaced_at": revision.replaced_at,
        "snapshot": json.loads(revision.snapshot)} for revision in db.query(AttendanceSessionRevision).filter(
            AttendanceSessionRevision.session_id == session_id).order_by(AttendanceSessionRevision.revision.desc()).all()]

@router.post("/sessions/{session_id}/retake")
def retake_session(session_id: str, payload: SessionRetakeRequest, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    require_course_access(session.course, current_user)
    if session.status != "completed" or session.revision != payload.expected_revision:
        raise HTTPException(status_code=409, detail="This session changed. Reload its results before retaking attendance.")
    if len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Explain why attendance is being retaken.")
    records = session.records
    if not records:
        raise HTTPException(status_code=400, detail="This session has no saved student roster to retake.")
    students = [{"id": record.student_id, "face_embedding": record.student.face_embedding if record.student.face_model == face_service.model_name else None} for record in records]
    try:
        result = aggregation_service.aggregate_session_capture(payload.images, students)
    except RecognitionUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    changed = db.query(AttendanceSession).filter(AttendanceSession.id == session_id,
        AttendanceSession.revision == payload.expected_revision, AttendanceSession.status == "completed").update(
            {AttendanceSession.revision: payload.expected_revision + 1}, synchronize_session=False)
    if not changed:
        db.rollback()
        raise HTTPException(status_code=409, detail="This session changed. Reload its results before retaking attendance.")
    snapshot = {"image_count": session.image_count, "records": [{"record_id": record.id,
        "student_id": record.student_id, "full_name": record.student.full_name, "enrollment_no": record.student.enrollment_no,
        "status": record.status, "confidence_score": record.confidence_score, "appearances": record.appearances,
        "faculty_verified": record.faculty_verified, "auto_marked": record.auto_marked} for record in records]}
    db.add(AttendanceSessionRevision(session_id=session.id, revision=payload.expected_revision,
        snapshot=json.dumps(snapshot), reason=payload.reason.strip(), replaced_by=current_user.id))
    by_student = {record.student_id: record for record in records}
    for replacement in result["attendance_records"]:
        record = by_student[replacement["student_id"]]
        db.add(AuditLog(attendance_record_id=record.id, changed_by=current_user.id,
            old_value=record.status, new_value=replacement["status"],
            reason=f"Attendance retake v{payload.expected_revision + 1}: {payload.reason.strip()}"))
        for field in ("status", "confidence_score", "appearances", "faculty_verified", "auto_marked"):
            setattr(record, field, replacement[field])
        record.marked_at = datetime.utcnow()
    db.query(VerificationQueue).filter(VerificationQueue.session_id == session_id).delete(synchronize_session=False)
    for item in result["verification_queue_items"]:
        db.add(VerificationQueue(session_id=session_id, **item))
    session.image_count = len(payload.images)
    db.commit()
    return {"message": "Attendance retaken. Previous results saved and changes audited.", "revision": payload.expected_revision + 1}

def owned_course(course_id, current_user, db):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    require_course_access(course, current_user)
    return course

def matching_class_students(course, db):
    return db.query(Student).filter(
        func.lower(func.trim(Student.branch)) == course.branch.strip().lower(),
        func.lower(func.trim(Student.semester)) == course.semester.strip().lower(),
        func.lower(func.trim(Student.section)) == course.section.strip().lower())

@router.get("/courses/{course_id}/roster")
def get_course_roster(course_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = owned_course(course_id, current_user, db)
    configured = all(value.strip() for value in (course.branch, course.semester, course.section))
    enrolled = [enrollment.student for enrollment in course.enrollments]
    enrolled_ids = {student.id for student in enrolled}
    def public_student(student):
        return {"id": student.id, "full_name": student.full_name, "enrollment_no": student.enrollment_no,
            "branch": student.branch, "semester": student.semester, "section": student.section,
            "face_enrolled": student.face_enrolled and student.face_model == face_service.model_name}
    candidates = matching_class_students(course, db).order_by(Student.enrollment_no).all() if configured else []
    return {"course": {"id": course.id, "course_name": course.course_name, "course_code": course.course_code,
            "branch": course.branch, "semester": course.semester, "section": course.section, "room": course.room},
        "class_configured": configured,
        "enrolled_students": [public_student(student) for student in sorted(enrolled, key=lambda student: student.enrollment_no)],
        "eligible_students": [public_student(student) for student in candidates if student.id not in enrolled_ids]}

@router.post("/courses/{course_id}/enrollments")
def enroll_course_students(course_id: str, payload: CourseEnrollmentRequest, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = owned_course(course_id, current_user, db)
    if not all(value.strip() for value in (course.branch, course.semester, course.section)):
        raise HTTPException(status_code=400, detail="Ask your administrator to set this course's branch, semester and section first.")
    ids = set(payload.student_ids)
    students = matching_class_students(course, db).filter(Student.id.in_(ids)).all()
    if len(students) != len(ids):
        raise HTTPException(status_code=400, detail="Select only registered students belonging to this course's branch, semester and section.")
    enrolled = {enrollment.student_id for enrollment in course.enrollments}
    slots = db.query(TimetableEntry.day_of_week, TimetableEntry.start_time, TimetableEntry.end_time,
        TimetableEntry.room, TimetableEntry.session_type).filter(TimetableEntry.course_id == course.id).distinct().all()
    count = 0
    for student in students:
        if student.id in enrolled:
            continue
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        for slot in slots:
            db.add(TimetableEntry(course_id=course.id, student_id=student.id, **dict(slot._mapping)))
        count += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="The roster changed during enrollment. Refresh the class and try again.")
    return {"message": f"Enrolled {count} students in {course.course_name}.", "enrolled_count": count}

@router.get("/faculty/disputes")
def get_pending_disputes(current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    query = db.query(Dispute).join(AttendanceRecord).join(AttendanceSession).join(Course).filter(Dispute.status == "pending")
    if current_user.role == "faculty":
        query = query.filter(Course.faculty_id == current_user.faculty_profile.id)
    return [{
        "id": dispute.id,
        "student_name": dispute.student.full_name,
        "enrollment_no": dispute.student.enrollment_no,
        "course_name": dispute.record.session.course.course_name,
        "session_date": dispute.record.session.session_date,
        "reason": dispute.reason,
        "raised_at": dispute.raised_at,
    } for dispute in query.order_by(Dispute.raised_at.desc()).all()]

@router.post("/faculty/disputes/{dispute_id}/resolve")
def resolve_dispute(dispute_id: str, payload: DisputeResolveRequest, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found.")
    record = dispute.record
    require_course_access(record.session.course, current_user)
    if dispute.status != "pending":
        raise HTTPException(status_code=409, detail="This dispute has already been resolved.")
    if len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Provide a resolution reason of at least 3 characters.")
    old_status = record.status
    if payload.action == "approve":
        record.status = "present"
        record.faculty_verified = True
        record.auto_marked = False
    dispute.status = "approved" if payload.action == "approve" else "rejected"
    dispute.resolved_at = datetime.utcnow()
    db.add(AuditLog(attendance_record_id=record.id, changed_by=current_user.id,
        old_value=old_status, new_value=record.status,
        reason=f"Dispute {dispute.status}: {payload.reason.strip()}"))
    db.commit()
    return {"message": f"Dispute {dispute.status} and resolution saved."}

@router.get("/courses/{course_id}/attendance-records")
def get_course_attendance_records(course_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    require_course_access(course, current_user)
    records = db.query(AttendanceRecord).join(AttendanceSession).filter(
        AttendanceSession.course_id == course_id
    ).order_by(AttendanceSession.session_date.desc(), AttendanceRecord.marked_at.desc()).all()
    return [{
        "id": record.id,
        "full_name": record.student.full_name,
        "enrollment_no": record.student.enrollment_no,
        "status": record.status,
        "marked_at": record.session.session_date,
        "session_id": record.session_id,
    } for record in records]

@router.get("/faculty/{faculty_id}/courses", response_model=List[CourseItemResponse])
def get_faculty_courses(faculty_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    faculty_id = resolve_faculty(db, faculty_id, current_user).id
    courses = db.query(Course).filter(Course.faculty_id == faculty_id).all()
    res = []
    for c in courses:
        enrolled_cnt = db.query(Enrollment).filter(Enrollment.course_id == c.id).count()
        res.append(CourseItemResponse(
            id=c.id,
            course_code=c.course_code,
            course_name=c.course_name,
            room=c.room,
            credits=c.credits,
            enrolled_count=enrolled_cnt,
             branch=c.branch, semester=c.semester, section=c.section
        ))
    return res

@router.post("/sessions")
def start_attendance_session(payload: SessionCreate, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    faculty = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
    if not faculty:
        # If user is admin or course faculty
        faculty_id = course.faculty_id
    else:
        faculty_id = faculty.id

    require_course_access(course, current_user)
    if not course.faculty_id:
        raise HTTPException(status_code=400, detail="Assign a faculty member before starting a session.")
    session = AttendanceSession(
        course_id=course.id,
        faculty_id=faculty_id,
        session_date=datetime.utcnow(),
        session_type=payload.session_type,
        status="in_progress"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "course_id": course.id,
        "course_name": course.course_name,
        "session_type": session.session_type,
        "session_date": session.session_date
    }

@router.post("/sessions/{session_id}/capture")
def process_session_capture(
    session_id: str,
    payload: SessionCaptureRequest,
    current_user: User = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found.")

    require_course_access(session.course, current_user)
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Use the Retake attendance option for a completed session.")
    if not payload.images or len(payload.images) < 1:
        raise HTTPException(status_code=400, detail="At least 1-4 classroom images are required for processing.")

    # Fetch enrolled students for this course
    enrollments = db.query(Enrollment).filter(Enrollment.course_id == session.course_id).all()
    if not enrollments:
        raise HTTPException(status_code=400, detail="Enroll students in this course before taking attendance.")
    enrolled_data = []
    for enr in enrollments:
        s = enr.student
        enrolled_data.append({
            "id": s.id,
            "full_name": s.full_name,
            "enrollment_no": s.enrollment_no,
            "face_embedding": s.face_embedding if s.face_model == face_service.model_name else None,
            "photo_url": s.photo_url
        })

    # Execute Multi-Image Facial Recognition & Aggregation Pipeline
    try:
        result = aggregation_service.aggregate_session_capture(payload.images, enrolled_data)
    except RecognitionUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    # Delete any prior temporary records for this session if re-run
    db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).delete()
    db.query(VerificationQueue).filter(VerificationQueue.session_id == session.id).delete()

    # Save Attendance Records
    for rec in result["attendance_records"]:
        record = AttendanceRecord(
            session_id=session.id,
            student_id=rec["student_id"],
            status=rec["status"],
            confidence_score=rec["confidence_score"],
            faculty_verified=rec["faculty_verified"],
            auto_marked=rec["auto_marked"],
            appearances=rec["appearances"]
        )
        db.add(record)

    # Save Verification Queue Items (for low-confidence / conflicting detections)
    for q in result["verification_queue_items"]:
        queue_item = VerificationQueue(
            session_id=session.id,
            candidate_student_id=q["candidate_student_id"],
            similarity_score=q["similarity_score"],
            face_crop_data=q["face_crop_data"],
            resolution_status="pending"
        )
        db.add(queue_item)

    session.image_count = len(payload.images)
    session.status = "completed"
    db.commit()

    return {
        "message": "Classroom session images processed successfully.",
        "session_id": session.id,
        "summary": result["summary"]
    }

@router.get("/sessions/{session_id}/results", response_model=SessionResultsResponse)
def get_session_results(session_id: str, current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    require_course_access(session.course, current_user)
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    
    match_results = []
    present_cnt = 0
    absent_cnt = 0
    review_cnt = 0

    for r in records:
        student = r.student
        if r.status == "present":
            present_cnt += 1
        elif r.status == "pending_review":
            review_cnt += 1
        else:
            absent_cnt += 1

        match_results.append(StudentMatchResult(
            record_id=r.id, faculty_verified=r.faculty_verified,
            student_id=student.id,
            enrollment_no=student.enrollment_no,
            full_name=student.full_name,
            status=r.status,
            confidence_score=r.confidence_score,
            auto_marked=r.auto_marked,
            photo_url=student.photo_url,
            appearances=r.appearances
        ))

    return SessionResultsResponse(
        revision=session.revision, status=session.status, image_count=session.image_count,
        session_id=session.id,
        course_name=session.course.course_name,
        session_date=session.session_date,
        session_type=session.session_type,
        total_enrolled=len(records),
        present_count=present_cnt,
        absent_count=absent_cnt,
        review_count=review_cnt,
        records=match_results
    )

@router.get("/verification-queue", response_model=List[VerificationQueueItemResponse])
def get_verification_queue(current_user: User = Depends(require_role(["faculty", "admin"])), db: Session = Depends(get_db)):
    # If faculty, filter by faculty's courses
    faculty = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
    query = db.query(VerificationQueue).filter(VerificationQueue.resolution_status == "pending")

    if faculty:
        faculty_course_ids = [c.id for c in faculty.courses]
        query = query.join(AttendanceSession).filter(AttendanceSession.course_id.in_(faculty_course_ids))

    items = query.order_by(VerificationQueue.id.desc()).all()
    res = []
    for item in items:
        student = item.candidate_student
        session = item.session
        res.append(VerificationQueueItemResponse(
            id=item.id,
            session_id=item.session_id,
            course_code=session.course.course_code,
            course_name=session.course.course_name,
            session_date=session.session_date,
            candidate_student_id=student.id,
            candidate_name=student.full_name,
            candidate_enrollment_no=student.enrollment_no,
            candidate_photo_url=student.photo_url,
            similarity_score=item.similarity_score,
            face_crop_data=item.face_crop_data,
            resolution_status=item.resolution_status
        ))
    return res

@router.post("/verification-queue/{item_id}/resolve")
def resolve_verification_item(
    item_id: str,
    payload: VerificationResolveRequest,
    current_user: User = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    item = db.query(VerificationQueue).filter(VerificationQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Verification item not found.")

    require_course_access(item.session.course, current_user)
    if item.resolution_status != "pending":
        raise HTTPException(status_code=409, detail="Verification item already resolved.")
    if payload.action != "manual" and payload.assigned_student_id:
        raise HTTPException(status_code=400, detail="Student reassignment requires a manual action.")
    if payload.action == "manual" and not payload.assigned_student_id:
        raise HTTPException(status_code=400, detail="Select a student for manual assignment.")
    target_student_id = payload.assigned_student_id or item.candidate_student_id

    # Find the attendance record in this session
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == item.session_id,
        AttendanceRecord.student_id == target_student_id
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Selected student is not in this session.")

    candidate_record = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == item.session_id,
        AttendanceRecord.student_id == item.candidate_student_id).first()
    if not candidate_record or candidate_record.status != "pending_review":
        raise HTTPException(status_code=409, detail="Candidate attendance already changed. Refresh the queue.")

    if target_student_id != item.candidate_student_id:
        original = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == item.session_id,
            AttendanceRecord.student_id == item.candidate_student_id).first()
        if not original or original.status != "pending_review":
            raise HTTPException(status_code=409, detail="Candidate attendance already changed. Refresh the queue.")
        original.status = "absent"
        original.faculty_verified = True
        original.auto_marked = False
        db.add(AuditLog(attendance_record_id=original.id, changed_by=current_user.id,
            old_value="pending_review", new_value="absent", reason=f"Face manually assigned to student {target_student_id}"))

    old_status = record.status if record else "unknown"
    new_status = "present" if payload.action in ["confirm", "manual"] else "absent"

    if record:
        record.status = new_status
        record.faculty_verified = True
        record.auto_marked = False

        # Audit log entry
        audit = AuditLog(
            attendance_record_id=record.id,
            changed_by=current_user.id,
            old_value=old_status,
            new_value=new_status,
            reason=f"Verification queue action: {payload.action}"
        )
        db.add(audit)

    item.resolution_status = "confirmed" if payload.action == "confirm" else ("rejected" if payload.action == "reject" else "manual")
    item.resolved_by = current_user.id
    item.resolved_at = datetime.utcnow()
    db.commit()

    return {"message": f"Verification item resolved as {item.resolution_status}."}

@router.put("/attendance/{record_id}/override")
def override_attendance_record(
    record_id: str,
    payload: AttendanceOverrideRequest,
    current_user: User = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    require_course_access(record.session.course, current_user)
    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A mandatory justification reason is required for manual overrides.")

    old_val = record.status
    record.status = payload.new_status
    record.faculty_verified = True
    record.auto_marked = False

    # Immutable Audit Log
    audit = AuditLog(
        attendance_record_id=record.id,
        changed_by=current_user.id,
        old_value=old_val,
        new_value=payload.new_status,
        reason=payload.reason.strip()
    )
    db.add(audit)
    db.commit()

    return {"message": "Attendance record updated and logged to audit trail."}

@router.get("/faculty/{faculty_id}/analytics", response_model=FacultyAnalyticsResponse)
def get_faculty_analytics(
    faculty_id: str,
    course_id: Optional[str] = None,
    current_user: User = Depends(require_role(["faculty", "admin"])),
    db: Session = Depends(get_db)
):
    faculty_id = resolve_faculty(db, faculty_id, current_user).id
    query = db.query(AttendanceSession).filter(AttendanceSession.faculty_id == faculty_id)
    if course_id:
        query = query.filter(AttendanceSession.course_id == course_id)

    sessions = query.filter(AttendanceSession.status == "completed").order_by(AttendanceSession.session_date.asc()).all()

    trend_points = []
    total_present = 0
    total_marked = 0

    for idx, s in enumerate(sessions, 1):
        records = s.records
        p_cnt = sum(1 for r in records if r.status == "present")
        tot = len(records)
        rate = round((p_cnt / tot * 100), 1) if tot > 0 else 0.0
        date_label = s.session_date.strftime("%d %b") if s.session_date else f"S{idx}"
        trend_points.append(TrendPoint(
            label=date_label,
            attendance_rate=rate,
            total_sessions=1
        ))
        total_present += p_cnt
        total_marked += tot

    avg_rate = round((total_present / total_marked * 100), 1) if total_marked > 0 else 0.0

    # Find at-risk students (<75%)
    at_risk_list = []
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if faculty:
        for c in faculty.courses:
            if course_id and c.id != course_id:
                continue
            for enr in c.enrollments:
                st = enr.student
                st_recs = db.query(AttendanceRecord).join(AttendanceSession).filter(
                    AttendanceRecord.student_id == st.id,
                    AttendanceSession.course_id == c.id,
                    AttendanceSession.status == "completed"
                ).all()
                st_tot = len(st_recs)
                st_att = sum(1 for r in st_recs if r.status == "present")
                st_pct = round((st_att / st_tot * 100), 1) if st_tot > 0 else 100.0
                if st_tot > 0 and st_pct < 75.0:
                    needed = max(1, 3 * st_tot - 4 * st_att)
                    at_risk_list.append(AtRiskStudentItem(
                        student_id=st.id,
                        enrollment_no=st.enrollment_no,
                        full_name=st.full_name,
                        course_id=c.id,
                        course_name=c.course_name,
                        attended=st_att,
                        total=st_tot,
                        percentage=st_pct,
                        classes_needed=needed
                    ))

    total_enrolled = sum(len(c.enrollments) for c in faculty.courses) if faculty else 0

    return FacultyAnalyticsResponse(
        course_id=course_id,
        average_attendance=avg_rate,
        total_sessions_conducted=len(sessions),
        total_students_enrolled=total_enrolled,
        trends=trend_points,
        at_risk_students=at_risk_list
    )
