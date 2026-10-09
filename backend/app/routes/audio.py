from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services.livekit.session_audio import LiveKitSessionAudio
from app.services.livekit.token_service import token_service

router = APIRouter(prefix="/api/audio", tags=["Audio"])

_active_sessions: dict[str, LiveKitSessionAudio] = {}


class AudioSessionRequest(BaseModel):
    session_id: str
    room_name: str
    language_code: str = "ta-IN"


@router.post("/start")
async def start_audio_session(request: AudioSessionRequest):
    if request.session_id in _active_sessions:
        return {
            "status": "already_running",
            "session_id": request.session_id,
        }

    # Internal backend participant.
    backend_identity = f"backend-audio-{request.session_id}"

    token_data = token_service.generate_token(
        room_name=request.room_name,
        participant_name=backend_identity,
    )

    token = token_data["token"]

    session = LiveKitSessionAudio(
        session_id=request.session_id,
        language_code=request.language_code,
    )

    try:
        await session.connect(
            settings.LIVEKIT_URL,
            token,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect audio receiver: {exc}",
        ) from exc

    _active_sessions[request.session_id] = session

    return {
        "status": "started",
        "session_id": request.session_id,
    }


@router.post("/stop/{session_id}")
async def stop_audio_session(session_id: str):
    session = _active_sessions.pop(session_id, None)

    if session is None:
        return {
            "status": "not_running",
            "session_id": session_id,
        }

    await session.disconnect()

    return {
        "status": "stopped",
        "session_id": session_id,
    }