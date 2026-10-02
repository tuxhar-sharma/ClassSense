import io
import uuid
from datetime import datetime

import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User, Student, Faculty
from app.models.course import Course
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.verification import AuditLog, Dispute
from app.services.face_recognition import face_service

pytestmark = pytest.mark.usefixtures("demo_data")
client = TestClient(app)


def login(email, role):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": f"{role}123", "role": role})
    assert response.status_code == 200, response.text
    data = response.json()
    return data, {"Authorization": f"Bearer {data['access_token']}"}


def fresh_record():
    with SessionLocal() as db:
        student = db.query(Student).filter(Student.full_name == "Rohan Sharma").one()
        course = db.query(Course).filter(Course.course_code == "IT302").one()
        session = AttendanceSession(course_id=course.id, faculty_id=course.faculty_id, session_date=datetime.utcnow(), status="completed")
        db.add(session)
        db.flush()
        record = AttendanceRecord(session_id=session.id, student_id=student.id, status="absent")
        db.add(record)
        db.commit()
        return record.id, student.id, course.id


def test_login_ids_load_student_dashboard_and_faculty_courses():
    data, headers = login("rohan.sharma@bpitindia.edu.in", "student")
    response = client.get(f"/api/v1/students/{data['user_id']}/profile", headers=headers)
    assert response.status_code == 200
    student_id = response.json()["id"]
    assert student_id != data["user_id"]
    for endpoint in ("attendance", "sessions", "timetable"):
        assert client.get(f"/api/v1/students/{student_id}/{endpoint}", headers=headers).status_code == 200
    faculty, headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    courses = client.get(f"/api/v1/faculty/{faculty['user_id']}/courses", headers=headers)
    assert courses.status_code == 200
    assert {course["course_code"] for course in courses.json()} == {"IT302", "IT304"}


def test_students_cannot_access_other_students_or_admin_controls():
    _, headers = login("rohan.sharma@bpitindia.edu.in", "student")
    with SessionLocal() as db:
        other = db.query(Student).filter(Student.full_name == "Simran Kaur").one().id
    assert client.get(f"/api/v1/students/{other}/profile", headers=headers).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 403
    assert client.get("/api/v1/verification-queue", headers=headers).status_code == 403


def test_override_persists_and_creates_audit_entry():
    record_id, _, course_id = fresh_record()
    _, headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    response = client.put(f"/api/v1/attendance/{record_id}/override", headers=headers, json={"new_status": "present", "reason": "Verified classroom attendance"})
    assert response.status_code == 200
    records = client.get(f"/api/v1/courses/{course_id}/attendance-records", headers=headers).json()
    assert next(record for record in records if record["id"] == record_id)["status"] == "present"
    with SessionLocal() as db:
        audit = db.query(AuditLog).filter(AuditLog.attendance_record_id == record_id).one()
        assert (audit.old_value, audit.new_value) == ("absent", "present")
    assert client.put(f"/api/v1/attendance/{record_id}/override", headers=headers, json={"new_status": "invalid", "reason": "test"}).status_code == 422


def test_dispute_approval_changes_attendance_and_student_history():
    record_id, student_id, _ = fresh_record()
    _, student_headers = login("rohan.sharma@bpitindia.edu.in", "student")
    response = client.post("/api/v1/students/disputes", headers=student_headers, json={"attendance_record_id": record_id, "reason": "Present near the window"})
    assert response.status_code == 200
    dispute_id = response.json()["id"]
    _, faculty_headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    queue = client.get("/api/v1/faculty/disputes", headers=faculty_headers).json()
    assert any(dispute["id"] == dispute_id for dispute in queue)
    resolution = {"action": "approve", "reason": "Verified against classroom register"}
    assert client.post(f"/api/v1/faculty/disputes/{dispute_id}/resolve", headers=faculty_headers, json=resolution).status_code == 200
    assert client.post(f"/api/v1/faculty/disputes/{dispute_id}/resolve", headers=faculty_headers, json=resolution).status_code == 409
    history = client.get(f"/api/v1/students/{student_id}/sessions", headers=student_headers).json()
    record = next(item for item in history if item["record_id"] == record_id)
    assert record["status"] == "present" and record["dispute_status"] == "approved"


def test_other_faculty_cannot_change_course_attendance():
    record_id, _, course_id = fresh_record()
    _, headers = login("neha.sharma@bpitindia.edu.in", "faculty")
    assert client.put(f"/api/v1/attendance/{record_id}/override", headers=headers, json={"new_status": "present", "reason": "Unauthorized correction"}).status_code == 403
    assert client.post("/api/v1/sessions", headers=headers, json={"course_id": course_id, "session_type": "Lecture"}).status_code == 403


def test_authenticated_reports_are_valid_files():
    with SessionLocal() as db:
        course_id = db.query(Course).filter(Course.course_code == "IT302").one().id
    _, headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    excel = client.get(f"/api/v1/reports/export?course_id={course_id}&format=excel", headers=headers)
    assert excel.status_code == 200
    workbook = openpyxl.load_workbook(io.BytesIO(excel.content))
    assert workbook.active.max_row > 7
    pdf = client.get(f"/api/v1/reports/export?course_id={course_id}&format=pdf", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert client.get(f"/api/v1/reports/export?course_id={course_id}&format=excel").status_code in (401, 403)


def test_capture_saves_real_appearances_and_prevents_recapture(monkeypatch):
    with SessionLocal() as db:
        student = db.query(Student).filter(Student.full_name == "Rohan Sharma").one()
        student.face_embedding = [1.0] + [0.0] * 511
        student.face_model = face_service.model_name
        student.face_enrolled = True
        course_id = db.query(Course).filter(Course.course_code == "IT302").one().id
        db.commit()
    monkeypatch.setattr(face_service, "detect_and_extract_classroom_faces", lambda image: [{"embedding": [1.0] + [0.0] * 511, "crop_b64": "thumbnail"}])
    _, headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    response = client.post("/api/v1/sessions", headers=headers, json={"course_id": course_id, "session_type": "Lecture"})
    session_id = response.json()["session_id"]
    url = f"/api/v1/sessions/{session_id}/capture"
    assert client.post(url, headers=headers, json={"images": ["frame-one"]}).status_code == 422
    assert client.post(url, headers=headers, json={"images": ["frame-one", "frame-two", "frame-three"]}).status_code == 200
    results = client.get(f"/api/v1/sessions/{session_id}/results", headers=headers).json()
    rohan = next(record for record in results["records"] if record["full_name"] == "Rohan Sharma")
    assert rohan["status"] == "present" and rohan["appearances"] == 3
    assert client.post(url, headers=headers, json={"images": ["frame-one", "frame-two", "frame-three"]}).status_code == 409


def test_admin_timetable_changes_reach_enrolled_students():
    _, headers = login("admin@bpitindia.edu.in", "admin")
    with SessionLocal() as db:
        course_id = db.query(Course).filter(Course.course_code == "IT304").one().id
    url = f"/api/v1/admin/courses/{course_id}/timetable"
    slot = {"day_of_week": "Saturday", "start_time": "10:00", "end_time": "11:00", "room": "Lab-2", "session_type": "Lab"}
    assert client.put(url, headers=headers, json={"slots": [dict(slot, end_time="09:00")]}).status_code == 400
    assert client.put(url, headers=headers, json={"slots": [slot, slot]}).status_code == 400
    assert client.put(url, headers=headers, json={"slots": [slot]}).status_code == 200
    student, student_headers = login("rohan.sharma@bpitindia.edu.in", "student")
    timetable = client.get(f"/api/v1/students/{student['user_id']}/timetable", headers=student_headers).json()
    assert any(item["day_of_week"] == "Saturday" and item["room"] == "Lab-2" for item in timetable)


def test_admin_course_assignment_requires_approved_faculty():
    _, headers = login("admin@bpitindia.edu.in", "admin")
    with SessionLocal() as db:
        pending = db.query(Faculty).filter(Faculty.id_verified == False).first().id
        faculty = db.query(Faculty).filter(Faculty.full_name == "Prof. Neha Sharma").one().id
    payload = {"course_code": f"TEST-{uuid.uuid4().hex[:6]}", "course_name": "Assignment test", "faculty_id": pending, "room": "LH-202", "credits": 4}
    assert client.post("/api/v1/admin/courses", headers=headers, json=payload).status_code == 400
    payload["faculty_id"] = faculty
    response = client.post("/api/v1/admin/courses", headers=headers, json=payload)
    assert response.status_code == 200
    _, faculty_headers = login("neha.sharma@bpitindia.edu.in", "faculty")
    assert client.post("/api/v1/sessions", headers=faculty_headers, json={"course_id": response.json()["course_id"], "session_type": "Lecture"}).status_code == 200


def test_faculty_csv_conflicts_are_rejected_atomically():
    _, headers = login("admin@bpitindia.edu.in", "admin")
    token = uuid.uuid4().hex[:8]
    csv = f"employee_id,email,full_name\n{token},test-{token}@bpitindia.edu.in,Test Faculty\nother-{token},test-{token}@bpitindia.edu.in,Other Faculty\n"
    response = client.post("/api/v1/admin/faculty-list/upload", headers=headers, files={"file": ("faculty.csv", csv, "text/csv")})
    assert response.status_code == 400
    from app.models.user import FacultyWhitelist
    with SessionLocal() as db:
        assert db.query(FacultyWhitelist).filter(FacultyWhitelist.employee_id == token).first() is None


def test_roster_upload_reports_unknown_students_and_is_idempotent():
    _, headers = login("admin@bpitindia.edu.in", "admin")
    with SessionLocal() as db:
        course_id = db.query(Course).filter(Course.course_code == "IT302").one().id
        enrollment = db.query(Student).filter(Student.full_name == "Rohan Sharma").one().enrollment_no
    response = client.post(f"/api/v1/admin/rosters/upload?course_id={course_id}", headers=headers,
        files={"file": ("roster.csv", f"enrollment_no\n{enrollment}\n{enrollment}\nunknown-roll\n", "text/csv")})
    assert response.status_code == 200
    assert response.json()["unknown_enrollment_numbers"] == ["unknown-roll"]
    assert "Enrolled 0" in response.json()["message"]


def test_manual_face_assignment_updates_both_records_and_audit():
    from app.models.verification import VerificationQueue
    with SessionLocal() as db:
        course = db.query(Course).filter(Course.course_code == "IT302").one()
        original = db.query(Student).filter(Student.full_name == "Rohan Sharma").one()
        target = db.query(Student).filter(Student.full_name == "Simran Kaur").one()
        session = AttendanceSession(course_id=course.id, faculty_id=course.faculty_id, status="completed")
        db.add(session)
        db.flush()
        records = [AttendanceRecord(session_id=session.id, student_id=original.id, status="pending_review"),
            AttendanceRecord(session_id=session.id, student_id=target.id, status="absent")]
        item = VerificationQueue(session_id=session.id, candidate_student_id=original.id, similarity_score=0.5)
        db.add_all(records + [item])
        db.commit()
        item_id, target_id, record_ids = item.id, target.id, [record.id for record in records]
    _, headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    url = f"/api/v1/verification-queue/{item_id}/resolve"
    payload = {"action": "manual", "assigned_student_id": target_id}
    assert client.post(url, headers=headers, json=payload).status_code == 200
    assert client.post(url, headers=headers, json=payload).status_code == 409
    with SessionLocal() as db:
        assert db.get(AttendanceRecord, record_ids[0]).status == "absent"
        assert db.get(AttendanceRecord, record_ids[1]).status == "present"
        assert db.query(AuditLog).filter(AuditLog.attendance_record_id.in_(record_ids)).count() == 2
