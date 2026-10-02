from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.course import Course, Enrollment
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.api.deps import get_current_user
from app.api.access import require_course_access
from app.services.report_generator import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/export")
def export_attendance_report(
    course_id: str,
    format: str = Query("excel", pattern="^(excel|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    require_course_access(course, current_user)

    faculty_name = course.faculty.full_name if course.faculty else "Faculty Lead"

    # Get sessions ordered by date
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.course_id == course.id,
        AttendanceSession.status == "completed"
    ).order_by(AttendanceSession.session_date.asc()).all()

    session_dates = [s.session_date.strftime("%d-%b") for s in sessions]
    session_ids = [s.id for s in sessions]

    # Get enrolled students
    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course.id).all()
    
    students_data = []
    for enr in enrollments:
        st = enr.student
        statuses = []
        attended_cnt = 0
        
        for sess in sessions:
            rec = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == sess.id,
                AttendanceRecord.student_id == st.id
            ).first()
            
            status_val = rec.status if rec else "not_enrolled"
            if status_val == "present":
                attended_cnt += 1
            statuses.append(status_val)

        students_data.append({
            "enrollment_no": st.enrollment_no,
            "full_name": st.full_name,
            "session_statuses": statuses,
            "attended": attended_cnt,
            "total": sum(status != "not_enrolled" for status in statuses)
        })

    # Sort students by enrollment number
    students_data.sort(key=lambda x: x["enrollment_no"])

    if format == "excel":
        buffer = report_service.generate_excel_report(
            course_name=course.course_name,
            course_code=course.course_code,
            faculty_name=faculty_name,
            students_data=students_data,
            session_dates=session_dates
        )
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"BPIT_{course.course_code}_Attendance.xlsx"
    else:
        buffer = report_service.generate_pdf_report(
            course_name=course.course_name,
            course_code=course.course_code,
            faculty_name=faculty_name,
            students_data=students_data,
            total_classes=len(sessions)
        )
        media_type = "application/pdf"
        filename = f"BPIT_{course.course_code}_Attendance.pdf"

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
