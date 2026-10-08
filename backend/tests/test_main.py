import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert data["status"] == "online"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_websocket_endpoint():
    session_id = "test-session-123"
    with client.websocket_connect(f"/ws/session/{session_id}") as websocket:
        test_msg = {"text": "Hello Indic Live Translator", "lang": "hi"}
        websocket.send_json(test_msg)
        response = websocket.receive_json()
        assert response["type"] == "ack"
        assert response["status"] == "received"
        assert response["received_data"] == test_msg
