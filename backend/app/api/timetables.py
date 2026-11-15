import csv
import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import require_role, get_current_user
from app.api.access import resolve_faculty
from app.models.user import User, Student, Faculty
from app.models.course import Course
from app.models.timetable import TimetablePublication, TimetableNotification
from app.schemas.timetable import PublishTimetable
from app.services.timetable_management import (publish_timetable, parse_upload, validate_faculty, catalog_payload,
    latest_publication, faculty_courses, render_publication, campus_date)

router = APIRouter(tags=['Timetable management'])
admin = require_role(['admin'])

def course_info(course):
    names = list(dict.fromkeys(([course.faculty.full_name] if course.faculty else []) + [f.full_name for f in course.instructors]))
    return {'id': course.id, 'course_code': course.course_code, 'subject_code': course.subject_code,
        'course_name': course.course_name, 'branch': course.branch, 'semester': course.semester, 'section': course.section,
        'lab_group': course.lab_group, 'faculty_name': ' / '.join(names) or 'Unassigned', 'room': course.room,
        'enrolled_count': len(course.enrollments), 'is_active': course.is_active}

@router.get('/admin/directory/faculty')
def faculty_directory(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [{'id': f.id, 'full_name': f.full_name, 'email': f.user.email, 'employee_id': f.employee_id,
        'verified': f.id_verified, 'courses': [course_info(c) for c in faculty_courses(db, f.id).order_by(Course.semester, Course.section, Course.course_name).all()]}
        for f in db.query(Faculty).order_by(Faculty.full_name).all()]

@router.get('/admin/directory/students')
def student_directory(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [{'id': s.id, 'full_name': s.full_name, 'email': s.user.email, 'enrollment_no': s.enrollment_no,
        'branch': s.branch, 'semester': s.semester, 'section': s.section, 'lab_group': s.lab_group,
        'courses': [course_info(e.course) for e in s.enrollments if e.course.is_active]}
        for s in db.query(Student).order_by(Student.enrollment_no).all()]

@router.get('/admin/directory/courses')
def course_directory(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [course_info(c) for c in db.query(Course).filter_by(is_active=True).order_by(Course.semester, Course.section, Course.course_name).all()]

@router.get('/admin/timetables')
def publications(user: User = Depends(admin), db: Session = Depends(get_db)):
    return [{'id': p.id, 'semester': p.semester, 'section': p.section, 'revision': p.revision,
        'effective_from': p.effective_from, 'created_at': p.created_at, 'title': json.loads(p.content)['title']}
        for p in db.query(TimetablePublication).order_by(TimetablePublication.created_at.desc()).all()]

@router.get('/admin/timetables/class/{semester}/{section}')
def class_timetable(semester: str, section: str, user: User = Depends(admin), db: Session = Depends(get_db)):
    publication = latest_publication(db, semester, section, effective_only=False)
    if publication:
        data = json.loads(publication.content)
        data['expected_revision'] = publication.revision
        return data
    if semester in {'3rd', '5th', '7th'} and section in 'ABC' and len(section) == 1:
        return catalog_payload(db, semester, section).model_dump(mode='json')
    return {'title': 'IT department timetable', 'branch': 'Information Technology', 'semester': semester,
        'section': section, 'effective_from': campus_date().isoformat(), 'expected_revision': 0, 'entries': [], 'subjects': [], 'notes': [], 'source_document': 'Created in ClassSense'}

@router.post('/admin/timetables/preview')
async def preview(file: UploadFile = File(...), metadata: str = Form(...), user: User = Depends(admin), db: Session = Depends(get_db)):
    contents = await file.read(2 * 1024 * 1024 + 1)
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(413, 'Timetable files must be at most 2 MB.')
    try:
        payload = parse_upload(contents, file.filename or '', json.loads(metadata))
        validate_faculty(db, payload)
    except (ValidationError, ValueError, TypeError) as error:
        raise HTTPException(422, str(error))
    return payload.model_dump(mode='json')

@router.post('/admin/timetables/publish')
def publish(payload: PublishTimetable, user: User = Depends(admin), db: Session = Depends(get_db)):
    try:
        result = publish_timetable(db, payload, user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Timetable changed during publication. Reload and try again.')
    return result

@router.get('/admin/timetables/template.csv')
def template(user: User = Depends(admin), db: Session = Depends(get_db)):
    output = io.StringIO()
    fields = ['day_of_week', 'start_time', 'end_time', 'course_name', 'course_code', 'faculty_ids', 'room', 'session_type', 'lab_group', 'source_note']
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    faculty = db.query(Faculty).filter_by(id_verified=True).first()
    writer.writerow(dict(zip(fields, ['Monday', '09:30', '10:20', 'Subject abbreviation', 'SUB-101', faculty.id if faculty else '', '301', 'Lecture', '', 'Replace the example with your actual schedule'])))
    return Response(output.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename="ClassSense_Timetable_Template.csv"'})

@router.get('/faculty/{faculty_id}/timetable')
def faculty_timetable(faculty_id: str, user: User = Depends(require_role(['faculty', 'admin'])), db: Session = Depends(get_db)):
    faculty = resolve_faculty(db, faculty_id, user)
    cohorts = db.query(TimetablePublication.semester, TimetablePublication.section).distinct().all()
    entries, upcoming = [], []
    for semester, section in cohorts:
        publication = latest_publication(db, semester, section)
        if publication:
            rendered = render_publication(db, publication)
            for entry in rendered['entries']:
                if faculty.id in entry['faculty_ids']:
                    entries.append({**entry, 'semester': semester, 'section': section, 'effective_from': publication.effective_from})
        future = db.query(TimetablePublication).filter_by(semester=semester, section=section).filter(TimetablePublication.effective_from > campus_date()).order_by(TimetablePublication.effective_from).all()
        for item in future:
            for entry in render_publication(db, item)['entries']:
                if faculty.id in entry['faculty_ids']:
                    upcoming.append({**entry, 'semester': semester, 'section': section, 'effective_from': item.effective_from, 'revision': item.revision})
    return {'entries': entries, 'upcoming': upcoming}

@router.get('/timetable-notifications')
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [{'id': n.id, 'title': n.title, 'message': n.message, 'read': n.read_at is not None,
        'created_at': n.created_at, 'publication_id': n.publication_id}
        for n in db.query(TimetableNotification).filter_by(user_id=user.id).order_by(TimetableNotification.created_at.desc()).limit(100).all()]

@router.post('/timetable-notifications/{notification_id}/read')
def read_notification(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(TimetableNotification).filter_by(id=notification_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, 'Notification not found.')
    item.read_at = datetime.utcnow()
    db.commit()
    return {'message': 'Notification marked as read.'}

@router.get('/timetable-notifications/{notification_id}/timetable')
def notification_timetable(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(TimetableNotification).filter_by(id=notification_id, user_id=user.id).first()
    if not item:
        raise HTTPException(404, 'Notification not found.')
    publication = db.get(TimetablePublication, item.publication_id)
    result = render_publication(db, publication, user.student_profile.lab_group if user.role == 'student' else '')
    if user.role == 'faculty':
        result['entries'] = [entry for entry in result['entries'] if user.faculty_profile.id in entry['faculty_ids']]
    return result
