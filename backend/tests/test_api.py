# backend/tests/test_api.py
import os
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Kagami Chat — backend humming smoothly."}

def test_handle_message_in_mock_mode(client):
    
    start_response = client.post(
        "/api/session/start",
        json={"participantId": "test-user-001", "conditionName": "none_static"},
    )
    assert start_response.status_code == 200
    session_id = start_response.json()["sessionId"]

    message_response = client.post(
        "/api/session/message",
        json={"sessionId": session_id, "message": "This is a test message."},
    )
    assert message_response.status_code == 200
    assert message_response.json()["response"] == "This is a mock response from Kagami."
