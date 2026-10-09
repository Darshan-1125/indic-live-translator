import asyncio
import logging

from ai.services.saras_streaming import SaarasStreamingASR

from app.services.stability import StabilityAdapter
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)


class LiveKitSpeechBridge:
    """
    Bridges LiveKit audio into the existing AI pipeline.

    LiveKit audio
        -> Saaras streaming ASR
        -> Stability Engine
        -> WebSocket caption events
    """

    def __init__(
        self,
        session_id: str,
        speaker_id: str,
        language_code: str = "ta-IN",
    ) -> None:
        self.session_id = session_id
        self.speaker_id = speaker_id
        self.language_code = language_code

        self._audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

        self.asr = SaarasStreamingASR(
            session_id=session_id,
            speaker_id=speaker_id,
            language_code=language_code,
            mode="codemix",
        )

        self.stability = StabilityAdapter()

    async def push_audio(self, audio_bytes: bytes) -> None:
        """Push one LiveKit audio chunk into the streaming ASR queue."""
        await self._audio_queue.put(audio_bytes)

    async def finish(self) -> None:
        """Signal the end of the current audio stream."""
        await self._audio_queue.put(None)

    async def run(self) -> None:
        async def audio_chunks():
            while True:
                chunk = await self._audio_queue.get()

                if chunk is None:
                    break

                yield chunk

        logger.info(
            "Starting speech bridge: session=%s speaker=%s",
            self.session_id,
            self.speaker_id,
        )

        try:
            async for asr_event in self.asr.stream(
                audio_chunks(),
                is_final_chunk=False,
            ):
                text = asr_event.get("text", "")

                if not text:
                    continue

                is_final = bool(
                    asr_event.get("is_final", False)
                )

                result = self.stability.process_asr_result(
                    text,
                    is_final=is_final,
                )

                await manager.broadcast_json(
                    self.session_id,
                    {
                        "type": "caption",
                        "session_id": self.session_id,
                        "speaker_id": self.speaker_id,
                        "text": text,
                        "committed_text": (
                            result.cumulative_committed_text
                        ),
                        "tentative_text": (
                            result.tentative_text
                        ),
                        "is_final": is_final,
                    },
                )

                logger.info(
                    "Caption: session=%s speaker=%s text=%r",
                    self.session_id,
                    self.speaker_id,
                    text,
                )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Speech bridge failed: session=%s speaker=%s",
                self.session_id,
                self.speaker_id,
            )