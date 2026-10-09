import json
import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_websocket():
    client = TestClient(app)
    with client.websocket_connect("/ws/session/test-room") as websocket:
        message = {
            "type": "ping",
            "message": "Hello backend"
        }
        websocket.send_json(message)
        response = websocket.receive_json()
        assert response["type"] == "ack"
        assert response["received_data"] == message


if __name__ == "__main__":
    test_websocket()
    print("WebSocket test passed!")