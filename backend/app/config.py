from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os
from pathlib import Path
from pydantic import Field
import secrets


def local_jwt_secret():
    configured = os.getenv("JWT_SECRET")
    if configured:
        return configured
    directory = Path(__file__).resolve().parents[1] / '.secrets'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / 'jwt.key'
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        return path.read_text(encoding='utf-8')
    with os.fdopen(descriptor, 'w', encoding='utf-8') as file:
        key = secrets.token_urlsafe(48)
        file.write(key)
        return key

class Settings(BaseSettings):
    PROJECT_NAME: str = "BPIT Smart Attendance System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret Key & JWT
    SECRET_KEY: str = Field(default_factory=local_jwt_secret)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    # SQLite or PostgreSQL; encrypted templates are matched in memory.
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{Path(__file__).resolve().parents[1] / 'classsense.db'}")
    BIOMETRIC_KEY_FILE: str = str(Path(__file__).resolve().parents[1] / '.secrets' / 'biometric.key')
    ARCFACE_MODEL_PATH: str = str(Path(__file__).resolve().parents[1] / 'models' / 'w600k_r50.onnx')
    FACE_DETECTOR_MODEL_PATH: str = str(Path(__file__).resolve().parents[1] / 'models' / 'det_10g.onnx')
    MAX_IMAGE_BYTES: int = 10 * 1024 * 1024
    
    # Institutional Domain Restrictions
    ALLOWED_EMAIL_DOMAINS: List[str] = [
        "bpitindia.edu.in",
        "ipu.ac.in",
        "gmail.com" # Supports project participants using personal email.
    ]
    
    # Multi-Image Face Aggregation Thresholds (MoSCoW Specs)
    HIGH_CONFIDENCE_THRESHOLD: float = 0.65  # >= 0.65 auto-marks Present
    LOW_CONFIDENCE_THRESHOLD: float = 0.45   # 0.45 <= score < 0.65 routes to Verification Queue
    MIN_IMAGE_APPEARANCES: int = 2           # Must be seen in at least 2 images (for 3-4 images)
    
    # Academic Attendance Cutoff
    ATTENDANCE_TARGET_PERCENTAGE: float = 75.0
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(case_sensitive=True, env_file=str(Path(__file__).resolve().parents[1] / '.env'), extra='ignore')

settings = Settings()
