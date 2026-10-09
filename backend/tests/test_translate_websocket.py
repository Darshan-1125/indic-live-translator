import asyncio
import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.websocket.connection_manager import manager


@pytest.fixture
def test_client():
    return TestClient(app)


def test_ws_translate_full_lifecycle(test_client):
    """Test full /ws/translate lifecycle: START -> AUDIO -> TRANSLATION -> STOP."""
    session_id = "test-session-flow"
    speaker_id = "speaker-user-1"

    # Mock Saaras streaming generator
    mock_events = [
        {
            "type": "asr_partial",
            "session_id": session_id,
            "speaker_id": speaker_id,
            "text": "வணக்கம்",
            "is_final": False,
            "language_code": "ta-IN",
            "is_code_mixed": False,
        }
    ]

    async def fake_stream(audio_chunks, is_final_chunk=True):
        async for chunk in audio_chunks:
            pass
        for evt in mock_events:
            yield evt

    mock_asr_instance = MagicMock()
    mock_asr_instance.stream = fake_stream

    # Mock Translation pipeline
    mock_trans_result = {
        "type": "translation",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "text": "வணக்கம்",
        "translated_text": "Hello / Greetings",
        "is_final": False,
    }
    mock_pipeline_instance = MagicMock()
    mock_pipeline_instance.process.return_value = mock_trans_result

    with patch(
        "app.services.speech_pipeline.SaarasStreamingASR",
        return_value=mock_asr_instance,
    ), patch(
        "app.services.speech_pipeline.ASRTranslationPipeline",
        return_value=mock_pipeline_instance,
    ):
        with test_client.websocket_connect("/ws/translate") as websocket:
            # 1. Send START
            start_msg = {
                "type": "start",
                "session_id": session_id,
                "speaker_id": speaker_id,
            }
            websocket.send_json(start_msg)
            started_resp = websocket.receive_json()
            assert started_resp["type"] == "started"
            assert started_resp["session_id"] == session_id
            assert started_resp["speaker_id"] == speaker_id

            # 2. Send AUDIO (raw 16-bit PCM 16kHz mono)
            pcm_data = b"\x00\x00" * 160  # 160 samples = 10ms of 16kHz 16-bit
            b64_audio = base64.b64encode(pcm_data).decode("utf-8")
            websocket.send_json({
                "type": "audio",
                "audio": b64_audio,
            })

            # 3. Send STOP to flush stream and get results
            websocket.send_json({"type": "stop"})

            # Receive emitted events: caption, translation, and stopped
            received_types = []
            received_messages = []
            for _ in range(3):
                msg = websocket.receive_json()
                received_types.append(msg.get("type"))
                received_messages.append(msg)

            assert "caption" in received_types
            assert "translation" in received_types
            assert "stopped" in received_types

            # Verify translation payload
            trans_event = next(m for m in received_messages if m.get("type") == "translation")
            assert trans_event["session_id"] == session_id
            assert trans_event["speaker_id"] == speaker_id
            assert trans_event["text"] == "வணக்கம்"
            assert trans_event["translated_text"] == "Hello / Greetings"


def test_ws_translate_audio_before_start_error(test_client):
    """Test that sending AUDIO before START returns an error."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_json({
            "type": "audio",
            "audio": "AAAA",
        })
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "before START" in resp["message"]


def test_ws_translate_stop_before_start_error(test_client):
    """Test that sending STOP before START returns an error."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_json({"type": "stop"})
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "before START" in resp["message"]


def test_ws_translate_start_twice_error(test_client):
    """Test that sending START twice on same session returns an error."""
    with patch("app.services.speech_pipeline.SaarasStreamingASR"), \
         patch("app.services.speech_pipeline.ASRTranslationPipeline"):
        with test_client.websocket_connect("/ws/translate") as websocket:
            websocket.send_json({
                "type": "start",
                "session_id": "sess-duplicate",
                "speaker_id": "spk-1",
            })
            resp1 = websocket.receive_json()
            assert resp1["type"] == "started"

            websocket.send_json({
                "type": "start",
                "session_id": "sess-duplicate-2",
                "speaker_id": "spk-2",
            })
            resp2 = websocket.receive_json()
            assert resp2["type"] == "error"
            assert "already started" in resp2["message"]


def test_ws_translate_invalid_json(test_client):
    """Test sending malformed JSON string."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_text("THIS IS NOT JSON")
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "Invalid JSON" in resp["message"]


def test_ws_translate_missing_session_id(test_client):
    """Test missing or empty session_id in START."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_json({
            "type": "start",
            "session_id": "   ",
            "speaker_id": "spk-1",
        })
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "session_id" in resp["message"]


def test_ws_translate_missing_speaker_id(test_client):
    """Test missing or empty speaker_id in START."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_json({
            "type": "start",
            "session_id": "sess-1",
            "speaker_id": "",
        })
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "speaker_id" in resp["message"]


def test_ws_translate_invalid_base64(test_client):
    """Test invalid base64 audio payload."""
    with patch("app.services.speech_pipeline.SaarasStreamingASR"), \
         patch("app.services.speech_pipeline.ASRTranslationPipeline"):
        with test_client.websocket_connect("/ws/translate") as websocket:
            websocket.send_json({
                "type": "start",
                "session_id": "sess-b64",
                "speaker_id": "spk-1",
            })
            websocket.receive_json()

            websocket.send_json({
                "type": "audio",
                "audio": "===not-valid-base64===",
            })
            resp = websocket.receive_json()
            assert resp["type"] == "error"
            assert "decode" in resp["message"].lower() or "base64" in resp["message"].lower()


def test_ws_translate_unknown_message_type(test_client):
    """Test unknown message type."""
    with test_client.websocket_connect("/ws/translate") as websocket:
        websocket.send_json({"type": "ping_custom"})
        resp = websocket.receive_json()
        assert resp["type"] == "error"
        assert "Unknown message type" in resp["message"]
