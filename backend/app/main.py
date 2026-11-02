import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, initialize_database
import app.models # Register all models

from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.faculty import router as faculty_router
from app.api.admin import router as admin_router
from app.api.reports import router as reports_router
from app.services.face_recognition import face_service

# Create database tables automatically
initialize_database()

from app.api.windows import router as windows_router
from app.database import SessionLocal
from app.services.session_windows import sync_windows

@asynccontextmanager
async def lifespan(app):
    def tick():
        with SessionLocal() as db:
            sync_windows(db)
    async def run():
        while True:
            try:
                await asyncio.to_thread(tick)
            except Exception:
                logging.getLogger(__name__).exception("Attendance scheduler failed; retrying")
            await asyncio.sleep(15)
    task = asyncio.create_task(run())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task

app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="BPIT Smart Attendance System — Multi-Image Facial Recognition with Confidence-Aware Faculty Verification."
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
api_prefix = settings.API_V1_STR
app.include_router(windows_router, prefix=api_prefix)
app.include_router(auth_router, prefix=api_prefix)
app.include_router(students_router, prefix=api_prefix)
app.include_router(faculty_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)

@app.get("/health", tags=["Health"])
@app.get(f"{api_prefix}/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "BPIT Smart Attendance System Backend",
        "version": settings.VERSION,
        "database": "connected",
        "recognition": {"model": face_service.model_name, "models_installed": face_service.ready}
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to BPIT Smart Attendance System API",
        "docs": "/docs",
        "version": settings.VERSION
    }
