import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. "IT302"
    course_name = Column(String(255), nullable=False)                         # e.g. "Operating Systems"
    faculty_id = Column(String(36), ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)
    room = Column(String(50), default="LH-204")
    credits = Column(Integer, default=4)
    branch = Column(String(50), nullable=False, default="", server_default="")
    semester = Column(String(10), nullable=False, default="", server_default="")
    section = Column(String(10), nullable=False, default="", server_default="")

    faculty = relationship("Faculty", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    attendance_sessions = relationship("AttendanceSession", back_populates="course", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="course", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (Index("uq_course_student_enrollment", "course_id", "student_id", unique=True),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)

    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(String(20), nullable=False) # "Monday", "Tuesday", etc.
    start_time = Column(String(10), nullable=False)  # "09:00"
    end_time = Column(String(10), nullable=False)    # "10:00"
    room = Column(String(50), default="LH-204")
    session_type = Column(String(50), default="Lecture") # "Lecture", "Lab", "Tutorial"

    student = relationship("Student", back_populates="timetable_entries")
    course = relationship("Course", back_populates="timetable_entries")
