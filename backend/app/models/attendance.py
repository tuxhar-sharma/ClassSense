import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(String(36), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(DateTime, default=datetime.utcnow, index=True)
    session_type = Column(String(50), default="Lecture") # Lecture, Lab, Tutorial
    image_count = Column(Integer, default=3)
    status = Column(String(50), default="completed") # in_progress, completed
    revision = Column(Integer, nullable=False, default=1, server_default="1")

    course = relationship("Course", back_populates="attendance_sessions")
    faculty = relationship("Faculty", back_populates="attendance_sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    verification_items = relationship("VerificationQueue", back_populates="session", cascade="all, delete-orphan")

class AttendanceSessionRevision(Base):
    __tablename__ = "attendance_session_revisions"
    __table_args__ = (UniqueConstraint("session_id", "revision"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    revision = Column(Integer, nullable=False)
    snapshot = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    replaced_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    replaced_at = Column(DateTime, default=datetime.utcnow)

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="absent") # present, absent, pending_review
    confidence_score = Column(Float, default=0.0)
    faculty_verified = Column(Boolean, default=False)
    auto_marked = Column(Boolean, default=True)
    appearances = Column(Integer, nullable=False, default=0, server_default="0")
    marked_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")
    disputes = relationship("Dispute", back_populates="record", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="record", cascade="all, delete-orphan")

class AttendanceWindow(Base):
    __tablename__ = "attendance_windows"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id = Column(String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    session_type = Column(String(50), nullable=False, default="Lecture")
    source = Column(String(20), nullable=False, default="timetable")
    slot_key = Column(String(255), unique=True, nullable=True)
    session_id = Column(String(36), ForeignKey("attendance_sessions.id", ondelete="SET NULL"), unique=True, nullable=True)

class AbsenceAlert(Base):
    __tablename__ = "absence_alerts"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = Column(String(36), ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False, unique=True)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
