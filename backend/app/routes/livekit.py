from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.services.livekit.token_service import token_service

router = APIRouter(prefix="/api/livekit", tags=["LiveKit"])


class LiveKitTokenRequest(BaseModel):
    room_name: str
    participant_name: str


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str


@router.post("/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(request: LiveKitTokenRequest):
    """Generates a LiveKit access token for joining a room."""
    if not request.room_name or not request.room_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="room_name cannot be empty",
        )

    if not request.participant_name or not request.participant_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="participant_name cannot be empty",
        )

    try:
        result = token_service.generate_token(
            room_name=request.room_name,
            participant_name=request.participant_name,
        )
        return result
    except ValueError as e:
        error_msg = str(e)
        if "configured" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )
