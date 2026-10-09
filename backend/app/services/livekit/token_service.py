import logging
from typing import Optional
from livekit.api import AccessToken, VideoGrants
from app.core.config import settings

logger = logging.getLogger("app.services.livekit")


class LiveKitTokenService:
    """Service for generating LiveKit access tokens."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        livekit_url: Optional[str] = None,
    ):
        self._api_key = api_key
        self._api_secret = api_secret
        self._livekit_url = livekit_url

    @property
    def api_key(self) -> str:
        return self._api_key if self._api_key is not None else settings.LIVEKIT_API_KEY

    @property
    def api_secret(self) -> str:
        return self._api_secret if self._api_secret is not None else settings.LIVEKIT_API_SECRET

    @property
    def livekit_url(self) -> str:
        return self._livekit_url if self._livekit_url is not None else settings.LIVEKIT_URL

    def generate_token(self, room_name: str, participant_name: str) -> dict:
        """Generates a LiveKit JWT token for room participant.

        Raises ValueError if room_name or participant_name is empty, or if credentials are not configured.
        """
        if not room_name or not room_name.strip():
            raise ValueError("room_name cannot be empty")

        if not participant_name or not participant_name.strip():
            raise ValueError("participant_name cannot be empty")

        key = self.api_key
        secret = self.api_secret
        url = self.livekit_url

        if not key or not secret:
            logger.error("LiveKit API key or secret is missing from configuration.")
            raise ValueError("LiveKit API key and secret must be configured")

        clean_room = room_name.strip()
        clean_participant = participant_name.strip()

        grants = VideoGrants(
            room_join=True,
            room=clean_room,
            can_publish=True,
            can_subscribe=True,
        )

        token = (
            AccessToken(key, secret)
            .with_identity(clean_participant)
            .with_name(clean_participant)
            .with_grants(grants)
        )

        return {
            "token": token.to_jwt(),
            "url": url,
        }


token_service = LiveKitTokenService()
