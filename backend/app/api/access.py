from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import Faculty, Student, User


def resolve_student(db: Session, identifier: str, user: User) -> Student:
    student = db.query(Student).filter(
        or_(Student.id == identifier, Student.user_id == identifier)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    if user.role != "admin" and (user.role != "student" or student.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied to this student profile.")
    return student


def resolve_faculty(db: Session, identifier: str, user: User) -> Faculty:
    faculty = db.query(Faculty).filter(
        or_(Faculty.id == identifier, Faculty.user_id == identifier)
    ).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found.")
    if user.role != "admin" and (user.role != "faculty" or faculty.user_id != user.id):
        raise HTTPException(status_code=403, detail="Access denied to this faculty profile.")
    if not faculty.id_verified:
        raise HTTPException(status_code=403, detail="Faculty account is pending Admin Employee ID verification.")
    return faculty


def require_course_access(course, user: User):
    if user.role == "admin":
        return
    if user.role != "faculty" or not user.faculty_profile or not user.faculty_profile.id_verified:
        raise HTTPException(status_code=403, detail="Verified faculty access required.")
    if course.faculty_id != user.faculty_profile.id:
        raise HTTPException(status_code=403, detail="This course is assigned to another faculty member.")
