import pytest
from app.api.deps import verify_password, get_password_hash, create_access_token
from jose import jwt
from app.config import settings

def test_password_hashing():
    raw_pass = "student123"
    hashed = get_password_hash(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_generation():
    token = create_access_token({"sub": "user-123", "role": "student"})
    assert isinstance(token, str)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload.get("sub") == "user-123"
    assert payload.get("role") == "student"
    assert "exp" in payload
