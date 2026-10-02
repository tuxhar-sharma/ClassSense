import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
import app.models
from app.models.user import User, Student, Faculty
from app.models.course import Course
from app.api.access import resolve_student, resolve_faculty, require_course_access


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        student_user = User(id="student-user", email="student@example.com", password_hash="unused", role="student")
        faculty_user = User(id="faculty-user", email="faculty@example.com", password_hash="unused", role="faculty")
        session.add_all([student_user, faculty_user])
        session.flush()
        session.add_all([
            Student(id="student-profile", user_id=student_user.id, full_name="Student", enrollment_no="001"),
            Faculty(id="faculty-profile", user_id=faculty_user.id, full_name="Faculty", employee_id="F001", id_verified=True),
        ])
        session.commit()
        yield session
    engine.dispose()


def test_student_accepts_login_id_and_profile_id(db):
    user = db.get(User, "student-user")
    assert resolve_student(db, user.id, user).id == "student-profile"
    assert resolve_student(db, "student-profile", user).user_id == user.id


def test_student_cannot_read_another_profile(db):
    other_user = User(id="other-user", email="other@example.com", password_hash="unused", role="student")
    with pytest.raises(HTTPException) as error:
        resolve_student(db, "student-profile", other_user)
    assert error.value.status_code == 403


def test_faculty_accepts_login_id_and_checks_approval(db):
    user = db.get(User, "faculty-user")
    faculty = resolve_faculty(db, user.id, user)
    assert faculty.id == "faculty-profile"
    assert resolve_faculty(db, faculty.id, user).user_id == user.id
    faculty.id_verified = False
    with pytest.raises(HTTPException) as error:
        resolve_faculty(db, user.id, user)
    assert error.value.status_code == 403


def test_course_access_requires_assigned_faculty(db):
    user = db.get(User, "faculty-user")
    course = Course(course_code="TEST", course_name="Test", faculty_id="faculty-profile")
    require_course_access(course, user)
    course.faculty_id = "another-faculty"
    with pytest.raises(HTTPException) as error:
        require_course_access(course, user)
    assert error.value.status_code == 403
    with pytest.raises(HTTPException):
        require_course_access(course, db.get(User, "student-user"))
