import jwt
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.livekit.token_service import LiveKitTokenService, token_service

client = TestClient(app)


def test_token_service_generate_valid_token():
    service = LiveKitTokenService(
        api_key="test_api_key",
        api_secret="test_secret_key_that_is_long_enough_32bytes",
        livekit_url="wss://test.livekit.cloud",
    )
    res = service.generate_token(room_name="test-room", participant_name="UserA")
    assert "token" in res
    assert res["url"] == "wss://test.livekit.cloud"

    decoded = jwt.decode(res["token"], options={"verify_signature": False})
    assert decoded["sub"] == "UserA"
    assert decoded["name"] == "UserA"
    assert decoded["iss"] == "test_api_key"
    assert decoded["video"]["room"] == "test-room"
    assert decoded["video"]["roomJoin"] is True
    assert decoded["video"]["canPublish"] is True
    assert decoded["video"]["canSubscribe"] is True


def test_token_service_empty_room():
    service = LiveKitTokenService(api_key="key", api_secret="secret")
    with pytest.raises(ValueError, match="room_name cannot be empty"):
        service.generate_token(room_name="", participant_name="UserA")


def test_token_service_empty_participant():
    service = LiveKitTokenService(api_key="key", api_secret="secret")
    with pytest.raises(ValueError, match="participant_name cannot be empty"):
        service.generate_token(room_name="test-room", participant_name="  ")


def test_token_service_missing_credentials():
    service = LiveKitTokenService(api_key="", api_secret="")
    with pytest.raises(ValueError, match="configured"):
        service.generate_token(room_name="test-room", participant_name="UserA")


def test_api_livekit_token_success():
    payload = {
        "room_name": "indic-room-101",
        "participant_name": "Rohan"
    }
    response = client.post("/api/livekit/token", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert "url" in data
    assert "secret" not in data
    assert "LIVEKIT_API_SECRET" not in str(data)

    decoded = jwt.decode(data["token"], options={"verify_signature": False})
    assert decoded["sub"] == "Rohan"
    assert decoded["video"]["room"] == "indic-room-101"
    assert decoded["video"]["roomJoin"] is True
    assert decoded["video"]["canPublish"] is True
    assert decoded["video"]["canSubscribe"] is True


def test_api_livekit_token_empty_room_name():
    payload = {
        "room_name": "   ",
        "participant_name": "Rohan"
    }
    response = client.post("/api/livekit/token", json=payload)
    assert response.status_code == 400
    assert "room_name cannot be empty" in response.json()["detail"]


def test_api_livekit_token_empty_participant_name():
    payload = {
        "room_name": "room1",
        "participant_name": ""
    }
    response = client.post("/api/livekit/token", json=payload)
    assert response.status_code == 400
    assert "participant_name cannot be empty" in response.json()["detail"]


def test_api_livekit_token_missing_fields():
    payload = {
        "room_name": "room1"
    }
    response = client.post("/api/livekit/token", json=payload)
    assert response.status_code == 422
