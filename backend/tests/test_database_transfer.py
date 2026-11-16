import pytest
from sqlalchemy import create_engine

from app.database import Base
from migrate_sqlite_to_postgres import transfer


def test_transfer_preserves_ciphertext_and_refuses_existing_data():
    source = create_engine("sqlite://")
    target = create_engine("sqlite://")
    Base.metadata.create_all(source)
    # Raw text intentionally bypasses the encryption adapter, as the transfer must.
    from sqlalchemy import text
    with source.begin() as connection:
        connection.execute(text("INSERT INTO users (id, email, password_hash, role) VALUES ('u1', 'test@example.com', 'hash', 'student')"))
        connection.execute(text("INSERT INTO students (id, user_id, full_name, enrollment_no, semester, branch, section, face_embedding) VALUES ('s1', 'u1', 'Test', '001', '6th', 'IT', 'A', 'encrypted-original')"))
    try:
        counts = transfer(source, target)
        assert counts['users'] == counts['students'] == 1
        with target.connect() as connection:
            assert connection.execute(text("SELECT face_embedding FROM students")).scalar_one() == 'encrypted-original'
        with pytest.raises(ValueError, match='contains data'):
            transfer(source, target)
        with target.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 1
    finally:
        source.dispose()
        target.dispose()


def test_transfer_rolls_back_if_source_schema_is_outdated():
    source = create_engine("sqlite://")
    target = create_engine("sqlite://")
    Base.metadata.create_all(source)
    from sqlalchemy import text
    with source.begin() as connection:
        connection.execute(text("INSERT INTO users (id, email, password_hash, role) VALUES ('u1', 'test@example.com', 'hash', 'student')"))
        connection.execute(text("DROP TABLE students"))
    try:
        with pytest.raises(ValueError, match='lacks table'):
            transfer(source, target)
        with target.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 0
    finally:
        source.dispose()
        target.dispose()
