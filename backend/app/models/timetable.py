import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, Date, DateTime, ForeignKey, UniqueConstraint
from app.database import Base

class TimetablePublication(Base):
    __tablename__ = "timetable_publications"
    __table_args__ = (UniqueConstraint("branch", "semester", "section", "revision"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    branch = Column(String(50), nullable=False)
    semester = Column(String(10), nullable=False)
    section = Column(String(10), nullable=False)
    revision = Column(Integer, nullable=False)
    effective_from = Column(Date, nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=datetime.utcnow)
    applied_at = Column(DateTime, nullable=True)

class TimetableNotification(Base):
    __tablename__ = "timetable_notifications"
    __table_args__ = (UniqueConstraint("publication_id", "user_id"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    publication_id = Column(String(36), ForeignKey("timetable_publications.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)
