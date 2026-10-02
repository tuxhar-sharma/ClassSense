from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class FacultyProfileResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    employee_id: str
    designation: str
    department: str
    office_hours: str
    id_verified: bool

class CourseItemResponse(BaseModel):
    id: str
    course_code: str
    course_name: str
    room: str
    credits: int
    enrolled_count: int
    branch: str = ""
    semester: str = ""
    section: str = ""

class CourseEnrollmentRequest(BaseModel):
    student_ids: List[str] = Field(min_length=1, max_length=300)

class SessionCreate(BaseModel):
    course_id: str
    session_type: Literal["Lecture", "Lab", "Tutorial"] = "Lecture"

class SessionCaptureRequest(BaseModel):
    images: List[str] = Field(min_length=3, max_length=4)

    @field_validator('images')
    @classmethod
    def require_distinct_images(cls, images):
        if len(set(images)) != len(images):
            raise ValueError('Use distinct classroom photos from different angles.')
        return images

class StudentMatchResult(BaseModel):
    record_id: Optional[str] = None
    faculty_verified: bool = False
    student_id: str
    enrollment_no: str
    full_name: str
    status: str # present, absent, pending_review
    confidence_score: float
    auto_marked: bool
    photo_url: Optional[str] = None
    appearances: int # Count out of total captured images

class SessionResultsResponse(BaseModel):
    revision: int = 1
    image_count: int = 0
    status: str = "completed"
    session_id: str
    course_name: str
    session_date: datetime
    session_type: str
    total_enrolled: int
    present_count: int
    absent_count: int
    review_count: int
    records: List[StudentMatchResult]

class SessionRetakeRequest(SessionCaptureRequest):
    reason: str = Field(min_length=3, max_length=500)
    expected_revision: int = Field(ge=1)

class VerificationQueueItemResponse(BaseModel):
    id: str
    session_id: str
    course_code: str
    course_name: str
    session_date: datetime
    candidate_student_id: str
    candidate_name: str
    candidate_enrollment_no: str
    candidate_photo_url: Optional[str] = None
    similarity_score: float
    face_crop_data: Optional[str] = None
    resolution_status: str

class VerificationResolveRequest(BaseModel):
    action: Literal["confirm", "reject", "manual"]
    assigned_student_id: Optional[str] = None # When action is manual re-assignment

class AttendanceOverrideRequest(BaseModel):
    new_status: Literal["present", "absent"]
    reason: str     # Mandatory reason for audit trail

class DisputeResolveRequest(BaseModel):
    action: Literal["approve", "reject"]
    reason: str

class AtRiskStudentItem(BaseModel):
    student_id: str
    enrollment_no: str
    full_name: str
    course_id: str
    course_name: str
    attended: int
    total: int
    percentage: float
    classes_needed: int

class TrendPoint(BaseModel):
    label: str # e.g. "Week 1", "Week 2", "12 Sep"
    attendance_rate: float
    total_sessions: int

class FacultyAnalyticsResponse(BaseModel):
    course_id: Optional[str] = None
    average_attendance: float
    total_sessions_conducted: int
    total_students_enrolled: int
    trends: List[TrendPoint]
    at_risk_students: List[AtRiskStudentItem]
