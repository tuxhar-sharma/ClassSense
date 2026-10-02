import json
from typing import List, Optional
import numpy as np
from sqlalchemy import create_engine, TypeDecorator, TEXT, String, inspect, text, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings
from app.services.biometrics import encrypt_embedding, decrypt_embedding, PREFIX

# Engine configuration
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(
    database_url,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

if is_sqlite:
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

# Encrypted template adapter for SQLite and PostgreSQL.
class VectorType(TypeDecorator):
    """
    Stores AES-256-GCM encrypted embeddings as text on SQLite or PostgreSQL.
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, np.ndarray):
            value = value.tolist()
        if not isinstance(value, list):
            raise ValueError("Face embedding must be a list of numbers.")
        return encrypt_embedding(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return decrypt_embedding(value)
        return value


def initialize_database():
    """Apply additive schema changes and encrypt legacy embeddings without deleting data."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    changes = {
        "attendance_records": {"appearances": "INTEGER NOT NULL DEFAULT 0"},
        "attendance_sessions": {"revision": "INTEGER NOT NULL DEFAULT 1"},
        "students": {"face_model": "VARCHAR(50) NOT NULL DEFAULT 'legacy'"},
        "courses": {"branch": "VARCHAR(50) NOT NULL DEFAULT ''", "semester": "VARCHAR(10) NOT NULL DEFAULT ''", "section": "VARCHAR(10) NOT NULL DEFAULT ''"},
    }
    with engine.begin() as connection:
        # Enrollment IDs have no dependent tables. Keep one membership per class/student.
        enrollments = connection.execute(text("SELECT id, course_id, student_id FROM enrollments ORDER BY id")).all()
        seen = set()
        for enrollment_id, course_id, student_id in enrollments:
            key = (course_id, student_id)
            if key in seen:
                connection.execute(text("DELETE FROM enrollments WHERE id=:id"), {"id": enrollment_id})
            seen.add(key)
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_course_student_enrollment ON enrollments (course_id, student_id)"))
        for table, columns in changes.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, declaration in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}"))
        rows = connection.execute(text("SELECT id, face_embedding FROM students WHERE face_embedding IS NOT NULL")).all()
        for student_id, embedding in rows:
            if not embedding.startswith(PREFIX):
                encrypted = encrypt_embedding(json.loads(embedding))
                connection.execute(text("UPDATE students SET face_embedding=:embedding WHERE id=:id"), {"embedding": encrypted, "id": student_id})

def get_db():
    """FastAPI dependency for database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def compute_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes cosine similarity between two 512-d normalized vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))
