from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.user import User, Student, Faculty, FacultyWhitelist, Admin
from app.schemas.auth import (
    Token, LoginRequest, StudentRegisterRequest, FacultyRegisterRequest, FaceEnrollRequest, InitialAdminRequest
)
from app.api.deps import verify_password, get_password_hash, create_access_token, get_current_user
from app.services.face_recognition import face_service, RecognitionUnavailable

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.get("/setup-status")
def setup_status(db: Session = Depends(get_db)):
    return {"setup_required": db.query(User.id).filter(User.role == "admin").first() is None}

@router.post("/setup-admin", response_model=Token)
def setup_initial_admin(payload: InitialAdminRequest, request: Request, db: Session = Depends(get_db)):
    if not request.client or request.client.host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="Create the initial administrator from this computer using localhost.")
    if db.query(User.id).filter(User.role == "admin").first():
        raise HTTPException(status_code=409, detail="Administrator setup has already been completed.")
    if db.query(User.id).filter(func.lower(User.email) == payload.email).first():
        raise HTTPException(status_code=400, detail="This email already belongs to a registered account. Choose a separate administrator email.")
    user = User(id="c269ac37-3927-49d5-a311-9747aa84b51f", email=payload.email,
        password_hash=get_password_hash(payload.password), role="admin")
    db.add(user)
    db.add(Admin(user=user, full_name=payload.full_name.strip()))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Administrator setup has already been completed.")
    return Token(access_token=create_access_token({"sub": user.id, "role": user.role}),
        token_type="bearer", role="admin", user_id=user.id, full_name=payload.full_name.strip())

def validate_college_domain(email: str):
    """Enforces institutional domain check if configured"""
    domain = email.split("@")[-1].lower()
    if settings.ALLOWED_EMAIL_DOMAINS and domain not in settings.ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration restricted to institutional domains ({', '.join(settings.ALLOWED_EMAIL_DOMAINS)})"
        )

@router.post("/student/register", response_model=Token)
def register_student(payload: StudentRegisterRequest, db: Session = Depends(get_db)):
    validate_college_domain(payload.email)
    
    # Check if email exists
    if db.query(User).filter(func.lower(User.email) == payload.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Check if enrollment number exists
    if db.query(Student).filter(Student.enrollment_no == payload.enrollment_no).first():
        raise HTTPException(status_code=400, detail="An account with this enrollment number already exists.")

    # Process selfie if provided
    face_emb = None
    face_enrolled = False
    photo_url = None

    if payload.photo_base64:
        try:
            ok, emb, crop_b64, msg = face_service.process_selfie_enrolment(payload.photo_base64)
        except RecognitionUnavailable as error:
            raise HTTPException(status_code=503, detail=str(error))
        if not ok or not emb:
            raise HTTPException(status_code=400, detail=msg)
        if ok and emb:
            face_emb = emb
            face_enrolled = True
            photo_url = crop_b64

    # Create User
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="student"
    )
    db.add(new_user)
    db.flush()

    # Create Student Profile
    new_student = Student(
        user_id=new_user.id,
        full_name=payload.full_name,
        enrollment_no=payload.enrollment_no,
        semester=payload.semester,
        branch=payload.branch,
        section=payload.section,
        phone=payload.phone,
        face_embedding=face_emb,
        face_enrolled=face_enrolled,
        face_model=face_service.model_name if face_enrolled else "legacy",
        photo_url=photo_url
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.id, "role": new_user.role})
    return Token(
        access_token=token,
        token_type="bearer",
        role=new_user.role,
        user_id=new_user.id,
        full_name=payload.full_name
    )

@router.post("/faculty/register")
def register_faculty(payload: FacultyRegisterRequest, db: Session = Depends(get_db)):
    validate_college_domain(payload.email)

    if db.query(User).filter(func.lower(User.email) == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    if db.query(Faculty).filter(Faculty.employee_id == payload.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already registered.")

    # Cross-check with Admin-uploaded Master Faculty Employee List (Zero unauthorized faculty accounts)
    whitelist_entry = db.query(FacultyWhitelist).filter(
        FacultyWhitelist.employee_id == payload.employee_id
    ).first()

    # If whitelist exists and matches email: auto-verify or queue for admin
    is_verified = False
    if whitelist_entry:
        if whitelist_entry.email.lower() == payload.email.lower():
            is_verified = True
            whitelist_entry.registered = True
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Employee ID {payload.employee_id} is registered with a different official email in HR records."
            )
    else:
        # Not on whitelist -> will require Admin approval queue resolution
        is_verified = False

    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="faculty"
    )
    db.add(new_user)
    db.flush()

    new_faculty = Faculty(
        user_id=new_user.id,
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        designation=payload.designation,
        department=payload.department,
        office_hours=payload.office_hours,
        id_verified=is_verified,
        id_card_url=payload.id_card_base64
    )
    db.add(new_faculty)
    db.commit()

    return {
        "message": "Faculty registered successfully.",
        "id_verified": is_verified,
        "status": "active" if is_verified else "pending_admin_approval"
    }

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if payload.role and user.role != payload.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account role is '{user.role}', not '{payload.role}'."
        )

    # Check faculty verification status
    if user.role == "faculty":
        faculty_rec = db.query(Faculty).filter(Faculty.user_id == user.id).first()
        if faculty_rec and not faculty_rec.id_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Faculty account is pending Admin Employee ID verification."
            )

    full_name = "User"
    if user.role == "student" and user.student_profile:
        full_name = user.student_profile.full_name
    elif user.role == "faculty" and user.faculty_profile:
        full_name = user.faculty_profile.full_name
    elif user.role == "admin" and user.admin_profile:
        full_name = user.admin_profile.full_name

    token = create_access_token({"sub": user.id, "role": user.role})
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=full_name
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Session logged out successfully."}

@router.post("/student/enroll-face")
def enroll_student_face(
    payload: FaceEnrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll face data.")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    try:
        ok, emb, crop_b64, msg = face_service.process_selfie_enrolment(payload.photo_base64)
    except RecognitionUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error))
    if not ok or not emb:
        raise HTTPException(status_code=400, detail=msg)

    student.face_embedding = emb
    student.face_enrolled = True
    student.face_model = face_service.model_name
    student.photo_url = crop_b64
    db.commit()

    return {
        "message": "Facial biometric embedding registered successfully (AES-256 encrypted at rest).",
        "face_enrolled": True,
        "photo_url": crop_b64
    }
