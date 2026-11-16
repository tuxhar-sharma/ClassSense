import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import Base, get_db
from app.models.user import User, Student, Faculty
from app.models.course import Course, Enrollment
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.api.deps import create_access_token, get_password_hash


@pytest.fixture
def accounts():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = database
    with factory() as db:
        for role, uid in [('admin', 'admin'), ('faculty', 'faculty'), ('faculty', 'other'), ('faculty', 'pending')]:
            user = User(id=uid, email=f'{uid}@bpitindia.edu.in', role=role, password_hash=get_password_hash('Private123!'))
            db.add(user)
            if role == 'faculty':
                db.add(Faculty(id=uid, user=user, full_name=uid, employee_id=uid, id_verified=uid != 'pending'))
        db.commit()
    try:
        with TestClient(app) as client:
            yield client, factory
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def headers(uid):
    return {'Authorization': 'Bearer ' + create_access_token({'sub': uid})}


def register(client):
    result = client.post('/api/v1/auth/student/register', json={
        'email': 'rahul@bpitindia.edu.in', 'full_name': 'Rahul Sharma', 'enrollment_no': '001'})
    assert result.status_code == 200, result.text
    return result.json()['user_id']


def test_default_password_can_be_changed_and_old_password_rejected(accounts):
    client, _ = accounts
    uid = register(client)
    login = {'email': 'rahul@bpitindia.edu.in', 'password': 'RahulSharma123@bBPIT'}
    assert client.post('/api/v1/auth/login', json=login).status_code == 200
    endpoint = '/api/v1/auth/change-password'
    assert client.post(endpoint, headers=headers(uid), json={'current_password': 'wrong', 'password': 'Private987!'}).status_code == 400
    assert client.post(endpoint, headers=headers(uid), json={'current_password': login['password'], 'password': 'Private987!'}).status_code == 200
    assert client.post('/api/v1/auth/login', json=login).status_code == 401
    login['password'] = 'Private987!'
    assert client.post('/api/v1/auth/login', json=login).status_code == 200


@pytest.mark.parametrize('deleter', ['faculty', 'admin'])
def test_student_deletion_permissions_and_cascades(accounts, deleter):
    client, factory = accounts
    uid = register(client)
    with factory() as db:
        student = db.query(Student).filter_by(user_id=uid).one()
        sid = student.id
        course = Course(id='course', course_code='CS101', course_name='Computing', faculty_id='faculty')
        db.add(course)
        db.flush()
        db.add(Enrollment(course_id=course.id, student_id=sid))
        session = AttendanceSession(id='session', course_id=course.id, faculty_id='faculty')
        db.add(session)
        db.flush()
        db.add(AttendanceRecord(session_id=session.id, student_id=sid))
        db.commit()
    endpoint = f'/api/v1/students/{sid}'
    assert client.delete(endpoint, headers=headers(uid)).status_code == 403
    assert client.delete(endpoint, headers=headers('other')).status_code == 403
    assert client.delete(endpoint, headers=headers('pending')).status_code == 403
    assert client.delete(endpoint, headers=headers(deleter)).status_code == 200
    with factory() as db:
        assert db.get(User, uid) is None
        assert db.get(Student, sid) is None
        assert db.query(Enrollment).count() == 0
        assert db.query(AttendanceRecord).count() == 0
        assert db.get(AttendanceSession, 'session') is not None
    assert client.get(f'/api/v1/students/{uid}/profile', headers=headers(uid)).status_code == 401
