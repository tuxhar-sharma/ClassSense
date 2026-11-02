from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.api.deps import get_password_hash


@pytest.fixture
def empty_client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    try:
        with TestClient(app, client=("127.0.0.1", 12345)) as client:
            yield client, factory
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_first_run_creates_personal_admin_once_and_empty_dashboard(empty_client):
    client, _ = empty_client
    assert client.get("/api/v1/auth/setup-status").json() == {"setup_required": True}
    payload = {"email": "owner@bpitindia.edu.in", "full_name": "Project Owner", "password": "Private-password-42"}
    response = client.post("/api/v1/auth/setup-admin", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["role"] == "admin"
    assert client.get("/api/v1/auth/setup-status").json() == {"setup_required": False}
    assert client.post("/api/v1/auth/setup-admin", json=payload).status_code == 409
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    stats = client.get("/api/v1/admin/stats", headers=headers).json()
    assert stats["total_students"] == 0 and stats["total_courses"] == 0 and stats["total_attendance_sessions"] == 0
    assert client.get("/api/v1/admin/courses", headers=headers).json() == []


def test_first_run_is_restricted_to_localhost(empty_client):
    with TestClient(app, client=("192.168.1.20", 12345)) as remote:
        response = remote.post("/api/v1/auth/setup-admin", json={"email": "owner@bpitindia.edu.in", "full_name": "Project Owner", "password": "Private-password-42"})
        assert response.status_code == 403


def test_previously_registered_mixed_case_email_can_sign_in(empty_client):
    client, factory = empty_client
    with factory() as db:
        db.add(User(email="Existing@bpitindia.edu.in", password_hash=get_password_hash("Private-password-42"), role="admin"))
        db.commit()
    assert client.post("/api/v1/auth/login", json={"email": "existing@bpitindia.edu.in", "password": "Private-password-42", "role": "admin"}).status_code == 200


def test_clean_setup_to_real_recognition_and_student_attendance(empty_client):
    from pathlib import Path
    import cv2
    from app.services.face_recognition import face_service
    insightface = pytest.importorskip("insightface")
    source = Path(insightface.__file__).parent / "data/images/t1.jpg"
    if not face_service.ready or not source.exists():
        pytest.skip("Real ONNX models and sample image required.")
    client, _ = empty_client
    classroom = cv2.imread(str(source))
    detected = face_service.detect_and_extract_classroom_faces(classroom)[0]
    x, y, width, height = detected["bbox"]
    padding = int(max(width, height) * 0.25)
    selfie = classroom[max(0, y-padding):y+height+padding, max(0, x-padding):x+width+padding]

    admin = client.post("/api/v1/auth/setup-admin", json={"email": "owner@bpitindia.edu.in", "full_name": "Project Owner", "password": "Private-password-42"})
    assert admin.status_code == 200, admin.text
    admin_headers = {"Authorization": f"Bearer {admin.json()['access_token']}"}
    student = client.post("/api/v1/auth/student/register", json={"email": "participant@bpitindia.edu.in", "password": "Participant-pass-42", "full_name": "Test Participant", "enrollment_no": "REAL-FLOW-001", "photo_base64": face_service.encode_image_to_base64(selfie)})
    assert student.status_code == 200, student.text
    student_headers = {"Authorization": f"Bearer {student.json()['access_token']}"}
    assert client.post("/api/v1/auth/faculty/register", json={"email": "lecturer@bpitindia.edu.in", "password": "Lecturer-pass-42", "full_name": "Test Lecturer", "employee_id": "REAL-FLOW-F01"}).status_code == 200
    faculty_id = client.get("/api/v1/admin/faculty-verification-queue", headers=admin_headers).json()[0]["id"]
    assert client.post(f"/api/v1/admin/faculty-verification-queue/{faculty_id}/approve", headers=admin_headers).status_code == 200
    faculty = client.post("/api/v1/auth/login", json={"email": "lecturer@bpitindia.edu.in", "password": "Lecturer-pass-42", "role": "faculty"}).json()
    faculty_headers = {"Authorization": f"Bearer {faculty['access_token']}"}
    course = client.post("/api/v1/admin/courses", headers=admin_headers, json={"course_code": "REAL-FLOW", "course_name": "Real workflow course", "faculty_id": faculty_id}).json()["course_id"]
    assert client.post(f"/api/v1/admin/rosters/upload?course_id={course}", headers=admin_headers, files={"file": ("roster.csv", "enrollment_no\nREAL-FLOW-001\n", "text/csv")}).status_code == 200
    assert client.put(f"/api/v1/admin/courses/{course}/timetable", headers=admin_headers, json={"slots": [{"day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "room": "Project Room", "session_type": "Lecture"}]}).status_code == 200
    uid = student.json()["user_id"]
    assert len(client.get(f"/api/v1/students/{uid}/timetable", headers=student_headers).json()) == 1
    now = datetime.now(timezone.utc)
    assert client.post(f"/api/v1/courses/{course}/extra-classes", headers=faculty_headers, json={"starts_at": (now-timedelta(minutes=1)).isoformat(), "ends_at": (now+timedelta(hours=1)).isoformat()}).status_code == 200
    session = client.post("/api/v1/sessions", headers=faculty_headers, json={"course_id": course, "session_type": "Lecture"}).json()["session_id"]
    images = []
    for angle in (-1, 0, 1):
        matrix = cv2.getRotationMatrix2D((classroom.shape[1]/2, classroom.shape[0]/2), angle, 1)
        images.append(face_service.encode_image_to_base64(cv2.warpAffine(classroom, matrix, (classroom.shape[1], classroom.shape[0]))))
    capture = client.post(f"/api/v1/sessions/{session}/capture", headers=faculty_headers, json={"images": images})
    assert capture.status_code == 200, capture.text
    results = client.get(f"/api/v1/sessions/{session}/results", headers=faculty_headers).json()
    assert results["present_count"] == 1 and results["records"][0]["appearances"] >= 2
    attendance = client.get(f"/api/v1/students/{uid}/attendance", headers=student_headers).json()
    assert attendance["total_conducted"] == 1 and attendance["total_attended"] == 1
    assert attendance["overall_percentage"] == 100
    for format in ("excel", "pdf"):
        assert client.get(f"/api/v1/reports/export?course_id={course}&format={format}", headers=faculty_headers).status_code == 200
    retake = client.post(f"/api/v1/sessions/{session}/retake", headers=faculty_headers,
        json={"images": images, "reason": "Repeat actual model capture", "expected_revision": 1})
    assert retake.status_code == 200, retake.text
    results = client.get(f"/api/v1/sessions/{session}/results", headers=faculty_headers).json()
    assert results["revision"] == 2 and results["present_count"] == 1
    attendance = client.get(f"/api/v1/students/{uid}/attendance", headers=student_headers).json()
    assert attendance["total_conducted"] == 1


@pytest.fixture
def class_accounts(empty_client):
    from app.api.deps import create_access_token
    from app.models.user import Faculty, Student
    from app.models.course import Course
    client, factory = empty_client
    with factory() as db:
        users = [User(id=role, email=f"{role}@bpitindia.edu.in", password_hash="unused", role="faculty" if role in ("teacher", "other", "pending") else role) for role in ("teacher", "other", "pending", "student", "admin")]
        db.add_all(users); db.flush()
        db.add_all([Faculty(id=role, user_id=role, full_name=role, employee_id=role, id_verified=role != "pending") for role in ("teacher", "other", "pending")]); db.flush()
        db.add(Course(id="class", course_code="IT-CLASS", course_name="Class course", faculty_id="teacher", branch="Information Technology", semester="6th", section="IT-1", room="LH-204"))
        db.add_all([Student(id="matching", user_id="student", full_name="Matching Student", enrollment_no="MATCH-001", branch="Information Technology", semester="6th", section="it-1"),
            Student(id="other-section", user=User(email="other-section@bpitindia.edu.in", password_hash="unused", role="student"), full_name="Other Section", enrollment_no="OTHER-001", branch="Information Technology", semester="6th", section="IT-2"),
            Student(id="other-branch", user=User(email="other-branch@bpitindia.edu.in", password_hash="unused", role="student"), full_name="Other Branch", enrollment_no="OTHER-002", branch="Computer Science & Engineering", semester="6th", section="IT-1"),
            Student(id="other-semester", user=User(email="other-semester@bpitindia.edu.in", password_hash="unused", role="student"), full_name="Other Semester", enrollment_no="OTHER-003", branch="Information Technology", semester="7th", section="IT-1")])
        db.commit()
    headers = {role: {"Authorization": f"Bearer {create_access_token({'sub': role, 'role': 'faculty' if role in ('teacher', 'other', 'pending') else role})}"} for role in ("teacher", "other", "pending", "student", "admin")}
    return client, factory, headers


def test_assigned_faculty_enrolls_matching_registrations_once(class_accounts):
    client, _, headers = class_accounts
    response = client.get("/api/v1/courses/class/roster", headers=headers["teacher"])
    assert response.status_code == 200
    assert [student["id"] for student in response.json()["eligible_students"]] == ["matching"]
    payload = {"student_ids": ["matching", "matching"]}
    url = "/api/v1/courses/class/enrollments"
    assert client.post(url, headers=headers["teacher"], json=payload).json()["enrolled_count"] == 1
    assert client.post(url, headers=headers["teacher"], json=payload).json()["enrolled_count"] == 0
    roster = client.get("/api/v1/courses/class/roster", headers=headers["teacher"]).json()
    assert not roster["eligible_students"] and len(roster["enrolled_students"]) == 1
    attendance = client.get("/api/v1/students/student/attendance", headers=headers["student"]).json()
    assert attendance["courses"][0]["course_id"] == "class"


def test_wrong_class_enrollment_fails_without_partial_changes(class_accounts):
    from app.models.course import Enrollment
    client, factory, headers = class_accounts
    for invalid in ("other-section", "other-branch", "other-semester", "missing"):
        response = client.post("/api/v1/courses/class/enrollments", headers=headers["teacher"], json={"student_ids": ["matching", invalid]})
        assert response.status_code == 400
    with factory() as db:
        assert db.query(Enrollment).count() == 0


def test_only_approved_assigned_faculty_can_view_or_enroll(class_accounts):
    client, _, headers = class_accounts
    for role in ("other", "pending", "student"):
        assert client.get("/api/v1/courses/class/roster", headers=headers[role]).status_code == 403
        assert client.post("/api/v1/courses/class/enrollments", headers=headers[role], json={"student_ids": ["matching"]}).status_code == 403


def test_new_registration_appears_and_inherits_timetable(class_accounts):
    from app.models.course import Enrollment, TimetableEntry
    client, factory, headers = class_accounts
    client.post("/api/v1/courses/class/enrollments", headers=headers["teacher"], json={"student_ids": ["matching"]})
    with factory() as db:
        db.add(TimetableEntry(student_id="matching", course_id="class", day_of_week="Monday", start_time="09:00", end_time="10:00", room="LH-204", session_type="Lecture")); db.commit()
    registration = client.post("/api/v1/auth/student/register", json={"email": "new-participant@bpitindia.edu.in", "password": "Participant-pass-42", "full_name": "New Participant", "enrollment_no": "NEW-001", "branch": "Information Technology", "semester": "6th", "section": "IT-1"})
    assert registration.status_code == 200
    roster = client.get("/api/v1/courses/class/roster", headers=headers["teacher"]).json()
    participant = next(student for student in roster["eligible_students"] if student["enrollment_no"] == "NEW-001")
    assert client.post("/api/v1/courses/class/enrollments", headers=headers["teacher"], json={"student_ids": [participant["id"]]}).status_code == 200
    student_headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}
    timetable = client.get(f"/api/v1/students/{registration.json()['user_id']}/timetable", headers=student_headers).json()
    assert len(timetable) == 1 and timetable[0]["room"] == "LH-204"


def test_late_enrollment_does_not_create_historical_absences(class_accounts):
    from app.models.attendance import AttendanceSession
    client, factory, headers = class_accounts
    with factory() as db:
        db.add(AttendanceSession(course_id="class", faculty_id="teacher", status="completed")); db.commit()
    client.post("/api/v1/courses/class/enrollments", headers=headers["teacher"], json={"student_ids": ["matching"]})
    attendance = client.get("/api/v1/students/student/attendance", headers=headers["student"]).json()
    assert attendance["total_conducted"] == 0 and attendance["at_risk"] is False
    import io, openpyxl
    report = client.get("/api/v1/reports/export?course_id=class&format=excel", headers=headers["teacher"])
    sheet = openpyxl.load_workbook(io.BytesIO(report.content)).active
    assert sheet.cell(8, 4).value == "—" and sheet.cell(8, 6).value == 0


@pytest.fixture
def saved_class_session(class_accounts):
    from app.models.attendance import AttendanceSession, AttendanceRecord
    from app.models.verification import Dispute
    client, factory, headers = class_accounts
    with factory() as db:
        session = AttendanceSession(course_id="class", faculty_id="teacher", status="completed", image_count=3)
        db.add(session); db.flush()
        record = AttendanceRecord(session_id=session.id, student_id="matching", status="absent", appearances=0)
        db.add(record); db.flush()
        db.add(Dispute(attendance_record_id=record.id, student_id="matching", reason="Missed in the first photos")); db.commit()
        return client, factory, headers, session.id, record.id


def test_retake_preserves_session_record_dispute_and_previous_results(saved_class_session, monkeypatch):
    from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceSessionRevision
    from app.models.verification import Dispute, AuditLog
    from app.services.aggregation import aggregation_service
    client, factory, headers, session_id, record_id = saved_class_session
    monkeypatch.setattr(aggregation_service, "aggregate_session_capture", lambda images, students: {
        "attendance_records": [{"student_id": student["id"], "status": "present", "confidence_score": .8,
            "appearances": 3, "faculty_verified": False, "auto_marked": True} for student in students],
        "verification_queue_items": []})
    payload = {"images": ["frame1", "frame2", "frame3"], "reason": "Back row missed", "expected_revision": 1}
    url = f"/api/v1/sessions/{session_id}/retake"
    response = client.post(url, headers=headers["teacher"], json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["revision"] == 2
    assert client.post(url, headers=headers["teacher"], json=payload).status_code == 409
    history = client.get(f"/api/v1/sessions/{session_id}/revisions", headers=headers["teacher"]).json()
    assert history[0]["revision"] == 1 and history[0]["snapshot"]["records"][0]["status"] == "absent"
    results = client.get(f"/api/v1/sessions/{session_id}/results", headers=headers["teacher"]).json()
    assert results["revision"] == 2 and results["present_count"] == 1 and results["records"][0]["record_id"] == record_id
    listing = client.get("/api/v1/courses/class/sessions", headers=headers["teacher"]).json()
    assert len(listing) == 1 and listing[0]["present_count"] == 1
    with factory() as db:
        assert db.query(AttendanceSession).count() == 1 and db.query(AttendanceRecord).count() == 1
        assert db.query(AttendanceSessionRevision).count() == 1
        assert db.query(Dispute).one().attendance_record_id == record_id
        assert db.query(AuditLog).one().old_value == "absent"


def test_failed_retake_leaves_saved_attendance_unchanged(saved_class_session, monkeypatch):
    from app.models.attendance import AttendanceSession, AttendanceRecord, AttendanceSessionRevision
    from app.services.aggregation import aggregation_service
    client, factory, headers, session_id, record_id = saved_class_session
    def fail(images, students):
        raise ValueError("Invalid classroom image")
    monkeypatch.setattr(aggregation_service, "aggregate_session_capture", fail)
    response = client.post(f"/api/v1/sessions/{session_id}/retake", headers=headers["teacher"], json={"images": ["one", "two", "three"], "reason": "Retake after poor light", "expected_revision": 1})
    assert response.status_code == 400
    with factory() as db:
        assert db.get(AttendanceRecord, record_id).status == "absent"
        assert db.get(AttendanceSession, session_id).revision == 1
        assert db.query(AttendanceSessionRevision).count() == 0


def test_other_accounts_cannot_read_history_or_retake(saved_class_session):
    client, _, headers, session_id, _ = saved_class_session
    for role in ("other", "pending", "student"):
        assert client.get("/api/v1/courses/class/sessions", headers=headers[role]).status_code == 403
        assert client.get(f"/api/v1/sessions/{session_id}/revisions", headers=headers[role]).status_code == 403
        assert client.post(f"/api/v1/sessions/{session_id}/retake", headers=headers[role], json={"images": ["one", "two", "three"], "reason": "Retake", "expected_revision": 1}).status_code == 403
