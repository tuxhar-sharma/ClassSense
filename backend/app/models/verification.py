import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class VerificationQueue(Base):
    __tablename__ = "verification_queue"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    candidate_student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    similarity_score = Column(Float, nullable=False, default=0.0)
    face_crop_data = Column(Text, nullable=True) # Base64 thumbnail of detected face crop
    resolution_status = Column(String(50), default="pending") # pending, confirmed, rejected, manual
    resolved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    session = relationship("AttendanceSession", back_populates="verification_items")
    candidate_student = relationship("Student")
    resolver = relationship("User")

class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attendance_record_id = Column(String(36), ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(36), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="pending") # pending, approved, rejected
    raised_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    record = relationship("AttendanceRecord", back_populates="disputes")
    student = relationship("Student", back_populates="disputes")

class AuditLog(Base):
    """
    Immutable audit trail for every manual override or dispute resolution.
    Tracks changed_by, old_value, new_value, reason, changed_at.
    """
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attendance_record_id = Column(String(36), ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=False)
    changed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    old_value = Column(String(50), nullable=False)
    new_value = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("AttendanceRecord", back_populates="audit_logs")
    changer = relationship("User")
