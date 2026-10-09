import asyncio
import logging

from app.services.livekit.audio_receiver import LiveKitAudioReceiver
from app.services.livekit.speech_bridge import LiveKitSpeechBridge

logger = logging.getLogger(__name__)


class LiveKitSessionAudio:
    """Owns LiveKit audio reception and one speech pipeline per speaker."""

    def __init__(
        self,
        session_id: str,
        language_code: str = "ta-IN",
    ) -> None:
        self.session_id = session_id
        self.language_code = language_code

        self.receiver = LiveKitAudioReceiver(
            session_id=session_id,
            on_audio=self._handle_audio,
        )

        self._bridges: dict[str, LiveKitSpeechBridge] = {}
        self._bridge_tasks: dict[str, asyncio.Task] = {}

    async def _handle_audio(
        self,
        session_id: str,
        speaker_id: str,
        audio_bytes: bytes,
    ) -> None:
        bridge = self._bridges.get(speaker_id)

        if bridge is None:
            bridge = LiveKitSpeechBridge(
                session_id=session_id,
                speaker_id=speaker_id,
                language_code=self.language_code,
            )

            self._bridges[speaker_id] = bridge

            task = asyncio.create_task(bridge.run())
            self._bridge_tasks[speaker_id] = task

            logger.info(
                "Created speech bridge: session=%s speaker=%s",
                session_id,
                speaker_id,
            )

        await bridge.push_audio(audio_bytes)

    async def connect(
        self,
        livekit_url: str,
        token: str,
    ) -> None:
        await self.receiver.connect(
            livekit_url,
            token,
        )

    async def disconnect(self) -> None:
        await self.receiver.disconnect()

        for bridge in self._bridges.values():
            await bridge.finish()

        for task in self._bridge_tasks.values():
            task.cancel()

        if self._bridge_tasks:
            await asyncio.gather(
                *self._bridge_tasks.values(),
                return_exceptions=True,
            )

        self._bridges.clear()
        self._bridge_tasks.clear()