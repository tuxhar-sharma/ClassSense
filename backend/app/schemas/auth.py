from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal


class RegistrationRequest(BaseModel):
    @field_validator('email', check_fields=False)
    @classmethod
    def normalize_email(cls, value):
        return value.lower()

    @field_validator('password', check_fields=False)
    @classmethod
    def validate_password_bytes(cls, value):
        if len(value.encode('utf-8')) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes.')
        return value

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: str
    full_name: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(RegistrationRequest):
    email: EmailStr
    password: str
    role: Optional[Literal['student', 'faculty', 'admin']] = None

class StudentRegisterRequest(RegistrationRequest):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(min_length=1, max_length=255)
    enrollment_no: str = Field(min_length=1, max_length=50)
    semester: str = "6th"
    branch: str = "Information Technology"
    section: str = "IT-1"
    phone: Optional[str] = None
    photo_base64: Optional[str] = None # Optional selfie provided during registration

class FacultyRegisterRequest(RegistrationRequest):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    employee_id: str
    designation: Optional[str] = "Assistant Professor"
    department: Optional[str] = "Information Technology"
    office_hours: Optional[str] = "Mon-Fri 2:00 PM - 4:00 PM"
    id_card_base64: Optional[str] = None

class FaceEnrollRequest(BaseModel):
    photo_base64: str # Base64 encoded selfie image

class InitialAdminRequest(RegistrationRequest):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=255)
