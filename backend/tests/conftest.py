# backend/tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient
os.environ["KAGAMI_MOCK"] = "1"
os.environ["KAGAMI_SKIP_WARMUP"] = "1"
from main import app

@pytest.fixture(scope="module")
def client():
    """
    Yield a TestClient for the FastAPI app.
    This fixture ensures the app is spun up once per test module.
    """
    with TestClient(app) as c:
        yield c