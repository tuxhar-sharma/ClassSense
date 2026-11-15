import copy
import json
from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.api.deps import create_access_token
from app.models.user import User, Student, Faculty
from app.models.course import Course, CourseScheduledSlot, Enrollment
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.attendance import AttendanceWindow
from app.services.session_windows import sync_windows
from app.models.timetable import TimetablePublication, TimetableNotification
from app.services.timetable_management import campus_date, activate_due_timetables


@pytest.fixture
def setup():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        for identifier, role in [('admin', 'admin'), ('f1', 'faculty'), ('f2', 'faculty'), ('pending', 'faculty'), ('s1', 'student'), ('s2', 'student')]:
            db.add(User(id=identifier, email=f'{identifier}@example.com', password_hash='unused', role=role))
        db.flush()
        for identifier in ['f1', 'f2', 'pending']:
            db.add(Faculty(id=identifier, user_id=identifier, employee_id=identifier, full_name=identifier, id_verified=identifier != 'pending'))
        for identifier, section in [('s1', 'A'), ('s2', 'B')]:
            db.add(Student(id=identifier, user_id=identifier, full_name=identifier, enrollment_no=identifier, branch='Information Technology', semester='3rd', section=section, lab_group='G1'))
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        def headers(identifier):
            user = db.get(User, identifier)
            return {'Authorization': 'Bearer ' + create_access_token({'sub': user.id, 'role': user.role})}
        try:
            yield TestClient(app), db, headers
        finally:
            app.dependency_overrides.pop(get_db, None)
    engine.dispose()


def payload(**updates):
    return {'title': 'IT A timetable', 'semester': '3rd', 'section': 'A', 'effective_from': campus_date().isoformat(),
        'entries': [{'course_name': 'DS Lab', 'course_code': 'CIC-255', 'faculty_ids': ['f1', 'f2'], 'lab_group': 'G1',
            'day_of_week': 'Monday', 'start_time': '09:30', 'end_time': '11:10', 'room': '102-C', 'session_type': 'Lab'}], **updates}


def test_publish_links_coteachers_and_scoped_notifications(setup):
    client, db, headers = setup
    response = client.post('/api/v1/admin/timetables/publish', json=payload(), headers=headers('admin'))
    assert response.status_code == 200, response.text
    assert response.json()['notifications'] == 3
    course = db.query(Course).one()
    assert {f.id for f in course.instructors} == {'f1', 'f2'}
    assert course.lab_group == 'G1' and course.section == 'A'
    assert db.query(CourseScheduledSlot).one().room == '102-C'
    for identifier in ['f1', 'f2']:
        courses = client.get(f'/api/v1/faculty/{identifier}/courses', headers=headers(identifier)).json()
        assert [row['id'] for row in courses] == [course.id]
        assert client.get(f'/api/v1/courses/{course.id}/roster', headers=headers(identifier)).status_code == 200
        schedule = client.get(f'/api/v1/faculty/{identifier}/timetable', headers=headers(identifier)).json()
        assert len(schedule['entries']) == 1
    assert {n.user_id for n in db.query(TimetableNotification).all()} == {'f1', 'f2', 's1'}
    assert client.get('/api/v1/timetable-notifications', headers=headers('s2')).json() == []
    student_schedule = client.get('/api/v1/students/s1/department-timetable', headers=headers('s1')).json()
    assert student_schedule['available'] and student_schedule['entries'][0]['room'] == '102-C'
    directory = client.get('/api/v1/admin/directory/faculty', headers=headers('admin')).json()
    assert len(next(f for f in directory if f['id'] == 'f2')['courses']) == 1
    assert client.get('/api/v1/admin/directory/students', headers=headers('admin')).status_code == 200
    assert client.get('/api/v1/admin/directory/courses', headers=headers('admin')).status_code == 200


def test_preview_has_no_side_effects_and_invalid_upload_is_atomic(setup):
    client, db, headers = setup
    csv = 'day_of_week,start_time,end_time,course_name,course_code,faculty_ids,room,session_type,lab_group\nMonday,09:30,11:10,DS Lab,CIC-255,f1;f2,102-C,Lab,G1\n'
    response = client.post('/api/v1/admin/timetables/preview', files={'file': ('schedule.csv', csv)}, data={'metadata': json.dumps(payload())}, headers=headers('admin'))
    assert response.status_code == 200, response.text
    assert response.json()['entries'][0]['faculty_ids'] == ['f1', 'f2']
    assert db.query(Course).count() == db.query(TimetablePublication).count() == db.query(TimetableNotification).count() == 0
    bad = client.post('/api/v1/admin/timetables/preview', files={'file': ('schedule.csv', csv.replace('f1;f2', 'missing'))}, data={'metadata': json.dumps(payload())}, headers=headers('admin'))
    assert bad.status_code == 400
    assert db.query(TimetablePublication).count() == 0


def test_validation_and_roles_reject_bad_publications(setup):
    client, db, headers = setup
    url = '/api/v1/admin/timetables/publish'
    for user in ['f1', 's1']:
        assert client.post(url, json=payload(), headers=headers(user)).status_code == 403
        assert client.get('/api/v1/admin/directory/faculty', headers=headers(user)).status_code == 403
    body = payload()
    body['entries'][0]['faculty_ids'] = ['pending']
    assert client.post(url, json=body, headers=headers('admin')).status_code == 400
    body = payload()
    body['entries'].append(copy.deepcopy(body['entries'][0]))
    assert client.post(url, json=body, headers=headers('admin')).status_code == 422
    body = payload()
    body['entries'][0]['end_time'] = '09:00'
    assert client.post(url, json=body, headers=headers('admin')).status_code == 422
    assert db.query(Course).count() == 0


def test_republication_preserves_history_and_notifies_removed_faculty(setup):
    client, db, headers = setup
    url = '/api/v1/admin/timetables/publish'
    assert client.post(url, json=payload(), headers=headers('admin')).status_code == 200
    course = db.query(Course).one()
    db.add(Enrollment(course_id=course.id, student_id='s1'))
    session = AttendanceSession(course_id=course.id, faculty_id='f1', status='completed')
    db.add(session); db.flush()
    db.add(AttendanceRecord(session_id=session.id, student_id='s1', status='present')); db.commit()
    body = payload(expected_revision=1)
    body['entries'][0]['faculty_ids'] = ['f2']
    body['entries'][0]['room'] = 'NEW'
    assert client.post(url, json=body, headers=headers('admin')).status_code == 200
    assert db.query(Course).count() == 1
    assert db.query(AttendanceRecord).one().status == 'present'
    assert db.query(CourseScheduledSlot).count() == 1
    assert db.query(CourseScheduledSlot).one().room == 'NEW'
    assert db.query(TimetablePublication).count() == 2
    assert db.query(TimetableNotification).filter_by(user_id='f1').count() == 2
    stale = client.post(url, json=body, headers=headers('admin'))
    assert stale.status_code == 409
    assert db.query(TimetablePublication).count() == 2


def test_notification_privacy_and_version_preview(setup):
    client, db, headers = setup
    client.post('/api/v1/admin/timetables/publish', json=payload(), headers=headers('admin'))
    item = db.query(TimetableNotification).filter_by(user_id='s1').one()
    for suffix, method in [('/read', client.post), ('/timetable', client.get)]:
        assert method(f'/api/v1/timetable-notifications/{item.id}{suffix}', headers=headers('s2')).status_code == 404
    assert client.get(f'/api/v1/timetable-notifications/{item.id}/timetable', headers=headers('s1')).json()['entries'][0]['course_name'] == 'DS Lab'
    assert client.post(f'/api/v1/timetable-notifications/{item.id}/read', headers=headers('s1')).status_code == 200
    assert client.get('/api/v1/timetable-notifications', headers=headers('s1')).json()[0]['read']


def test_future_publication_does_not_replace_current_assignments_until_due(setup, monkeypatch):
    client, db, headers = setup
    client.post('/api/v1/admin/timetables/publish', json=payload(), headers=headers('admin'))
    future = campus_date() + timedelta(days=3)
    body = payload(expected_revision=1, effective_from=future.isoformat())
    body['entries'][0]['room'] = 'FUTURE'
    response = client.post('/api/v1/admin/timetables/publish', json=body, headers=headers('admin'))
    assert response.status_code == 200 and response.json()['scheduled_for_future']
    assert db.query(CourseScheduledSlot).one().room == '102-C'
    assert client.get('/api/v1/students/s1/department-timetable', headers=headers('s1')).json()['entries'][0]['room'] == '102-C'
    monkeypatch.setattr('app.services.timetable_management.campus_date', lambda: future)
    activate_due_timetables(db); db.commit()
    assert db.query(CourseScheduledSlot).one().room == 'FUTURE'
    assert client.get('/api/v1/students/s1/department-timetable', headers=headers('s1')).json()['entries'][0]['room'] == 'FUTURE'


def test_published_slots_open_one_attendance_window_only_after_enrollment(setup):
    client, db, headers = setup
    client.post('/api/v1/admin/timetables/publish', json=payload(), headers=headers('admin'))
    course = db.query(Course).one()
    # Monday 09:30 India time. Slots persist even when the roster is initially empty.
    now = datetime(2030, 1, 7, 4, 0)
    sync_windows(db, now)
    assert db.query(AttendanceWindow).count() == 0
    assert client.post(f'/api/v1/courses/{course.id}/enrollments', json={'student_ids':['s1']}, headers=headers('f2')).status_code == 200
    sync_windows(db, now)
    sync_windows(db, now)
    assert db.query(AttendanceWindow).count() == 1
    assert db.query(AttendanceSession).count() == 1
    assert db.query(AttendanceSession).one().status == 'in_progress'
    assert db.query(AttendanceRecord).count() == 0


def test_removed_subject_is_inactive_without_deleting_records(setup):
    client, db, headers = setup
    client.post('/api/v1/admin/timetables/publish', json=payload(), headers=headers('admin'))
    old = db.query(Course).one()
    old_id = old.id
    body = payload(expected_revision=1)
    body['entries'][0].update(course_name='CN Lab', course_code='CIC-355')
    assert client.post('/api/v1/admin/timetables/publish', json=body, headers=headers('admin')).status_code == 200
    db.expire_all()
    assert not db.get(Course, old_id).is_active
    assert db.query(Course).count() == 2
    assert len(client.get('/api/v1/admin/directory/courses', headers=headers('admin')).json()) == 1
