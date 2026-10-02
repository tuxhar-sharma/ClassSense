from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from typing import Literal


class CourseTimetableSlot(BaseModel):
    day_of_week: Literal['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    start_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    end_time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    room: str = Field(min_length=1, max_length=50)
    session_type: Literal['Lecture', 'Lab', 'Tutorial'] = 'Lecture'


class CourseTimetableUpdate(BaseModel):
    slots: List[CourseTimetableSlot] = Field(max_length=20)

class FacultyWhitelistItem(BaseModel):
    employee_id: str
    email: EmailStr
    full_name: str
    department: str = "Information Technology"
    designation: str = "Assistant Professor"

class PendingFacultyResponse(BaseModel):
    id: str # Faculty ID
    user_id: str
    full_name: str
    email: str
    employee_id: str
    designation: str
    department: str
    id_card_url: Optional[str] = None
    created_at: datetime
    id_verified: bool

class FacultyApproveReject(BaseModel):
    action: str # "approve" or "reject"
    rejection_reason: Optional[str] = None

class CourseCreate(BaseModel):
    course_code: str = Field(min_length=1, max_length=50)
    course_name: str = Field(min_length=1, max_length=255)
    faculty_id: Optional[str] = None
    room: str = "LH-204"
    credits: int = Field(default=4, ge=1, le=10)
    branch: str = Field(default="", max_length=50)
    semester: str = Field(default="", max_length=10)
    section: str = Field(default="", max_length=10)

class AuditLogItemResponse(BaseModel):
    id: str
    attendance_record_id: str
    student_name: str
    course_name: str
    changed_by_name: str
    old_value: str
    new_value: str
    reason: str
    changed_at: datetime

class AdminStatsResponse(BaseModel):
    total_students: int
    total_faculty: int
    pending_faculty_approvals: int
    total_courses: int
    total_attendance_sessions: int
    average_system_attendance: float
