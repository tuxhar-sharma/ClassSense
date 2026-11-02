from datetime import datetime, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import Student, Faculty
from app.models.course import Course, Enrollment, TimetableEntry
from app.models.attendance import AttendanceWindow, AttendanceSession, AbsenceAlert, AttendanceRecord
from app.services.session_windows import sync_windows, save_absence_alerts

pytestmark = pytest.mark.usefixtures("demo_data")
client = TestClient(app)

def test_timetable_opens_once_and_expires_without_marking_absent():
    with SessionLocal() as db:
        faculty = db.query(Faculty).filter_by(id_verified=True).first()
        student = db.query(Student).first()
        course = Course(course_code=uuid.uuid4().hex, course_name="Window test", faculty_id=faculty.id)
        db.add(course)
        db.flush()
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        # 09:00 India time on Monday.
        now = datetime(2030, 1, 7, 3, 30)
        for _ in range(2):
            db.add(TimetableEntry(course_id=course.id, student_id=student.id, day_of_week="Monday", start_time="09:00", end_time="10:00"))
        db.commit()
        sync_windows(db, now-timedelta(seconds=1))
        window = db.query(AttendanceWindow).filter_by(course_id=course.id).one()
        assert window.session_id is None
        sync_windows(db, now)
        sync_windows(db, now+timedelta(seconds=15))
        db.refresh(window)
        assert db.query(AttendanceSession).filter_by(course_id=course.id).count() == 1
        session = db.get(AttendanceSession, window.session_id)
        assert session.status == "in_progress"
        sync_windows(db, now+timedelta(hours=1))
        db.refresh(session)
        assert session.status == "expired"
        assert session.records == []
        db.delete(course)
        db.commit()

def test_absence_alert_is_unique_and_private_and_disappears_after_correction():
    def login(email, role):
        result = client.post("/api/v1/auth/login", json={"email": email, "password": role+"123", "role": role})
        assert result.status_code == 200
        return {"Authorization": "Bearer "+result.json()["access_token"]}
    with SessionLocal() as db:
        student = db.query(Student).filter_by(full_name="Rohan Sharma").one()
        course = db.query(Course).filter_by(course_code="IT302").one()
        session = AttendanceSession(course_id=course.id, faculty_id=course.faculty_id, status="completed")
        db.add(session); db.flush()
        record = AttendanceRecord(session_id=session.id, student_id=student.id, status="absent")
        db.add(record); db.flush()
        save_absence_alerts(db, student.id)
        save_absence_alerts(db, student.id)
        db.commit()
        record_id = record.id
        alert = db.query(AbsenceAlert).filter_by(record_id=record.id).one()
        alert_id = alert.id
    headers = login("rohan.sharma@bpitindia.edu.in", "student")
    result = client.get("/api/v1/students/notifications", headers=headers)
    assert any(a["id"] == alert_id for a in result.json())
    faculty_headers = login("rajesh.kaushik@bpitindia.edu.in", "faculty")
    assert client.get("/api/v1/students/notifications", headers=faculty_headers).status_code == 403
    assert client.post(f"/api/v1/students/notifications/{alert_id}/read", headers=headers).status_code == 200
    assert client.post("/api/v1/students/notifications/missing/read", headers=headers).status_code == 404
    assert client.put(f"/api/v1/attendance/{record_id}/override", headers=faculty_headers, json={"new_status": "present", "reason": "Confirmed student was present"}).status_code == 200
    assert all(a["id"] != alert_id for a in client.get("/api/v1/students/notifications", headers=headers).json())


def test_extra_class_validation_permissions_and_duplicate_prevention():
    from datetime import timezone
    with SessionLocal() as db:
        faculty = db.query(Faculty).filter_by(full_name="Dr. Rajesh Kaushik").one()
        student = db.query(Student).first()
        course = Course(course_code=uuid.uuid4().hex, course_name="Extra class test", faculty_id=faculty.id)
        db.add(course); db.flush()
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        db.commit()
        course_id = course.id
    auth = client.post("/api/v1/auth/login", json={"email": "rajesh.kaushik@bpitindia.edu.in", "password": "faculty123", "role": "faculty"}).json()
    headers = {"Authorization": "Bearer "+auth["access_token"]}
    now = datetime.now(timezone.utc)
    payload = {"starts_at": (now-timedelta(minutes=1)).isoformat(), "ends_at": (now+timedelta(hours=1)).isoformat()}
    endpoint = f"/api/v1/courses/{course_id}/extra-classes"
    assert client.post(endpoint, json=payload).status_code == 401
    assert client.post(endpoint, headers=headers, json={**payload, "ends_at": payload["starts_at"]}).status_code == 400
    assert client.post(endpoint, headers=headers, json=payload).status_code == 200
    assert client.post(endpoint, headers=headers, json=payload).status_code == 409
    session = client.post("/api/v1/sessions", headers=headers, json={"course_id": course_id}).json()["session_id"]
    assert client.post("/api/v1/sessions", headers=headers, json={"course_id": course_id}).json()["session_id"] == session
    with SessionLocal() as db:
        window = db.query(AttendanceWindow).filter_by(session_id=session).one()
        window.ends_at = datetime.utcnow()-timedelta(seconds=1)
        db.commit()
    assert client.post(f"/api/v1/sessions/{session}/capture", headers=headers, json={"images": ["one", "two", "three"]}).status_code == 409
    with SessionLocal() as db:
        db.delete(db.get(Course, course_id))
        db.commit()
