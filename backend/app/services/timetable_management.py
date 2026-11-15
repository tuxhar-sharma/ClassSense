"""Versioned publication, faculty assignment, class schedules and notification delivery."""
import csv
import hashlib
import io
import json
import re
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from fastapi import HTTPException
from sqlalchemy import or_
from app.models.course import Course, CourseScheduledSlot
from app.models.attendance import AttendanceWindow, AttendanceSession
from app.models.user import Faculty, Student
from app.models.timetable import TimetablePublication, TimetableNotification
from app.schemas.timetable import PublishTimetable
from app.services.department_timetable import department_timetable

CAMPUS_TZ = timezone(timedelta(hours=5, minutes=30))

def campus_date():
    return datetime.now(CAMPUS_TZ).date()

def name_key(value):
    return re.sub(r'[^a-z0-9]', '', re.sub(r'^(?:dr|prof|mrs|ms|mr)\.?\s*', '', value.strip(), flags=re.I).lower())

def cohort_key(student):
    branch = re.sub(r'[^a-z]', '', student.branch.lower())
    semester = re.match(r'^\s*([1-8])(?:st|nd|rd|th)?(?:\s+semester)?\s*$', student.semester.lower())
    section = re.sub(r'[^A-Z0-9]', '', student.section.upper()).removeprefix('IT')
    return (int(semester[1]), section) if branch in {'it', 'informationtechnology'} and semester and section in 'ABC' and len(section) == 1 else None

def faculty_courses(db, faculty_id, active_only=True):
    query = db.query(Course).filter(or_(Course.faculty_id == faculty_id, Course.instructors.any(Faculty.id == faculty_id)))
    return query.filter(Course.is_active.is_(True)) if active_only else query

def latest_publication(db, semester, section, effective_only=True):
    query = db.query(TimetablePublication).filter_by(branch='Information Technology', semester=semester, section=section)
    if effective_only:
        query = query.filter(TimetablePublication.effective_from <= campus_date())
        return query.order_by(TimetablePublication.effective_from.desc(), TimetablePublication.revision.desc()).first()
    return query.order_by(TimetablePublication.revision.desc()).first()

def identity(subject):
    return (subject['course_name'], subject['course_code'], subject.get('lab_group', ''))

def sync_course_assignments(db, publication):
    payload = json.loads(publication.content)
    old_courses = db.query(Course).filter(Course.timetable_key.isnot(None), Course.branch == publication.branch,
        Course.semester == publication.semester, Course.section == publication.section).all()
    old_ids = [course.id for course in old_courses]
    for course in old_courses:
        course.is_active = False
    if old_ids:
        db.query(CourseScheduledSlot).filter(CourseScheduledSlot.course_id.in_(old_ids)).delete(synchronize_session=False)
        for window in db.query(AttendanceWindow).filter(AttendanceWindow.course_id.in_(old_ids), AttendanceWindow.source == 'timetable').all():
            if window.session_id:
                session = db.get(AttendanceSession, window.session_id)
                if session and session.status == 'in_progress':
                    session.status = 'expired'
            db.delete(window)
    subjects = {identity(row): row for row in [*payload['entries'], *payload.get('subjects', [])]}
    course_map = {}
    for (name, code, group), row in subjects.items():
        if not row['faculty_ids']:
            continue
        key = f"IT:{publication.semester}:{publication.section}:{code or name}:{group}"
        course = db.query(Course).filter_by(timetable_key=key).first()
        if not course:
            readable = re.sub(r'[^A-Za-z0-9-]', '', code or name)[:23]
            display_code = f"IT{publication.semester[0]}{publication.section}-{readable}{'-'+group if group else ''}"
            if db.query(Course).filter_by(course_code=display_code).first():
                display_code += '-' + hashlib.sha256(key.encode()).hexdigest()[:6]
            course = Course(course_code=display_code, timetable_key=key)
            db.add(course)
        course.course_name = name
        course.subject_code = code
        course.branch = publication.branch
        course.semester = publication.semester
        course.section = publication.section
        course.lab_group = group
        course.faculty_id = row['faculty_ids'][0]
        course.instructors = [db.get(Faculty, value) for value in dict.fromkeys(row['faculty_ids'])]
        course.room = next((entry['room'] for entry in payload['entries'] if identity(entry) == (name, code, group) and entry['room']), '')
        course.is_active = True
        db.flush()
        course_map[(name, code, group)] = course
    for entry in payload['entries']:
        course = course_map.get(identity(entry))
        if course:
            db.add(CourseScheduledSlot(course_id=course.id, **{key: entry[key] for key in ['day_of_week', 'start_time', 'end_time', 'room', 'session_type']}))
    publication.applied_at = datetime.utcnow()
    return len(course_map)

def activate_due_timetables(db):
    cohorts = db.query(TimetablePublication.semester, TimetablePublication.section).distinct().all()
    for semester, section in cohorts:
        current = latest_publication(db, semester, section)
        if current and not current.applied_at:
            sync_course_assignments(db, current)
    db.flush()

def validate_faculty(db, payload):
    ids = {value for row in [*payload.entries, *payload.subjects] for value in row.faculty_ids}
    found = {row.id for row in db.query(Faculty).filter(Faculty.id.in_(ids), Faculty.id_verified.is_(True)).all()}
    if ids != found:
        raise HTTPException(400, 'Every assigned faculty member must be a registered, approved faculty account.')

def publish_timetable(db, payload, actor):
    validate_faculty(db, payload)
    previous = latest_publication(db, payload.semester, payload.section, effective_only=False)
    revision = previous.revision if previous else 0
    if revision != payload.expected_revision:
        raise HTTPException(409, 'This class timetable changed. Reload the latest version before publishing.')
    publication = TimetablePublication(branch=payload.branch, semester=payload.semester, section=payload.section,
        revision=revision + 1, effective_from=payload.effective_from,
        content=payload.model_dump_json(), created_by=actor.id)
    db.add(publication)
    db.flush()
    faculty_ids = {value for row in [*payload.entries, *payload.subjects] for value in row.faculty_ids}
    if previous:
        previous_data = json.loads(previous.content)
        faculty_ids.update(value for row in [*previous_data['entries'], *previous_data.get('subjects', [])] for value in row['faculty_ids'])
    recipients = {faculty.user_id for faculty in db.query(Faculty).filter(Faculty.id.in_(faculty_ids)).all()}
    key = (int(payload.semester[0]), payload.section)
    recipients.update(student.user_id for student in db.query(Student).all() if cohort_key(student) == key)
    for user_id in recipients:
        db.add(TimetableNotification(publication_id=publication.id, user_id=user_id,
            title=f'New timetable: IT {payload.section}, {payload.semester} semester',
            message=f'{payload.title} — version {publication.revision}, effective {payload.effective_from.isoformat()}. Open your timetable to review subjects, faculty, rooms and lab batches.'))
    activate_due_timetables(db)
    return {'message': 'Timetable published; course assignments updated and notifications saved.',
        'publication_id': publication.id, 'revision': publication.revision, 'notifications': len(recipients),
        'scheduled_for_future': payload.effective_from > campus_date()}

def render_publication(db, publication, group=''):
    data = json.loads(publication.content)
    result = department_timetable(SimpleNamespace(branch=publication.branch, semester=publication.semester, section=publication.section, lab_group=group))
    faculty = {row.id: row.full_name for row in db.query(Faculty).all()}
    result.update(available=True, message='', class_label=f'IT {publication.section} · {publication.semester} semester',
        revision=publication.revision, publication_id=publication.id, lab_group=group, entries=[], faculty_assignments=[],
        warnings=list(data.get('notes', [])), printed_semester_label='Published in ClassSense')
    result['source'] = {**result['source'], 'title': data['title'], 'document': data['source_document'],
        'effective_from': publication.effective_from.isoformat(), 'issued_on': publication.created_at.date().isoformat(),
        'signed_by': 'ClassSense administrator', 'issuer': 'ClassSense administrator', 'notes': data.get('notes', [])}
    academic_start = publication.effective_from.year - (publication.effective_from.month < 7)
    result['source']['academic_year'] = f'{academic_start}-{str(academic_start + 1)[-2:]}'
    if not group:
        result['warnings'].append('Lab batch is not selected. Both G1 and G2 are shown.')
    by_slot = {}
    for entry in data['entries']:
        key = (entry['day_of_week'], entry['start_time'], entry['end_time'])
        by_slot[key] = by_slot.get(key, 0) + 1
    for index, entry in enumerate(data['entries']):
        if group and entry['lab_group'] and entry['lab_group'] != group:
            continue
        slot = (entry['day_of_week'], entry['start_time'], entry['end_time'])
        result['entries'].append({**entry, 'id': f'{publication.id}-{index}', 'course_id': '',
            'faculty_name': ' / '.join(faculty.get(value, 'Former faculty member') for value in entry['faculty_ids']),
            'source': 'department', 'room_source': 'cell' if entry['room'] else 'not specified',
            'slot_key': '-'.join(slot), 'parallel_slot': by_slot[slot] > 1})
    for row in {identity(row): row for row in [*data['entries'], *data.get('subjects', [])]}.values():
        result['faculty_assignments'].append({'subject': row['course_name'], 'code': row['course_code'],
            'faculty_name': ' / '.join(faculty.get(value, 'Former faculty member') for value in row['faculty_ids']),
            'lab_group': row['lab_group'], 'scheduled': any(identity(entry) == identity(row) for entry in data['entries'])})
    return result

def student_timetable(db, student):
    key = cohort_key(student)
    if key:
        semester = {1:'1st', 2:'2nd', 3:'3rd', 4:'4th', 5:'5th', 6:'6th', 7:'7th', 8:'8th'}[key[0]]
        publication = latest_publication(db, semester, key[1])
        if publication:
            return render_publication(db, publication, student.lab_group or '')
    return department_timetable(student)

def catalog_payload(db, semester, section):
    result = department_timetable(SimpleNamespace(branch='Information Technology', semester=semester, section=section, lab_group=''))
    if not result['available']:
        raise HTTPException(404, 'No supplied timetable exists for this class.')
    faculty_by_name = {name_key(f.full_name): f.id for f in db.query(Faculty).filter_by(id_verified=True).all()}
    def faculty_ids(label):
        names = [name.strip() for name in re.split(r'[,/&]', label) if name.strip()]
        missing = [name for name in names if name_key(name) not in faculty_by_name]
        if missing:
            raise HTTPException(400, 'Register and approve these faculty first: ' + ', '.join(missing))
        return [faculty_by_name[name_key(name)] for name in names]
    entries = [{**{key: entry[key] for key in ['course_name', 'course_code', 'lab_group', 'day_of_week', 'start_time', 'end_time', 'room', 'session_type', 'source_note', 'period', 'notation']},
        'faculty_ids': faculty_ids(entry['faculty_name'])} for entry in result['entries']]
    subjects = []
    for row in result['faculty_assignments']:
        if not row['scheduled'] and row['faculty_name']:
            subjects.append({'course_name': row['subject'], 'course_code': row['code'], 'lab_group': row['lab_group'], 'faculty_ids': faculty_ids(row['faculty_name'])})
    previous = latest_publication(db, semester, section, effective_only=False)
    return PublishTimetable(title=result['source']['title'], semester=semester, section=section,
        effective_from=result['source']['effective_from'], source_document=result['source']['document'],
        entries=entries, subjects=subjects, notes=[*result['source']['notes'], *result['warnings']], expected_revision=previous.revision if previous else 0)

def parse_upload(contents, filename, metadata):
    try:
        if filename.lower().endswith('.json'):
            data = json.loads(contents.decode('utf-8-sig'))
            return PublishTimetable.model_validate(data)
        if not filename.lower().endswith('.csv'):
            raise HTTPException(400, 'Upload the CSV template or an exported JSON timetable. Scanned PDFs/photos must be transcribed using Create timetable before publication.')
        rows = list(csv.DictReader(io.StringIO(contents.decode('utf-8-sig'))))
        entries = []
        for row in rows:
            entries.append({**row, 'faculty_ids': [value.strip() for value in row.get('faculty_ids', '').split(';') if value.strip()]})
        return PublishTimetable.model_validate({**metadata, 'entries': entries, 'subjects': [], 'source_document': filename})
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(400, 'Use a UTF-8 CSV file or valid JSON timetable.') from error
