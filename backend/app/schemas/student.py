from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class StudentProfileResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    enrollment_no: str
    semester: str
    branch: str
    section: str
    phone: Optional[str] = None
    face_enrolled: bool
    photo_url: Optional[str] = None

class StudentProfileUpdate(BaseModel):
    phone: Optional[str] = None
    semester: Optional[str] = None
    section: Optional[str] = None

class CourseAttendanceSummary(BaseModel):
    course_id: str
    course_code: str
    course_name: str
    faculty_name: str
    total_classes: int
    attended_classes: int
    percentage: float
    status: str # "safe", "warning", "critical"
    safe_bunk_count: int      # How many classes student can miss while remaining >= 75%
    classes_needed_to_recover: int # Classes to attend consecutively to reach 75%

class StudentOverallAttendance(BaseModel):
    total_conducted: int
    total_attended: int
    overall_percentage: float
    at_risk: bool
    courses: List[CourseAttendanceSummary]

class SessionHistoryItem(BaseModel):
    record_id: str
    session_id: str
    course_code: str
    course_name: str
    session_date: datetime
    session_type: str
    status: str # present, absent, pending_review
    confidence_score: float
    auto_marked: bool
    faculty_verified: bool
    dispute_status: Optional[str] = None # None, pending, approved, rejected

class TimetableCreate(BaseModel):
    course_id: str
    day_of_week: str
    start_time: str
    end_time: str
    room: Optional[str] = "LH-204"
    session_type: Optional[str] = "Lecture"

class TimetableResponse(BaseModel):
    id: str
    course_id: str
    course_code: str
    course_name: str
    day_of_week: str
    start_time: str
    end_time: str
    room: str
    session_type: str

class DisputeCreate(BaseModel):
    attendance_record_id: str
    reason: str

class DisputeResponse(BaseModel):
    id: str
    attendance_record_id: str
    student_id: str
    course_name: str
    session_date: datetime
    reason: str
    status: str
    raised_at: datetime
