# ClassSense minor-project defense

## Prepare your real walkthrough

Start with `start.ps1` and open http://localhost:5173. Create your personal administrator account on the first-run screen. Your existing two student and one faculty registrations have been preserved; the administrator, courses, histories, and other seeded data were removed.

Before the defense, register participating classmates with their consent and real selfies. Use a clear frontal image with one face and good lighting. Existing registrations must re-enroll if Face Enrollment says their template is missing. Register or sign in as your faculty account; approve it if necessary. Create a real course with the students' branch, semester and section plus the classroom. Assign that faculty member. Faculty opens Class Roster & Enrollment, selects the course, and enrolls matching registered classmates. Add the weekly timetable. New students inherit existing class slots when enrolled.

For your live walkthrough:

1. Show the student dashboard and timetable before any attendance session. It should say that attendance is awaiting its first session.
2. Sign in as assigned faculty. Start a session and capture 3–4 distinct views of the consenting participants. Keep faces large, visible, and well lit.
3. Open Session History & Retakes to show the saved student list. If the capture missed a participant, enter a reason and retake attendance using new photos. Show the earlier result version and that the total remains one class. Show each result's similarity and appearance count. Open the verification queue and resolve any uncertain matches using the actual participant's identity.
4. Sign in as a student and show that attendance/history reflects the completed session. To demonstrate disputes, use a genuine missed detection or a faculty correction with an explicit reason, then resolve it through faculty review.
5. Show the administrator audit log and export the faculty Excel/PDF register.

Rehearse this full flow on the presentation laptop before the defense. Keep the models installed so inference does not depend on an internet connection. Camera access may require browser permission; the upload option accepts photographs if camera access is unavailable.

## Explain the implementation

The React frontend sends authenticated requests to FastAPI. JWT identifies the account, while backend role checks and course ownership limit access. Students can access their own records; faculty can manage their assigned courses; administrators manage registration approval, courses, rosters, and timetables.

SCRFD detects faces and facial landmarks. Five-point alignment transforms each face to a 112 × 112 image. A pretrained ArcFace model produces a normalized 512-dimensional embedding. Cosine similarity compares detected faces with enrolled templates. This project runs inference using pretrained weights; it does not train ArcFace from scratch.

Multi-image aggregation requires at least two high-scoring, unambiguous sightings before automatically marking someone present. The defaults are 0.65 for a high match and 0.45 for review. Close competing identities and single sightings go to faculty review. Missing face enrollment also requires manual review. Scores are similarity measures, not identity probabilities.

Attendance percentage is present records divided by the student's completed session records. A newly enrolled student is not counted absent for sessions held before joining the roster. For a 75% target, the safe absence allowance is `floor(present / 0.75 - conducted)`, clamped to zero. Required recovery classes solve `(present + x) / (conducted + x) >= 0.75`, giving `ceil((0.75 * conducted - present) / 0.25)`, clamped to zero.

Face templates use AES-256-GCM encryption at rest. Full classroom frames are processed in memory; enrollment thumbnails and review crops remain stored for authorized review. The encryption key must be backed up with the database. Manual corrections and dispute resolutions create audit entries.

## State the practical limits accurately

Crowded views, small faces, blur, occlusion, and poor light can reduce recognition quality. Thresholds need validation against representative classroom images. Multiple views reduce reliance on a single image, but they do not guarantee zero errors or prove liveness. Faculty oversight remains necessary. Accuracy and speed have not been measured on a representative classroom dataset.

The local database is SQLite; PostgreSQL configuration is available. Matching runs in application memory, so large rosters need performance evaluation. Model license, biometric consent, retention, and deletion policies need review before an institutional deployment.

Run `python -m pytest` using the project `.venv` and `npm.cmd --prefix frontend run build` to reproduce automated checks. Tests use an isolated temporary database; their synthetic records never appear in the working application. Automated API/model tests do not replace the laptop webcam and browser rehearsal.
