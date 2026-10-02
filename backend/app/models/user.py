import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base, VectorType

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False) # 'student', 'faculty', 'admin'
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")
    faculty_profile = relationship("Faculty", back_populates="user", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("Admin", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Student(Base):
    __tablename__ = "students"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    enrollment_no = Column(String(50), unique=True, index=True, nullable=False)
    semester = Column(String(10), nullable=False, default="6th")
    branch = Column(String(50), nullable=False, default="Information Technology")
    section = Column(String(10), nullable=False, default="IT-1")
    phone = Column(String(20), nullable=True)
    face_embedding = Column(VectorType, nullable=True)
    face_enrolled = Column(Boolean, default=False)
    face_model = Column(String(50), nullable=False, default="legacy", server_default="legacy")
    photo_url = Column(Text, nullable=True) # Profile selfie thumbnail (base64 or URL)

    user = relationship("User", back_populates="student_profile")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
    disputes = relationship("Dispute", back_populates="student", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="student", cascade="all, delete-orphan")

class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    designation = Column(String(100), default="Assistant Professor")
    department = Column(String(100), default="Information Technology")
    office_hours = Column(String(100), default="Mon-Fri 2:00 PM - 4:00 PM")
    id_verified = Column(Boolean, default=False)
    id_card_url = Column(Text, nullable=True)

    user = relationship("User", back_populates="faculty_profile")
    courses = relationship("Course", back_populates="faculty")
    attendance_sessions = relationship("AttendanceSession", back_populates="faculty")

class Admin(Base):
    __tablename__ = "admin"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)

    user = relationship("User", back_populates="admin_profile")

class FacultyWhitelist(Base):
    """
    Master HR faculty employee list uploaded by Admin.
    Used to cross-check faculty registration (Zero unauthorized faculty accounts).
    """
    __tablename__ = "faculty_whitelist"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    department = Column(String(100), default="Information Technology")
    designation = Column(String(100), default="Assistant Professor")
    registered = Column(Boolean, default=False)
