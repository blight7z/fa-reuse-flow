import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_fa_reuse.db"
os.environ["AUTO_CREATE_TABLES"] = "false"
os.environ["AUTO_SEED"] = "false"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["UPLOAD_DIR"] = "./test_uploads"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed_users


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_users(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def sample_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "sample-data"
