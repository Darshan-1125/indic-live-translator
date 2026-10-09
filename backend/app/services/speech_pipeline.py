import asyncio
import io
import logging
import os
import wave
from typing import Any, AsyncIterator, Callable, Dict, Optional

from ai.services.saras_streaming import SaarasStreamingASR
from ai.integration.translation_pipeline import ASRTranslationPipeline
from app.core.config import settings
from app.services.stability import StabilityAdapter

logger = logging.getLogger(__name__)


def pcm16_to_wav(pcm_data: bytes, sample_rate: int = 16000, channels: int = 1) -> bytes:
    """Ensure audio bytes have a valid WAV container.
    
    If the bytes already start with b'RIFF', returns them as-is.
    Otherwise wraps raw 16-bit PCM in a standard WAV header.
    """
    if pcm_data.startswith(b"RIFF"):
        return pcm_data
    with io.BytesIO() as buf:
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)
        return buf.getvalue()


class RealtimeSpeechPipeline:
    """End-to-end streaming speech pipeline:
    
    Audio (PCM/WAV)
        -> Saaras v4 Streaming ASR
        -> Stability Engine
        -> Mayura Translation
        -> Event callbacks (caption, translation)
    """

    def __init__(
        self,
        session_id: str,
        speaker_id: str,
        source_language_code: str = "ta-IN",
        target_language_code: str = "en-IN",
        asr_service: Optional[SaarasStreamingASR] = None,
        stability_adapter: Optional[StabilityAdapter] = None,
        translation_pipeline: Optional[ASRTranslationPipeline] = None,
        on_translation: Optional[Callable[[Dict[str, Any]], Any]] = None,
        on_caption: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ) -> None:
        self.session_id = session_id
        self.speaker_id = speaker_id
        self.source_language_code = source_language_code
        self.target_language_code = target_language_code

        self.audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()

        sarvam_key = (settings.SARVAM_API_KEY or os.environ.get("SARVAM_API_KEY", "")).strip()

        self.asr = asr_service or SaarasStreamingASR(
            api_key=sarvam_key or None,
            session_id=session_id,
            speaker_id=speaker_id,
            language_code=source_language_code,
            mode="codemix",
        )

        self.stability = stability_adapter or StabilityAdapter()
        self.translation = translation_pipeline or ASRTranslationPipeline(
            source_language_code=source_language_code,
            target_language_code=target_language_code,
        )

        self.on_translation = on_translation
        self.on_caption = on_caption
        self._running = False

    async def push_audio(self, audio_bytes: bytes) -> None:
        """Enqueue incoming audio chunk, ensuring WAV format for Saaras."""
        wav_chunk = pcm16_to_wav(audio_bytes)
        await self.audio_queue.put(wav_chunk)

    async def finish(self) -> None:
        """Signal the end of the audio stream."""
        await self.audio_queue.put(None)

    async def run(self) -> None:
        """Process incoming audio queue through ASR -> Stability -> Translation."""
        self._running = True

        async def audio_generator() -> AsyncIterator[bytes]:
            while True:
                chunk = await self.audio_queue.get()
                if chunk is None:
                    break
                yield chunk

        logger.info(
            "Speech pipeline started: session=%s speaker=%s src=%s dst=%s",
            self.session_id,
            self.speaker_id,
            self.source_language_code,
            self.target_language_code,
        )

        try:
            async for asr_event in self.asr.stream(
                audio_generator(),
                is_final_chunk=True,
            ):
                text = asr_event.get("text", "")
                if not text or not text.strip():
                    continue

                is_final = bool(asr_event.get("is_final", False))

                # Step 1: Stability processing
                stability_res = self.stability.process_asr_result(
                    text,
                    is_final=is_final,
                )

                caption_payload = {
                    "type": "caption",
                    "session_id": self.session_id,
                    "speaker_id": self.speaker_id,
                    "text": text,
                    "committed_text": stability_res.cumulative_committed_text,
                    "tentative_text": stability_res.tentative_text,
                    "is_final": is_final,
                }

                if self.on_caption:
                    res = self.on_caption(caption_payload)
                    if asyncio.iscoroutine(res):
                        await res

                # Step 2: Translation processing (Mayura)
                # Run synchronous translate in worker thread to prevent event loop blocking
                try:
                    trans_res = await asyncio.to_thread(
                        self.translation.process,
                        asr_event,
                        self.source_language_code,
                        self.target_language_code,
                    )
                    translated_text = trans_res.get("translated_text", "")
                except Exception as e:
                    logger.warning(
                        "Translation step failed for session=%s: %s",
                        self.session_id,
                        e,
                    )
                    translated_text = ""

                translation_payload = {
                    "type": "translation",
                    "session_id": self.session_id,
                    "speaker_id": self.speaker_id,
                    "text": text,
                    "translated_text": translated_text,
                    "committed_text": stability_res.cumulative_committed_text,
                    "tentative_text": stability_res.tentative_text,
                    "is_final": is_final,
                }

                if self.on_translation:
                    res = self.on_translation(translation_payload)
                    if asyncio.iscoroutine(res):
                        await res

        except asyncio.CancelledError:
            logger.info("Speech pipeline cancelled for session=%s", self.session_id)
            raise
        except Exception as e:
            logger.exception(
                "Speech pipeline error for session=%s speaker=%s: %s",
                self.session_id,
                self.speaker_id,
                e,
            )
        finally:
            self._running = False
