import pytest
pytestmark = pytest.mark.usefixtures("demo_data")
from fastapi.testclient import TestClient
from app.main import app
from app.api.students import calculate_bunk_and_recovery

client = TestClient(app)

def test_safe_bunk_and_recovery_formula():
    # 9 attended out of 10 = 90% -> safe bunk = 2 classes
    safe_bunk, recovery, pct, status = calculate_bunk_and_recovery(9, 10)
    assert pct == 90.0
    assert safe_bunk == 2
    assert recovery == 0
    assert status == "safe"

    # 7 attended out of 10 = 70% -> at-risk (<75%), recovery needed = 2 classes
    # (7 + 2) / (10 + 2) = 9/12 = 75%
    safe_bunk, recovery, pct, status = calculate_bunk_and_recovery(7, 10)
    assert pct == 70.0
    assert safe_bunk == 0
    assert recovery == 2
    assert status == "critical"

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "BPIT" in data["service"]

def test_student_login_seeded():
    response = client.post("/api/v1/auth/login", json={
        "email": "rohan.sharma@bpitindia.edu.in",
        "password": "student123",
        "role": "student"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "student"
    assert data["full_name"] == "Rohan Sharma"

def test_faculty_login_seeded():
    response = client.post("/api/v1/auth/login", json={
        "email": "rajesh.kaushik@bpitindia.edu.in",
        "password": "faculty123",
        "role": "faculty"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "faculty"
    assert data["full_name"] == "Dr. Rajesh Kaushik"

def test_unverified_faculty_login_rejected():
    response = client.post("/api/v1/auth/login", json={
        "email": "amit.verma@bpitindia.edu.in",
        "password": "faculty123",
        "role": "faculty"
    })
    assert response.status_code == 403
    assert "pending Admin Employee ID verification" in response.json()["detail"]
