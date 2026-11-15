from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.services.department_timetable import class_key, department_timetable
from app.services.it_timetable_data import DAYS, PERIODS
from app.database import Base, get_db
from app.main import app
from app.api.deps import create_access_token
from app.models.user import User, Student
from app.models.course import Course, Enrollment, TimetableEntry


def schedule(semester=3, section="A", group="", branch="Information Technology"):
    return department_timetable(SimpleNamespace(branch=branch, semester=str(semester), section=section, lab_group=group))


@pytest.mark.parametrize("semester", [3, 5, 7])
@pytest.mark.parametrize("section", ["A", "B", "C"])
def test_all_nine_sheets_cover_every_period_and_preserve_durations(semester, section):
    result = schedule(semester, section)
    assert result["available"]
    entries = result["entries"]
    assert len({e["id"] for e in entries}) == len(entries)
    assert {e["day_of_week"] for e in entries} == set(DAYS)
    for day in DAYS:
        daily = [e for e in entries if e["day_of_week"] == day]
        for _, start, end in PERIODS:
            assert any(e["start_time"] <= start and e["end_time"] >= end for e in daily), (semester, section, day, start)
    for entry in entries:
        start = sum(int(x) * y for x, y in zip(entry["start_time"].split(":"), [60, 1]))
        end = sum(int(x) * y for x, y in zip(entry["end_time"].split(":"), [60, 1]))
        assert end - start in {50, 100}
        if entry["session_type"] == "Lab":
            assert end - start == 100
            assert entry["room"] and entry["faculty_name"] and entry["lab_group"] in {"G1", "G2"}


def test_section_aliases_are_explicit_and_unsupported_classes_stay_unavailable():
    for section in ["A", "IT A", "IT-A", "IT (A)"]:
        assert class_key("IT", "3rd", section) == (3, "A")
    for semester, section, branch in [(1, "A", "IT"), (6, "A", "IT"), (3, "IT-1", "IT"), (3, "D", "IT"), (3, "A", "CSE")]:
        assert not schedule(semester, section, branch=branch)["available"]


def test_section_faculty_rooms_and_lab_group_selection():
    expected = {"A": "Mr. Sashwat Ranjan Shukla", "B": "Ms. Aditi Dwivedi", "C": "Prof. Manoj Kumar Gupta"}
    for section, faculty in expected.items():
        assert {e["faculty_name"] for e in schedule(3, section)["entries"] if e["course_name"] == "DS"} == {faculty}
    result = schedule(3, "A", "G1")
    labs = [e for e in result["entries"] if e["session_type"] == "Lab"]
    assert all(e["lab_group"] == "G1" for e in labs)
    monday = next(e for e in labs if e["day_of_week"] == "Monday")
    assert (monday["course_name"], monday["room"], monday["start_time"], monday["end_time"]) == ("DS Lab", "102-C", "11:10", "12:50")
    theory = next(e for e in result["entries"] if e["course_name"] == "OOPS")
    assert theory["room"] == "301" and theory["room_source"] == "class header"


def test_room_overrides_group_specific_and_multi_teacher_labs():
    assert {e["room"] for e in schedule(5, "A")["entries"] if e["course_name"] == "SE"} == {"220"}
    for group, faculty in [("G1", "Ms. Aditi Dwivedi"), ("G2", "Ms. Sakshi Agrawal")]:
        lab = next(e for e in schedule(5, "C", group)["entries"] if e["course_name"] == "DAA Lab")
        assert lab["faculty_name"] == faculty and lab["room"] == "102-C"
    assert {e["faculty_name"] for e in schedule(5, "A")["entries"] if e["course_name"] == "SE Lab"} == {"Prof. Payal Pahwa / Ms. Rajni Sharma"}


def test_source_ambiguities_missing_values_and_unscheduled_faculty_are_preserved():
    result = schedule(7)
    monday = [e for e in result["entries"] if e["slot_key"] == "Monday-3-4"]
    assert {e["course_name"] for e in monday} == {"DSR Lab", "MSRPM Lab"}
    assert all(e["lab_group"] == "G1" and e["source_note"] for e in monday)
    assert result["printed_semester_label"].startswith("Even")
    projects = [e for e in result["entries"] if e["course_name"] == "Minor Project"]
    assert len(projects) == 6 and all(not e["faculty_name"] and not e["room"] for e in projects)
    assert any(f["subject"] == "STR-2" and not f["scheduled"] for f in result["faculty_assignments"])
    assert len([e for e in result["entries"] if e["slot_key"] == "Thursday-7-8"]) == 3
    assert all(not e["faculty_name"] for e in schedule()["entries"] if e["course_name"] == "BCP")
    assert any(f["subject"] == "ST-1" and not f["scheduled"] for f in schedule(5)["faculty_assignments"])


@pytest.fixture
def client_with_students():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        for identifier in ["one", "two"]:
            user = User(id=identifier, email=f"{identifier}@example.com", password_hash="unused", role="student")
            db.add(user)
            db.flush()
            db.add(Student(id=f"profile-{identifier}", user_id=identifier, full_name=identifier, enrollment_no=identifier, semester="5th", section="C", branch="Information Technology"))
        db.commit()
        def override():
            yield db
        app.dependency_overrides[get_db] = override
        try:
            yield TestClient(app), db
        finally:
            app.dependency_overrides.pop(get_db, None)
    engine.dispose()


def test_authenticated_schedule_preferences_and_legacy_course_schedule(client_with_students):
    client, db = client_with_students
    headers = {"Authorization": "Bearer " + create_access_token({"sub": "one", "role": "student"})}
    url = "/api/v1/students/profile-one"
    assert client.get(url + "/department-timetable").status_code == 401
    assert client.get("/api/v1/students/profile-two/department-timetable", headers=headers).status_code == 403
    assert client.put("/api/v1/students/profile-two/profile", headers=headers, json={"lab_group": "G1"}).status_code == 403
    assert client.put(url + "/profile", headers=headers, json={"lab_group": "G3"}).status_code == 422
    assert client.put(url + "/profile", headers=headers, json={"lab_group": "G2"}).status_code == 200
    assert client.get(url + "/profile", headers=headers).json()["lab_group"] == "G2"
    result = client.get(url + "/department-timetable", headers=headers).json()
    assert result["available"] and result["lab_group"] == "G2"
    assert all(e["lab_group"] in {"", "G2"} for e in result["entries"])
    # Existing administrator-configured entries survive alongside the department grid.
    course = Course(id="custom", course_code="CUSTOM", course_name="Additional course")
    db.add(course); db.flush()
    db.add(Enrollment(course_id=course.id, student_id="profile-one"))
    db.add(TimetableEntry(course_id=course.id, student_id="profile-one", day_of_week="Saturday", start_time="10:00", end_time="11:00", room="EXTRA"))
    db.commit()
    entries = client.get(url + "/timetable", headers=headers).json()
    assert any(e["source"] == "department" for e in entries)
    assert any(e["course_code"] == "CUSTOM" and e["room"] == "EXTRA" for e in entries)
    assert client.put(url + "/profile", headers=headers, json={"semester": "1st"}).status_code == 200
    assert not client.get(url + "/department-timetable", headers=headers).json()["available"]
    assert len(client.get(url + "/timetable", headers=headers).json()) == 1
