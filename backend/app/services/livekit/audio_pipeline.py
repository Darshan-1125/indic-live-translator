import asyncio
import logging
from typing import Optional

from ai.services.saras_streaming import SaarasStreamingASR

from app.services.stability import StabilityAdapter
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)


class LiveKitSpeechPipeline:
    """
    Connects LiveKit audio frames to:

        LiveKit
        -> Saaras streaming ASR
        -> Stability Engine
        -> WebSocket captions
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

        self.queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()

        self.asr = SaarasStreamingASR(
            session_id=session_id,
            speaker_id=speaker_id,
            language_code=language_code,
            mode="codemix",
        )

        self.stability = StabilityAdapter()

    async def push_audio(self, audio_bytes: bytes) -> None:
        await self.queue.put(audio_bytes)

    async def finish(self) -> None:
        await self.queue.put(None)

    async def run(self) -> None:
        async def audio_stream():
            while True:
                chunk = await self.queue.get()

                if chunk is None:
                    break

                yield chunk

        logger.info(
            "Starting speech pipeline: session=%s speaker=%s",
            self.session_id,
            self.speaker_id,
        )

        try:
            async for event in self.asr.stream(
                audio_stream(),
                is_final_chunk=False,
            ):
                text = event.get("text", "")
                is_final = bool(event.get("is_final", False))

                if not text:
                    continue

                stability_result = self.stability.process_asr_result(
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
                            stability_result.cumulative_committed_text
                        ),
                        "tentative_text": (
                            stability_result.tentative_text
                        ),
                        "is_final": is_final,
                    },
                )

        except Exception:
            logger.exception(
                "Speech pipeline failed: session=%s speaker=%s",
                self.session_id,
                self.speaker_id,
            )