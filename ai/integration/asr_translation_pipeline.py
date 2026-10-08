"""ASR to Stability to Translation integration pipeline for Indic Live Translator.

Milestone: Real-time Audio / ASR → Backend Stability → Translation → Caption event.

Target Flow:
    LiveKit / microphone audio chunks
            ↓
    Saaras v4 streaming ASR (SaarasStreamingASR)
            ↓
    normalized ASR events (asr_partial / is_final)
            ↓
    Backend StabilityAdapter (StabilityEngine)
            ↓
    stable transcript / full transcript
            ↓
    Sarvam Translation (Mayura: ta-IN ↔ en-IN)
            ↓
    frontend-ready translation caption events
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, Optional, Union

# Import Backend StabilityAdapter
try:
    from app.services.stability import StabilityAdapter, StabilityResult
except ImportError:
    from backend.app.services.stability import StabilityAdapter, StabilityResult

from ai.services.saras_streaming import SaarasStreamingASR, SaarasStreamingError
from ai.services.translation import (
    SarvamTranslationError,
    SarvamTranslationService,
)

logger = logging.getLogger(__name__)


def process_asr_to_stable_translation(
    event: Dict[str, Any],
    stability_adapter: StabilityAdapter,
    translation_service: Optional[SarvamTranslationService] = None,
    source_language_code: str = "ta-IN",
    target_language_code: str = "en-IN",
    mode: Optional[str] = None,
    fail_silently: bool = False,
) -> Dict[str, Any]:
    """Process a single normalized ASR event through Backend Stability and Translation.

    Args:
        event: Normalized ASR event dictionary:
            {
              "type": "asr_partial",
              "session_id": "<session_id>",
              "speaker_id": "<speaker_id>",
              "text": "<recognized text>",
              "is_final": bool,
              "language_code": "<optional ta-IN>"
            }
        stability_adapter: Backend StabilityAdapter instance.
        translation_service: Optional SarvamTranslationService instance.
        source_language_code: Source language tag (default: 'ta-IN').
        target_language_code: Target language tag (default: 'en-IN').
        mode: Translation mode override (e.g. 'modern-colloquial').
        fail_silently: If True, translation errors will not raise; returns fallback.

    Returns:
        Frontend-ready translation event dictionary:
            {
              "type": "translation",
              "session_id": "<session_id>",
              "speaker_id": "<speaker_id>",
              "text": "<recognized text>",
              "translated_text": "<translated English text>",
              "is_final": bool,
              "stability": {
                "newly_committed_text": "...",
                "cumulative_committed_text": "...",
                "tentative_text": "...",
                "full_transcript": "...",
                "is_final": bool,
                "stable_word_count": int,
                "tentative_word_count": int
              }
            }

    Raises:
        TypeError: If event is not a dict.
        ValueError: If mandatory fields are missing.
        SarvamTranslationError: If translation fails and fail_silently is False.
    """
    if not isinstance(event, dict):
        raise TypeError("event must be a dictionary representing a normalized ASR event.")

    session_id = str(event.get("session_id", ""))
    speaker_id = str(event.get("speaker_id", ""))
    raw_text = event.get("text", "")
    text_content = "" if raw_text is None else str(raw_text).strip()
    is_final = bool(event.get("is_final", False))

    # 1. Process through backend StabilityAdapter
    stability_res: StabilityResult = stability_adapter.process_asr_result(
        asr_text=text_content,
        is_final=is_final,
    )

    stability_metadata = stability_res.to_dict()

    # 2. Empty text handling: silence or empty partials do not trigger translation API calls
    if not text_content:
        return {
            "type": "translation",
            "session_id": session_id,
            "speaker_id": speaker_id,
            "text": "",
            "translated_text": "",
            "is_final": is_final,
            "stability": stability_metadata,
        }

    # 3. Translate using Sarvam Translation Service
    service = translation_service or SarvamTranslationService()

    translate_kwargs: Dict[str, Any] = {
        "text": text_content,
        "source_language_code": source_language_code,
        "target_language_code": target_language_code,
    }
    if mode is not None:
        translate_kwargs["mode"] = mode

    translated_text = ""
    try:
        response = service.translate(**translate_kwargs)
        if isinstance(response, dict):
            translated_text = str(response.get("translated_text", "") or "")
        elif hasattr(response, "translated_text"):
            translated_text = str(getattr(response, "translated_text") or "")
        else:
            translated_text = str(response or "")
    except SarvamTranslationError as err:
        if not fail_silently:
            raise
        logger.warning("Translation failed for session %s: %s", session_id, err)
        translated_text = ""
    except Exception as err:
        if not fail_silently:
            raise SarvamTranslationError(
                f"Unexpected error during translation: {err}"
            ) from err
        logger.warning("Unexpected error translating for session %s: %s", session_id, err)
        translated_text = ""

    return {
        "type": "translation",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "text": text_content,
        "translated_text": translated_text,
        "is_final": is_final,
        "stability": stability_metadata,
    }


class ASRStabilityTranslationPipeline:
    """End-to-end streaming pipeline: Audio/ASR → Stability → Translation.

    Connects:
      - Saaras v4 Streaming ASR (Speech to Text)
      - Backend StabilityAdapter (Committed vs Tentative words)
      - Sarvam Mayura Translation (Indic to English)
    """

    def __init__(
        self,
        translation_service: Optional[SarvamTranslationService] = None,
        stability_adapter: Optional[StabilityAdapter] = None,
        source_language_code: str = "ta-IN",
        target_language_code: str = "en-IN",
        mode: Optional[str] = None,
        fail_silently: bool = False,
    ) -> None:
        """Initialize the pipeline with optional services for dependency injection."""
        self.translation_service = translation_service or SarvamTranslationService()
        self.stability_adapter = stability_adapter or StabilityAdapter()
        self.source_language_code = source_language_code
        self.target_language_code = target_language_code
        self.mode = mode
        self.fail_silently = fail_silently

    def reset(self) -> None:
        """Reset internal stability state for a new session or speaker turn."""
        self.stability_adapter.reset()

    def process_asr_event(
        self,
        event: Dict[str, Any],
        source_language_code: Optional[str] = None,
        target_language_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process a single normalized ASR event through stability and translation."""
        return process_asr_to_stable_translation(
            event=event,
            stability_adapter=self.stability_adapter,
            translation_service=self.translation_service,
            source_language_code=source_language_code or self.source_language_code,
            target_language_code=target_language_code or self.target_language_code,
            mode=self.mode,
            fail_silently=self.fail_silently,
        )

    def __call__(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Shorthand callable delegating to process_asr_event()."""
        return self.process_asr_event(event)

    async def stream_audio(
        self,
        audio_chunks: AsyncIterator[bytes],
        session_id: str = "",
        speaker_id: str = "",
        is_final_chunk: bool = False,
        streamer: Optional[SaarasStreamingASR] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream raw audio chunks, performing real-time ASR, stability, and translation.

        Yields frontend-ready translation events asynchronously as speech progresses.

        Args:
            audio_chunks: Async iterable yielding audio bytes (WAV/PCM from LiveKit or mic).
            session_id: Session identifier.
            speaker_id: Speaker identifier.
            is_final_chunk: Flag indicating whether this is the terminal chunk batch.
            streamer: Optional pre-configured SaarasStreamingASR instance.

        Yields:
            Normalized translation event dictionaries with stability metadata.
        """
        active_streamer = streamer or SaarasStreamingASR(
            session_id=session_id,
            speaker_id=speaker_id,
            language_code=self.source_language_code,
            model="saaras:v4",
            mode="codemix",
        )

        async for asr_event in active_streamer.stream(
            audio_chunks,
            is_final_chunk=is_final_chunk,
        ):
            translation_event = self.process_asr_event(asr_event)
            yield translation_event


# Backward-compatibility aliases
LiveTranslationPipeline = ASRStabilityTranslationPipeline
from ai.integration.translation_pipeline import (  # noqa: E402
    ASRTranslationPipeline,
    TranslationPipeline,
    translate_asr_event,
)

__all__ = [
    "ASRStabilityTranslationPipeline",
    "LiveTranslationPipeline",
    "process_asr_to_stable_translation",
    "ASRTranslationPipeline",
    "TranslationPipeline",
    "translate_asr_event",
]
