"""Run tests against an isolated database and encryption key, never the user's data."""
import os
import tempfile
from pathlib import Path
import pytest

_directory = tempfile.TemporaryDirectory(prefix="classsense-tests-")
_root = Path(_directory.name)
os.environ["DATABASE_URL"] = f"sqlite:///{_root / 'test.db'}"
os.environ["BIOMETRIC_KEY_FILE"] = str(_root / "biometric.key")
os.environ["SECRET_KEY"] = "isolated-test-signing-key-not-for-production"


@pytest.fixture(scope="session", autouse=True)
def isolated_database_cleanup():
    yield
    from app.database import engine
    engine.dispose()
    _directory.cleanup()


@pytest.fixture(scope="session")
def demo_data():
    from sample_data import initialize_test_data
    initialize_test_data()
