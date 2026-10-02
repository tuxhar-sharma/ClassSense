"""Synthetic fixtures for isolated automated tests only; never imported by the application."""
import os
import uuid
from datetime import datetime, timedelta
import numpy as np
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal, initialize_database
from app.api.deps import get_password_hash
from app.models.user import User, Student, Faculty, Admin, FacultyWhitelist
from app.models.course import Course, Enrollment, TimetableEntry
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.verification import VerificationQueue, Dispute, AuditLog

def generate_synthetic_embedding(seed_val: int) -> list:
    """Generates a reproducible 512-dimensional normalized face embedding."""
    rng = np.random.RandomState(seed_val)
    vec = rng.randn(512).astype(np.float32)
    norm = np.linalg.norm(vec)
    return (vec / norm).tolist()

def initialize_test_data():
    print("Initializing BPIT Smart Attendance Database schema...")
    initialize_database()
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        if db.query(User).filter(User.email == "admin@bpitindia.edu.in").first():
            print("Database is already seeded with sample data.")
            return

        print("Seeding Master Faculty Whitelist (HR List)...")
        whitelist_faculty = [
            FacultyWhitelist(employee_id="FAC-101", email="rajesh.kaushik@bpitindia.edu.in", full_name="Dr. Rajesh Kaushik", department="Computer Science & Engineering", designation="Associate Professor", registered=True),
            FacultyWhitelist(employee_id="FAC-102", email="neha.sharma@bpitindia.edu.in", full_name="Prof. Neha Sharma", department="Information Technology", designation="Assistant Professor", registered=True),
            FacultyWhitelist(employee_id="FAC-103", email="amit.verma@bpitindia.edu.in", full_name="Dr. Amit Verma", department="Information Technology", designation="Associate Professor", registered=False),
        ]
        db.add_all(whitelist_faculty)
        db.commit()

        print("Seeding Admin User (Ms. Priya Nair)...")
        admin_user = User(
            email="admin@bpitindia.edu.in",
            password_hash=get_password_hash("admin123"),
            role="admin"
        )
        db.add(admin_user)
        db.flush()
        admin_profile = Admin(user_id=admin_user.id, full_name="Ms. Priya Nair (IT Dept. Admin)")
        db.add(admin_profile)

        print("Seeding Faculty Accounts...")
        # 1. Dr. Rajesh Kaushik (Verified)
        fac1_user = User(
            email="rajesh.kaushik@bpitindia.edu.in",
            password_hash=get_password_hash("faculty123"),
            role="faculty"
        )
        db.add(fac1_user)
        db.flush()
        fac1_profile = Faculty(
            user_id=fac1_user.id,
            full_name="Dr. Rajesh Kaushik",
            employee_id="FAC-101",
            designation="Faculty Lead & Assoc. Prof",
            department="Computer Science & Engineering",
            office_hours="Mon-Thu 2:00 PM - 4:00 PM",
            id_verified=True
        )
        db.add(fac1_profile)

        # 2. Prof. Neha Sharma (Verified)
        fac2_user = User(
            email="neha.sharma@bpitindia.edu.in",
            password_hash=get_password_hash("faculty123"),
            role="faculty"
        )
        db.add(fac2_user)
        db.flush()
        fac2_profile = Faculty(
            user_id=fac2_user.id,
            full_name="Prof. Neha Sharma",
            employee_id="FAC-102",
            designation="Assistant Professor",
            department="Information Technology",
            office_hours="Tue-Fri 3:00 PM - 5:00 PM",
            id_verified=True
        )
        db.add(fac2_profile)

        # 3. Dr. Amit Verma (Pending Admin Approval for demo verification queue)
        fac3_user = User(
            email="amit.verma@bpitindia.edu.in",
            password_hash=get_password_hash("faculty123"),
            role="faculty"
        )
        db.add(fac3_user)
        db.flush()
        fac3_profile = Faculty(
            user_id=fac3_user.id,
            full_name="Dr. Amit Verma",
            employee_id="FAC-103",
            designation="Associate Professor",
            department="Information Technology",
            office_hours="Mon-Wed 1:00 PM - 3:00 PM",
            id_verified=False
        )
        db.add(fac3_profile)
        db.commit()

        print("Seeding Courses...")
        course1 = Course(course_code="IT302", course_name="Operating Systems", faculty_id=fac1_profile.id, room="LH-204", credits=4)
        course2 = Course(course_code="IT304", course_name="Machine Learning", faculty_id=fac1_profile.id, room="LH-205", credits=4)
        course3 = Course(course_code="IT306", course_name="Web Engineering", faculty_id=fac2_profile.id, room="Lab-3", credits=3)
        course4 = Course(course_code="IT308", course_name="Computer Networks", faculty_id=fac2_profile.id, room="LH-201", credits=4)
        db.add_all([course1, course2, course3, course4])
        db.commit()

        print("Seeding Students (with personas: Rohan Sharma, Simran Kaur, etc.)...")
        students_info = [
            {
                "email": "rohan.sharma@bpitindia.edu.in",
                "name": "Rohan Sharma",
                "roll": "04220803121",
                "seed": 101,
                "history_target_pct": 0.85 # ~85% healthy attendance
            },
            {
                "email": "simran.kaur@bpitindia.edu.in",
                "name": "Simran Kaur",
                "roll": "04320803121",
                "seed": 102,
                "history_target_pct": 0.70 # ~70% at-risk student!
            },
            {
                "email": "dhruv.raj@bpitindia.edu.in",
                "name": "Dhruv Raj",
                "roll": "04420803121",
                "seed": 103,
                "history_target_pct": 0.95 # ~95%
            },
            {
                "email": "aditi.sharma@bpitindia.edu.in",
                "name": "Aditi Sharma",
                "roll": "04520803121",
                "seed": 104,
                "history_target_pct": 0.90 # ~90%
            },
            {
                "email": "aryan.gupta@bpitindia.edu.in",
                "name": "Aryan Gupta",
                "roll": "04620803121",
                "seed": 105,
                "history_target_pct": 0.60 # ~60% critical at-risk!
            },
            {
                "email": "ananya.verma@bpitindia.edu.in",
                "name": "Ananya Verma",
                "roll": "04720803121",
                "seed": 106,
                "history_target_pct": 0.80 # ~80%
            }
        ]

        created_students = []
        for s in students_info:
            s_user = User(
                email=s["email"],
                password_hash=get_password_hash("student123"),
                role="student"
            )
            db.add(s_user)
            db.flush()

            st_profile = Student(
                user_id=s_user.id,
                full_name=s["name"],
                enrollment_no=s["roll"],
                semester="6th",
                branch="Information Technology",
                section="IT-1",
                phone="9876543210",
                face_embedding=None,
                face_enrolled=False
            )
            db.add(st_profile)
            db.flush()
            created_students.append((st_profile, s["history_target_pct"]))

            # Enroll student in all 4 courses
            for c in [course1, course2, course3, course4]:
                enr = Enrollment(student_id=st_profile.id, course_id=c.id)
                db.add(enr)

            # Seed Timetable for each student
            tt_schedule = [
                ("Monday", "09:00", "10:00", course1.id, "LH-204", "Lecture"),
                ("Monday", "10:00", "11:00", course2.id, "LH-205", "Lecture"),
                ("Monday", "11:30", "01:30", course3.id, "Lab-3", "Lab"),
                ("Tuesday", "09:00", "10:00", course4.id, "LH-201", "Lecture"),
                ("Tuesday", "10:00", "11:00", course1.id, "LH-204", "Lecture"),
                ("Wednesday", "10:00", "11:00", course2.id, "LH-205", "Lecture"),
                ("Wednesday", "11:30", "01:30", course4.id, "Lab-1", "Lab"),
                ("Thursday", "09:00", "10:00", course3.id, "LH-204", "Lecture"),
                ("Friday", "09:00", "10:00", course1.id, "LH-204", "Lecture")
            ]
            for day, start_t, end_t, cid, room, stype in tt_schedule:
                tt = TimetableEntry(
                    student_id=st_profile.id,
                    course_id=cid,
                    day_of_week=day,
                    start_time=start_t,
                    end_time=end_t,
                    room=room,
                    session_type=stype
                )
                db.add(tt)

        db.commit()

        print("Seeding Past Attendance Sessions & Records...")
        # Deterministic demo history: 20 sessions gives exact 85% and 70% personas.
        base_date = datetime.utcnow() - timedelta(days=28)
        
        sample_flagged_record_id = None
        sample_absent_record_id = None

        for sess_idx in range(20):
            sess_time = base_date + timedelta(days=sess_idx)
            session = AttendanceSession(
                course_id=course1.id,
                faculty_id=fac1_profile.id,
                session_date=sess_time,
                session_type="Lecture",
                image_count=3,
                status="completed"
            )
            db.add(session)
            db.flush()

            for st, target_pct in created_students:
                # Determine attendance probabilistically based on target percentage
                is_present = ((sess_idx * 7) % 20) < round(target_pct * 20)
                status_val = "present" if is_present else "absent"
                conf = 0.88 if is_present else 0.0

                # Introduce one pending review item on latest session for demo
                if sess_idx == 17 and st.full_name == "Simran Kaur":
                    status_val = "pending_review"
                    conf = 0.58

                rec = AttendanceRecord(
                    session_id=session.id,
                    student_id=st.id,
                    status=status_val,
                    confidence_score=conf,
                    faculty_verified=False,
                    auto_marked=True,
                    marked_at=sess_time
                )
                db.add(rec)
                db.flush()

                if status_val == "pending_review" and not sample_flagged_record_id:
                    sample_flagged_record_id = rec.id
                    # Add to Verification Queue
                    v_item = VerificationQueue(
                        session_id=session.id,
                        candidate_student_id=st.id,
                        similarity_score=0.58,
                        face_crop_data=None, # will render avatar placeholder
                        resolution_status="pending"
                    )
                    db.add(v_item)

                if st.full_name == "Rohan Sharma" and status_val == "absent" and not sample_absent_record_id:
                    sample_absent_record_id = rec.id

        # Add 1 active dispute for Rohan Sharma on a past absent class
        if sample_absent_record_id:
            rohan_student = db.query(Student).filter(Student.full_name == "Rohan Sharma").first()
            dispute = Dispute(
                attendance_record_id=sample_absent_record_id,
                student_id=rohan_student.id,
                reason="I was present in row 2 during the Operating Systems lecture on CPU scheduling. My face may have been partially occluded by the student in front.",
                status="pending"
            )
            db.add(dispute)

        db.commit()
        print("Database successfully seeded with BPIT Smart Attendance records!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        db.close()

