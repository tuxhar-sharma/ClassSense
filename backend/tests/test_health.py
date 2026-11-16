from unittest.mock import Mock
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from app.main import app
from app.database import get_db


def test_health_returns_503_when_database_is_unavailable():
    db = Mock()
    db.execute.side_effect = OperationalError('SELECT 1', {}, Exception('database offline'))
    app.dependency_overrides[get_db] = lambda: db
    try:
        response = TestClient(app).get('/health')
        assert response.status_code == 503
        assert response.json() == {'detail': 'Database connection unavailable.'}
    finally:
        app.dependency_overrides.pop(get_db, None)
