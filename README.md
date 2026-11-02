# ClassSense — BPIT Smart Attendance

ClassSense manages student, faculty, and administrator attendance workflows. Faculty submit 3–4 distinct classroom photographs. SCRFD detects faces and ArcFace generates normalized 512-dimensional templates. At least two high-scoring, unambiguous sightings are required for automatic presence; uncertain matches and students without current templates require faculty review.

## Start on this computer

After installing the dependencies and ONNX models using the fresh-checkout commands below, run from the project root:

```powershell
.\start.ps1
```

Open http://localhost:5173. API docs: http://localhost:8000/docs. Logs and server process IDs are in `.runtime`. The launcher starts hidden server processes and rejects occupied ports. Stop the ClassSense processes before restarting. It preserves registered accounts and attendance data and never inserts sample records.

For a fresh checkout, use Python 3.12 and Node.js 22+:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe backend\setup_models.py
npm.cmd --prefix frontend ci
.\start.ps1
```

`start.ps1 -Install` also installs dependencies. Model weights, local databases, private keys, dependencies, and generated build files are excluded from Git.

Optional configuration: `backend/.env.example` and `frontend/.env.example`. SQLite uses `backend/classsense.db`; PostgreSQL uses psycopg. Templates are encrypted text fields matched in application memory, rather than a database vector index.

## First-time setup and real accounts

Open http://localhost:5173 and create your administrator with your own name, email, and password. Setup is available only on localhost and closes after an administrator exists. There are no default credentials, sample courses, or generated attendance histories.

1. Students register with a clear selfie and consent. Existing students should open Face Enrollment and re-enroll if a current template is missing.
2. Faculty register with their employee ID. The administrator approves pending registrations or imports an official faculty whitelist.
3. Admin creates a course with branch, semester, section and room, then assigns approved faculty. Faculty opens **Class Roster & Enrollment**, selects the assigned class, and enrolls matching registered students. Admin CSV import remains available as an alternative.
4. Admin sets the weekly timetable after students have been enrolled.
5. Assigned faculty capture/upload 3?4 distinct JPEG/PNG classroom images, up to 10 MB each. Completed sessions are saved under **Session History & Retakes**, with a student attendance list. Use **Retake attendance** with a reason and 3?4 classroom images to update that same session; earlier results and audit history remain available.
6. Faculty confirm/reject uncertain matches or manually assign a detected face to a student in that session. Students without enrollment require an actual manual attendance check.
7. Students view their attendance and dispute absent records. Faculty resolve disputes, make corrections with reasons, and export authenticated Excel/PDF registers. Corrections create audit entries.

Faculty HR CSV needs `employee_id,email,full_name`; optional columns are `department,designation`. Matching employee ID/email registrations are verified; others require approval. Conflicting imports fail without partially importing rows.

See [DEFENSE.md](DEFENSE.md) for the live walkthrough and technical explanation. Automated test fixtures exist only under `backend/tests`; application startup never imports them.

## Models and data

Scores are cosine similarity, not calibrated identity probabilities. Defaults are 0.65 for high matches, 0.45 for review, and two high-confidence appearances for automatic presence. Close competing matches require review. Validate thresholds with representative classroom captures before relying on automatic marking; no classroom accuracy or processing-speed guarantee has been measured.

Templates use AES-256-GCM encryption. Back up `backend/.secrets/biometric.key` together with the database; losing it makes templates unreadable. A separate development signing key is generated locally. Use persistent private signing secrets for deployment.

Full classroom frames are processed in memory. Enrollment thumbnails and review face crops are stored for authorized review and are also biometric data. Establish institutional consent, retention and deletion practices before deployment. Check the upstream model license for uses outside this academic project: https://github.com/deepinsight/insightface.

## Checks

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```

Tests use a temporary database and encryption key, never the working database. They cover permissions, login/profile IDs, attendance calculations, multi-frame aggregation, actual ONNX inference, encryption, corrections, disputes, reports, course assignment, timetable propagation and CSV imports. Real-model tests skip if weights or the InsightFace sample image are unavailable.

Docker Compose provisions PostgreSQL, backend, and nginx frontend on port 5173. Install models before building and configure private secrets/credentials. Container configuration is not yet runtime-verified here. Browser, webcam and representative classroom checks remain necessary; this coding environment has no connected browser.

Stack: React, TypeScript, Vite, Tailwind, Zustand, Recharts; FastAPI, SQLAlchemy, Pydantic; OpenCV, InsightFace, ONNX Runtime; SQLite/PostgreSQL; openpyxl and ReportLab.

## Scheduled attendance and absence alerts

The backend scheduler checks every 15 seconds and automatically opens one attendance session per configured timetable period. Weekly timetable times use India Standard Time (UTC+05:30). Configure real courses, assigned faculty, enrolled students, and timetable slots through the admin screens first. No sample timetable is inserted. Captures must be submitted before the period ends; an unused window expires without marking the class absent. Completed attendance remains available for review and audited retakes.

Faculty can schedule an extra class with start and end date/time on the attendance capture page. Times entered there use the device timezone. Extra classes require an assigned faculty member and enrolled students. Overlapping windows for that course are rejected. Restart the backend after updating to create the additive window and notification tables.

Students receive saved absence alerts with an ?I was present? correction request action. Alerts cover absent students because a missed facial recognition result cannot establish whether someone was physically present. Corrected records disappear from the alert list. Enable device alerts in the student header to allow browser notifications. This version polls while the student is signed in with the app open; it does not provide background push delivery when the app is closed. Browser/OS support and notification permission are required for device popups; the in-app inbox remains available without permission.
